"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberships, occurrences, parcels, shifts, units, visitors, visits } from "@/db/schema";
import { requireCondo, requireRole } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { bool, maybeDate, num, pickupCode, sequence, str, token } from "@/lib/utils";
import { GATE } from "@/lib/rbac";

async function unitResidents(condoId: number, unitId: number | null) {
  if (!unitId) return [];
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.condoId, condoId), eq(memberships.unitId, unitId)));
  return rows.map((r) => r.userId);
}

async function nextCode(table: "occurrence", condoId: number) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(occurrences)
    .where(eq(occurrences.condoId, condoId));
  return sequence(table === "occurrence" ? "OC" : "XX", Number(row?.n ?? 0) + 1);
}

/* ------------------------------------------------------------ VISITANTES */

export async function saveVisitorAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const id = num(formData, "id");
  const values = {
    condoId,
    name: str(formData, "name"),
    document: str(formData, "document") || null,
    docType: str(formData, "docType", "RG"),
    phone: str(formData, "phone") || null,
    kind: str(formData, "kind", "visitante"),
    company: str(formData, "company") || null,
    vehiclePlate: str(formData, "vehiclePlate").toUpperCase() || null,
    recurring: bool(formData, "recurring"),
    notes: str(formData, "notes") || null,
  };
  if (!values.name) return;
  if (id) {
    await db.update(visitors).set(values).where(and(eq(visitors.id, id), eq(visitors.condoId, condoId)));
  } else {
    await db.insert(visitors).values(values);
  }
  await logAudit({
    session,
    condoId,
    action: id ? "atualizar" : "criar",
    entity: "visitante",
    entityId: id || null,
    summary: `${id ? "Atualizou" : "Cadastrou"} ${values.name}`,
    after: values,
  });
  revalidatePath("/painel/visitantes");
}

export async function toggleBlockVisitorAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico", "porteiro", "zelador"]);
  const id = num(formData, "id");
  const [visitor] = await db.select().from(visitors).where(eq(visitors.id, id)).limit(1);
  if (!visitor || visitor.condoId !== condoId) return;
  const blocked = !visitor.blocked;
  await db
    .update(visitors)
    .set({ blocked, blockReason: blocked ? str(formData, "reason", "Bloqueio de segurança") : null })
    .where(eq(visitors.id, id));
  await logAudit({
    session,
    condoId,
    action: blocked ? "bloquear" : "desbloquear",
    entity: "visitante",
    entityId: id,
    summary: `${blocked ? "Bloqueou" : "Liberou"} ${visitor.name}`,
    before: { blocked: visitor.blocked },
    after: { blocked },
    critical: true,
  });
  revalidatePath("/painel/visitantes");
}

export async function createVisitAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  let visitorId = num(formData, "visitorId");
  const name = str(formData, "name");

  if (!visitorId && name) {
    const [created] = await db
      .insert(visitors)
      .values({
        condoId,
        name,
        document: str(formData, "document") || null,
        docType: str(formData, "docType", "RG"),
        phone: str(formData, "phone") || null,
        kind: str(formData, "kind", "visitante"),
        company: str(formData, "company") || null,
        vehiclePlate: str(formData, "vehiclePlate").toUpperCase() || null,
        recurring: bool(formData, "recurring"),
      })
      .returning();
    visitorId = created.id;
  }
  if (!visitorId) return;

  const [visitor] = await db.select().from(visitors).where(eq(visitors.id, visitorId)).limit(1);
  if (!visitor || visitor.condoId !== condoId) return;

  const isResident = session.role === "morador";
  const unitId = isResident ? session.unitId : num(formData, "unitId") || session.unitId;
  const validFrom = maybeDate(formData, "validFrom") ?? new Date();
  const validUntil = maybeDate(formData, "validUntil") ?? new Date(Date.now() + 86400000);
  const autoAuthorize = isResident || session.role === "sindico" || session.role === "superadmin";

  const [visit] = await db
    .insert(visits)
    .values({
      condoId,
      visitorId,
      unitId: unitId ?? null,
      hostUserId: isResident ? session.user.id : num(formData, "hostUserId") || null,
      purpose: str(formData, "purpose") || null,
      status: visitor.blocked ? "negado" : autoAuthorize ? "autorizado" : "aguardando",
      deniedReason: visitor.blocked ? "Visitante consta na lista de bloqueio do condomínio." : null,
      qrToken: token(16),
      validFrom,
      validUntil,
      authorizedById: autoAuthorize && !visitor.blocked ? session.user.id : null,
      authorizedAt: autoAuthorize && !visitor.blocked ? new Date() : null,
      vehiclePlate: str(formData, "visitPlate").toUpperCase() || visitor.vehiclePlate,
      notes: str(formData, "notes") || null,
      createdById: session.user.id,
    })
    .returning();

  if (!autoAuthorize && unitId) {
    await notify(
      condoId,
      await unitResidents(condoId, unitId),
      "Autorização de visitante pendente",
      `${visitor.name} aguarda sua autorização na portaria.`,
      "/painel/visitantes",
    );
  }
  await logAudit({
    session,
    condoId,
    action: "criar",
    entity: "visita",
    entityId: visit.id,
    summary: `Convite para ${visitor.name}${visitor.blocked ? " (negado por bloqueio)" : ""}`,
    after: { visitorId, unitId, status: visit.status },
  });
  revalidatePath("/painel/visitantes");
  revalidatePath("/painel/portaria");
}

export async function decideVisitAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const id = num(formData, "id");
  const decision = str(formData, "decision");
  const [visit] = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
  if (!visit || visit.condoId !== condoId) return;
  const isHost = visit.hostUserId === session.user.id || (session.unitId && visit.unitId === session.unitId);
  if (!isHost && !["superadmin", "sindico", "porteiro", "zelador"].includes(session.role)) return;

  const status = decision === "autorizar" ? "autorizado" : "negado";
  await db
    .update(visits)
    .set({
      status,
      authorizedById: session.user.id,
      authorizedAt: new Date(),
      deniedReason: decision === "autorizar" ? null : str(formData, "reason", "Não autorizado pelo morador"),
    })
    .where(eq(visits.id, id));
  await logAudit({
    session,
    condoId,
    action: decision === "autorizar" ? "autorizar" : "negar",
    entity: "visita",
    entityId: id,
    summary: `Visita ${status} por ${session.user.name}`,
    before: { status: visit.status },
    after: { status },
    critical: true,
  });
  revalidatePath("/painel/visitantes");
  revalidatePath("/painel/portaria");
}

export async function gateMoveAction(formData: FormData) {
  const { session, condoId } = await requireRole(GATE);
  const id = num(formData, "id");
  const move = str(formData, "move");
  const [visit] = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
  if (!visit || visit.condoId !== condoId) return;
  const [visitor] = await db.select().from(visitors).where(eq(visitors.id, visit.visitorId)).limit(1);

  if (move === "entrada") {
    if (visit.status !== "autorizado") return;
    await db
      .update(visits)
      .set({ status: "dentro", checkinAt: new Date(), checkinById: session.user.id })
      .where(eq(visits.id, id));
    await notify(
      condoId,
      await unitResidents(condoId, visit.unitId),
      "Visitante entrou no condomínio",
      `${visitor?.name ?? "Visitante"} teve a entrada registrada pela portaria.`,
      "/painel/visitantes",
    );
  } else {
    await db
      .update(visits)
      .set({ status: "finalizado", checkoutAt: new Date(), checkoutById: session.user.id })
      .where(eq(visits.id, id));
  }
  await logAudit({
    session,
    condoId,
    action: move === "entrada" ? "checkin" : "checkout",
    entity: "visita",
    entityId: id,
    summary: `${move === "entrada" ? "Entrada" : "Saída"} de ${visitor?.name ?? "visitante"}`,
    critical: true,
    origin: "portaria",
  });
  revalidatePath("/painel/visitantes");
  revalidatePath("/painel/portaria");
}

/* ------------------------------------------------------------ ENCOMENDAS */

export async function registerParcelAction(formData: FormData) {
  const { session, condoId } = await requireRole(GATE);
  const unitId = num(formData, "unitId");
  if (!unitId) return;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(parcels).where(eq(parcels.condoId, condoId));
  const [parcel] = await db
    .insert(parcels)
    .values({
      condoId,
      unitId,
      code: sequence("ENC", Number(row?.n ?? 0) + 1),
      kind: str(formData, "kind", "encomenda"),
      carrier: str(formData, "carrier") || null,
      trackingCode: str(formData, "trackingCode") || null,
      description: str(formData, "description") || null,
      photoUrl: str(formData, "photoUrl") || null,
      shelf: str(formData, "shelf") || null,
      pickupCode: pickupCode(),
      receivedById: session.user.id,
    })
    .returning();

  const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
  await notify(
    condoId,
    await unitResidents(condoId, unitId),
    "Nova encomenda na portaria",
    `${parcel.carrier ?? "Encomenda"} recebida. Código de retirada: ${parcel.pickupCode}. Local: ${parcel.shelf ?? "portaria"}.`,
    "/painel/encomendas",
  );
  await logAudit({
    session,
    condoId,
    action: "criar",
    entity: "encomenda",
    entityId: parcel.id,
    summary: `Registrou ${parcel.code} para unidade ${unit?.number ?? unitId}`,
    origin: "portaria",
  });
  revalidatePath("/painel/encomendas");
  revalidatePath("/painel/portaria");
}

export async function deliverParcelAction(formData: FormData) {
  const { session, condoId } = await requireRole(GATE);
  const id = num(formData, "id");
  const [parcel] = await db.select().from(parcels).where(eq(parcels.id, id)).limit(1);
  if (!parcel || parcel.condoId !== condoId || parcel.status !== "pendente") return;
  const informed = str(formData, "pickupCode");
  if (informed && informed !== parcel.pickupCode) {
    await logAudit({
      session,
      condoId,
      action: "codigo_invalido",
      entity: "encomenda",
      entityId: id,
      summary: `Código de retirada inválido informado para ${parcel.code}`,
      critical: true,
      origin: "portaria",
    });
    return;
  }
  await db
    .update(parcels)
    .set({
      status: "entregue",
      pickedUpAt: new Date(),
      pickedUpBy: str(formData, "pickedUpBy", "Morador"),
      pickedUpDocument: str(formData, "pickedUpDocument") || null,
      signature: str(formData, "signature") || str(formData, "pickedUpBy") || null,
      notes: str(formData, "notes") || parcel.notes,
    })
    .where(eq(parcels.id, id));
  await notify(
    condoId,
    await unitResidents(condoId, parcel.unitId),
    "Encomenda retirada",
    `${parcel.code} foi retirada por ${str(formData, "pickedUpBy", "morador")}.`,
    "/painel/encomendas",
  );
  await logAudit({
    session,
    condoId,
    action: "entregar",
    entity: "encomenda",
    entityId: id,
    summary: `Entregou ${parcel.code} para ${str(formData, "pickedUpBy", "morador")}`,
    critical: true,
    origin: "portaria",
  });
  revalidatePath("/painel/encomendas");
  revalidatePath("/painel/portaria");
}

/* --------------------------------------------------------------- TURNOS */

export async function openShiftAction(formData: FormData) {
  const { session, condoId } = await requireRole(GATE);
  const checklistKeys = ["radios", "chaves", "cameras", "extintores", "interfone"];
  const checklist: Record<string, boolean> = {};
  for (const key of checklistKeys) checklist[key] = bool(formData, key);
  const [shift] = await db
    .insert(shifts)
    .values({ condoId, userId: session.user.id, period: str(formData, "period", "manha"), checklist })
    .returning();
  await logAudit({
    session,
    condoId,
    action: "abrir_turno",
    entity: "turno",
    entityId: shift.id,
    summary: `Abriu turno ${shift.period}`,
    origin: "portaria",
    critical: true,
  });
  revalidatePath("/painel/turnos");
  revalidatePath("/painel/portaria");
}

export async function closeShiftAction(formData: FormData) {
  const { session, condoId } = await requireRole(GATE);
  const id = num(formData, "id");
  const [shift] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
  if (!shift || shift.condoId !== condoId || shift.status !== "aberto") return;
  await db
    .update(shifts)
    .set({
      status: "encerrado",
      endedAt: new Date(),
      handoverToId: num(formData, "handoverToId") || null,
      handoverNotes: str(formData, "handoverNotes"),
      pendingItems: str(formData, "pendingItems") || null,
    })
    .where(eq(shifts.id, id));
  const nextUser = num(formData, "handoverToId");
  if (nextUser) {
    await notify(condoId, [nextUser], "Passagem de turno registrada", str(formData, "handoverNotes", "Sem observações."), "/painel/turnos");
  }
  await logAudit({
    session,
    condoId,
    action: "encerrar_turno",
    entity: "turno",
    entityId: id,
    summary: `Encerrou turno ${shift.period} com passagem de serviço`,
    origin: "portaria",
    critical: true,
  });
  revalidatePath("/painel/turnos");
  revalidatePath("/painel/portaria");
}

/* ---------------------------------------------------------- OCORRÊNCIAS */

export async function createOccurrenceAction(formData: FormData) {
  const { session, condoId } = await requireRole([...GATE, "conselho"]);
  const [openShift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.condoId, condoId), eq(shifts.status, "aberto")))
    .orderBy(desc(shifts.startedAt))
    .limit(1);

  const [occurrence] = await db
    .insert(occurrences)
    .values({
      condoId,
      shiftId: openShift?.id ?? null,
      code: await nextCode("occurrence", condoId),
      visibility: str(formData, "visibility", "publica"),
      category: str(formData, "category", "seguranca"),
      severity: str(formData, "severity", "baixa"),
      title: str(formData, "title"),
      description: str(formData, "description"),
      actionsTaken: str(formData, "actionsTaken") || null,
      occurredAt: maybeDate(formData, "occurredAt") ?? new Date(),
      reportedById: session.user.id,
      unitId: num(formData, "unitId") || null,
      attachments: str(formData, "attachments") ? str(formData, "attachments").split(",").map((s) => s.trim()) : [],
    })
    .returning();

  await logAudit({
    session,
    condoId,
    action: "criar",
    entity: "ocorrencia",
    entityId: occurrence.id,
    summary: `Registrou ${occurrence.code} (${occurrence.visibility}) - ${occurrence.title}`,
    after: { severity: occurrence.severity, category: occurrence.category },
    critical: true,
    origin: "portaria",
  });
  revalidatePath("/painel/livro");
  revalidatePath("/painel/portaria");
}

export async function ackOccurrenceAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico", "conselho"]);
  const id = num(formData, "id");
  await db
    .update(occurrences)
    .set({ ackById: session.user.id, ackAt: new Date() })
    .where(and(eq(occurrences.id, id), eq(occurrences.condoId, condoId)));
  await logAudit({
    session,
    condoId,
    action: "ciencia",
    entity: "ocorrencia",
    entityId: id,
    summary: `Deu ciência na ocorrência #${id}`,
    critical: true,
  });
  revalidatePath("/painel/livro");
}

export async function addOccurrenceFollowUpAction(formData: FormData) {
  const { session, condoId } = await requireRole([...GATE, "conselho"]);
  const id = num(formData, "id");
  const [occurrence] = await db.select().from(occurrences).where(eq(occurrences.id, id)).limit(1);
  if (!occurrence || occurrence.condoId !== condoId) return;
  const addition = str(formData, "addition");
  if (!addition) return;
  const stamp = new Date().toLocaleString("pt-BR");
  const merged = `${occurrence.actionsTaken ?? ""}\n[${stamp} · ${session.user.name}] ${addition}`.trim();
  await db.update(occurrences).set({ actionsTaken: merged }).where(eq(occurrences.id, id));
  await logAudit({
    session,
    condoId,
    action: "complementar",
    entity: "ocorrencia",
    entityId: id,
    summary: `Complementou ações da ocorrência ${occurrence.code}`,
    before: { actionsTaken: occurrence.actionsTaken },
    after: { actionsTaken: merged },
    critical: true,
  });
  revalidatePath("/painel/livro");
}
