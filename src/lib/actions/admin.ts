"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assemblies,
  assemblyAgenda,
  assemblyAttendance,
  assemblyVotes,
  assets,
  charges,
  condominiums,
  contracts,
  lostItems,
  maintenanceOrders,
  maintenancePlans,
  moveRequests,
  supportTickets,
  transactions,
  units,
  vendors,
} from "@/db/schema";
import { requireCondo, requireRole } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { ALL_STAFF } from "@/lib/rbac";
import { addDays, bool, cents, isoDate, maybeDate, num, str } from "@/lib/utils";

const FINANCE = ["superadmin", "sindico", "conselho"] as const;

/* -------------------------------------------------------- MANUTENÇÃO ---- */

export async function saveAssetAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const name = str(formData, "name");
  if (!name) return;
  const [row] = await db
    .insert(assets)
    .values({
      condoId,
      name,
      category: str(formData, "category", "equipamento"),
      location: str(formData, "location") || null,
      brand: str(formData, "brand") || null,
      serial: str(formData, "serial") || null,
      installedAt: str(formData, "installedAt") || null,
      status: str(formData, "status", "operacional"),
      notes: str(formData, "notes") || null,
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "equipamento", entityId: row.id, summary: `Cadastrou ${name}` });
  revalidatePath("/painel/manutencao");
}

export async function savePlanAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const title = str(formData, "title");
  if (!title) return;
  const frequency = num(formData, "frequencyDays", 30);
  const [row] = await db
    .insert(maintenancePlans)
    .values({
      condoId,
      assetId: num(formData, "assetId") || null,
      title,
      frequencyDays: frequency,
      vendorId: num(formData, "vendorId") || null,
      responsible: str(formData, "responsible") || null,
      nextDueAt: str(formData, "nextDueAt") || isoDate(addDays(frequency)),
      checklist: str(formData, "checklist") ? str(formData, "checklist").split("\n").map((s) => s.trim()).filter(Boolean) : [],
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "plano_manutencao", entityId: row.id, summary: title });
  revalidatePath("/painel/manutencao");
}

export async function saveOrderAction(formData: FormData) {
  const { session, condoId } = await requireRole([...ALL_STAFF, "porteiro"]);
  const title = str(formData, "title");
  if (!title) return;
  const [row] = await db
    .insert(maintenanceOrders)
    .values({
      condoId,
      assetId: num(formData, "assetId") || null,
      planId: num(formData, "planId") || null,
      kind: str(formData, "kind", "corretiva"),
      title,
      description: str(formData, "description") || null,
      scheduledFor: str(formData, "scheduledFor") || isoDate(),
      status: "programada",
      vendorId: num(formData, "vendorId") || null,
      technician: str(formData, "technician") || null,
      costCents: cents(formData, "cost"),
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "ordem_manutencao", entityId: row.id, summary: title });
  revalidatePath("/painel/manutencao");
}

export async function completeOrderAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const id = num(formData, "id");
  const [order] = await db.select().from(maintenanceOrders).where(eq(maintenanceOrders.id, id)).limit(1);
  if (!order || order.condoId !== condoId) return;
  await db
    .update(maintenanceOrders)
    .set({ status: "concluida", completedAt: isoDate(), report: str(formData, "report") || null })
    .where(eq(maintenanceOrders.id, id));
  if (order.planId) {
    const [plan] = await db.select().from(maintenancePlans).where(eq(maintenancePlans.id, order.planId)).limit(1);
    if (plan) {
      await db
        .update(maintenancePlans)
        .set({ lastDoneAt: isoDate(), nextDueAt: isoDate(addDays(plan.frequencyDays)) })
        .where(eq(maintenancePlans.id, plan.id));
    }
  }
  await logAudit({ session, condoId, action: "concluir", entity: "ordem_manutencao", entityId: id, summary: `Concluiu ${order.title}` });
  revalidatePath("/painel/manutencao");
}

/* ---------------------------------------------- FORNECEDORES / CONTRATOS */

export async function saveVendorAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const name = str(formData, "name");
  if (!name) return;
  const [row] = await db
    .insert(vendors)
    .values({
      condoId,
      name,
      cnpj: str(formData, "cnpj") || null,
      category: str(formData, "category", "servicos"),
      contactName: str(formData, "contactName") || null,
      phone: str(formData, "phone") || null,
      email: str(formData, "email") || null,
      rating: num(formData, "rating", 0),
      notes: str(formData, "notes") || null,
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "fornecedor", entityId: row.id, summary: name });
  revalidatePath("/painel/fornecedores");
}

export async function rateVendorAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const id = num(formData, "id");
  const rating = num(formData, "rating", 5);
  await db.update(vendors).set({ rating }).where(and(eq(vendors.id, id), eq(vendors.condoId, condoId)));
  await logAudit({ session, condoId, action: "avaliar", entity: "fornecedor", entityId: id, summary: `Avaliação ${rating}/5` });
  revalidatePath("/painel/fornecedores");
}

export async function saveContractAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const title = str(formData, "title");
  const vendorId = num(formData, "vendorId");
  if (!title || !vendorId) return;
  const [row] = await db
    .insert(contracts)
    .values({
      condoId,
      vendorId,
      title,
      object: str(formData, "object") || null,
      startAt: str(formData, "startAt", isoDate()),
      endAt: str(formData, "endAt", isoDate(addDays(365))),
      noticeDays: num(formData, "noticeDays", 30),
      valueCents: cents(formData, "value"),
      billingCycle: str(formData, "billingCycle", "mensal"),
      adjustmentIndex: str(formData, "adjustmentIndex", "IGPM"),
      documentUrl: str(formData, "documentUrl") || null,
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "contrato", entityId: row.id, summary: title, critical: true });
  revalidatePath("/painel/fornecedores");
}

/* -------------------------------------------------------- ASSEMBLEIAS -- */

export async function createAssemblyAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const title = str(formData, "title");
  const firstCall = maybeDate(formData, "firstCallAt");
  if (!title || !firstCall) return;
  const [assembly] = await db
    .insert(assemblies)
    .values({
      condoId,
      title,
      kind: str(formData, "kind", "ordinaria"),
      mode: str(formData, "mode", "hibrida"),
      firstCallAt: firstCall,
      secondCallAt: maybeDate(formData, "secondCallAt"),
      location: str(formData, "location") || null,
      onlineLink: str(formData, "onlineLink") || null,
      quorumFirst: num(formData, "quorumFirst", 50),
      quorumSecond: num(formData, "quorumSecond", 25),
      createdById: session.user.id,
    })
    .returning();

  const agenda = str(formData, "agenda").split("\n").map((s) => s.trim()).filter(Boolean);
  if (agenda.length > 0) {
    await db.insert(assemblyAgenda).values(
      agenda.map((item, index) => ({
        assemblyId: assembly.id,
        position: index + 1,
        title: item,
        votingType: str(formData, "votingType", "unidade"),
      })),
    );
  }
  await logAudit({ session, condoId, action: "convocar", entity: "assembleia", entityId: assembly.id, summary: title, critical: true });
  revalidatePath("/painel/assembleias");
}

export async function confirmAttendanceAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const assemblyId = num(formData, "assemblyId");
  if (!assemblyId) return;
  const unitId = session.role === "morador" ? session.unitId : num(formData, "unitId") || null;
  const existing = await db
    .select({ id: assemblyAttendance.id })
    .from(assemblyAttendance)
    .where(and(eq(assemblyAttendance.assemblyId, assemblyId), eq(assemblyAttendance.userId, session.user.id)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(assemblyAttendance).values({
    assemblyId,
    unitId,
    userId: session.user.id,
    status: str(formData, "status", "confirmado"),
    proxyForUnitId: num(formData, "proxyForUnitId") || null,
    proxyDoc: str(formData, "proxyDoc") || null,
  });
  await logAudit({ session, condoId, action: "confirmar_presenca", entity: "assembleia", entityId: assemblyId, summary: "Confirmou presença" });
  revalidatePath("/painel/assembleias");
}

export async function voteAssemblyAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const assemblyId = num(formData, "assemblyId");
  const agendaId = num(formData, "agendaId");
  const choice = str(formData, "choice");
  if (!assemblyId || !agendaId || !choice) return;
  const unitId = session.role === "morador" ? session.unitId : num(formData, "unitId") || null;
  const existing = await db
    .select({ id: assemblyVotes.id })
    .from(assemblyVotes)
    .where(and(eq(assemblyVotes.agendaId, agendaId), eq(assemblyVotes.userId, session.user.id)))
    .limit(1);
  if (existing.length > 0) return;
  let weight = "1.00";
  if (unitId) {
    const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
    weight = unit?.fraction ?? "1.00";
  }
  await db.insert(assemblyVotes).values({ assemblyId, agendaId, unitId, userId: session.user.id, choice, weight });
  await logAudit({ session, condoId, action: "votar", entity: "assembleia_pauta", entityId: agendaId, summary: `Voto ${choice}`, critical: true });
  revalidatePath("/painel/assembleias");
}

export async function publishMinutesAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const id = num(formData, "id");
  await db
    .update(assemblies)
    .set({ minutes: str(formData, "minutes"), recordingUrl: str(formData, "recordingUrl") || null, status: "encerrada" })
    .where(and(eq(assemblies.id, id), eq(assemblies.condoId, condoId)));
  await logAudit({ session, condoId, action: "publicar_ata", entity: "assembleia", entityId: id, summary: "Publicou ata e gravação", critical: true });
  revalidatePath("/painel/assembleias");
}

/* ---------------------------------------------------------- FINANCEIRO -- */

export async function saveTransactionAction(formData: FormData) {
  const { session, condoId } = await requireRole([...FINANCE]);
  const description = str(formData, "description");
  if (!description) return;
  const [row] = await db
    .insert(transactions)
    .values({
      condoId,
      kind: str(formData, "kind", "despesa"),
      category: str(formData, "category", "manutencao"),
      costCenter: str(formData, "costCenter", "administracao"),
      description,
      amountCents: cents(formData, "amount"),
      dueDate: str(formData, "dueDate", isoDate()),
      status: "pendente",
      vendorId: num(formData, "vendorId") || null,
      reserveFund: bool(formData, "reserveFund"),
      attachmentUrl: str(formData, "attachmentUrl") || null,
      createdById: session.user.id,
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "lancamento", entityId: row.id, summary: `${row.kind} · ${description}`, critical: true });
  revalidatePath("/painel/financeiro");
}

export async function payTransactionAction(formData: FormData) {
  const { session, condoId } = await requireRole([...FINANCE]);
  const id = num(formData, "id");
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!row || row.condoId !== condoId) return;
  await db.update(transactions).set({ status: "pago", paidDate: isoDate() }).where(eq(transactions.id, id));
  await logAudit({
    session, condoId, action: "baixar", entity: "lancamento", entityId: id,
    summary: `Baixou ${row.description}`, before: { status: row.status }, after: { status: "pago" }, critical: true,
  });
  revalidatePath("/painel/financeiro");
}

export async function registerChargePaymentAction(formData: FormData) {
  const { session, condoId } = await requireRole([...FINANCE]);
  const id = num(formData, "id");
  await db
    .update(charges)
    .set({ status: "paga", paidAt: isoDate(), method: str(formData, "method", "pix") })
    .where(and(eq(charges.id, id), eq(charges.condoId, condoId)));
  await logAudit({ session, condoId, action: "quitar", entity: "cobranca", entityId: id, summary: "Registrou pagamento", critical: true });
  revalidatePath("/painel/financeiro");
}

/* --------------------------------------------- ACHADOS / MUDANÇAS ------- */

export async function saveLostItemAction(formData: FormData) {
  const { session, condoId } = await requireRole([...ALL_STAFF, "porteiro"]);
  const title = str(formData, "title");
  if (!title) return;
  const [row] = await db
    .insert(lostItems)
    .values({
      condoId,
      title,
      description: str(formData, "description") || null,
      photoUrl: str(formData, "photoUrl") || null,
      foundLocation: str(formData, "foundLocation") || null,
      foundAt: str(formData, "foundAt", isoDate()),
      storedLocation: str(formData, "storedLocation", "Portaria"),
      discardAfter: isoDate(addDays(90)),
      registeredById: session.user.id,
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "achado", entityId: row.id, summary: title });
  revalidatePath("/painel/achados");
}

export async function claimLostItemAction(formData: FormData) {
  const { session, condoId } = await requireRole([...ALL_STAFF, "porteiro"]);
  const id = num(formData, "id");
  const status = str(formData, "status", "devolvido");
  await db
    .update(lostItems)
    .set({
      status,
      claimedBy: str(formData, "claimedBy") || null,
      claimedUnitId: num(formData, "claimedUnitId") || null,
      claimedAt: new Date(),
    })
    .where(and(eq(lostItems.id, id), eq(lostItems.condoId, condoId)));
  await logAudit({ session, condoId, action: status, entity: "achado", entityId: id, summary: `Item ${status} para ${str(formData, "claimedBy", "—")}`, critical: true });
  revalidatePath("/painel/achados");
}

export async function createMoveRequestAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const unitId = session.role === "morador" ? session.unitId : num(formData, "unitId");
  if (!unitId) return;
  const [row] = await db
    .insert(moveRequests)
    .values({
      condoId,
      unitId,
      requestedById: session.user.id,
      kind: str(formData, "kind", "mudanca"),
      scheduledDate: str(formData, "scheduledDate", isoDate()),
      startTime: str(formData, "startTime", "08:00"),
      endTime: str(formData, "endTime", "17:00"),
      elevator: str(formData, "elevator", "Serviço"),
      carrierName: str(formData, "carrierName") || null,
      carrierDoc: str(formData, "carrierDoc") || null,
      vehiclePlate: str(formData, "vehiclePlate").toUpperCase() || null,
      workers: str(formData, "workers") || null,
      description: str(formData, "description") || null,
      artUrl: str(formData, "artUrl") || null,
      termAccepted: bool(formData, "termAccepted"),
      deadlineAt: str(formData, "deadlineAt") || null,
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "mudanca_obra", entityId: row.id, summary: `${row.kind} em ${row.scheduledDate}` });
  revalidatePath("/painel/mudancas");
}

export async function decideMoveRequestAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const id = num(formData, "id");
  const status = str(formData, "status", "aprovada");
  const [row] = await db.select().from(moveRequests).where(eq(moveRequests.id, id)).limit(1);
  if (!row || row.condoId !== condoId) return;
  await db
    .update(moveRequests)
    .set({ status, reviewedById: session.user.id, reviewNotes: str(formData, "reviewNotes") || null })
    .where(eq(moveRequests.id, id));
  if (row.requestedById) {
    await notify(condoId, [row.requestedById], `Solicitação ${status}`, `Sua solicitação de ${row.kind} foi ${status}.`, "/painel/mudancas");
  }
  await logAudit({ session, condoId, action: "decidir", entity: "mudanca_obra", entityId: id, summary: `Solicitação ${status}`, critical: true });
  revalidatePath("/painel/mudancas");
}

/* --------------------------------------------- IMPLANTAÇÃO / SUPORTE ---- */

export async function updateOnboardingAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const step = num(formData, "step", 1);
  const done = bool(formData, "done");
  await db
    .update(condominiums)
    .set({ onboardingStep: step, onboardingDone: done })
    .where(eq(condominiums.id, condoId));
  await logAudit({ session, condoId, action: "implantacao", entity: "condominio", entityId: condoId, summary: `Etapa ${step}${done ? " · publicado" : ""}` });
  revalidatePath("/painel/implantacao");
}

export async function saveCondoSettingsAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const [before] = await db.select().from(condominiums).where(eq(condominiums.id, condoId)).limit(1);
  const values = {
    name: str(formData, "name", before?.name ?? ""),
    cnpj: str(formData, "cnpj") || null,
    address: str(formData, "address") || null,
    city: str(formData, "city") || null,
    state: str(formData, "state") || null,
    publicPage: bool(formData, "publicPage"),
  };
  await db.update(condominiums).set(values).where(eq(condominiums.id, condoId));
  await logAudit({
    session, condoId, action: "atualizar", entity: "condominio", entityId: condoId,
    summary: "Atualizou dados do condomínio", before: before ? { name: before.name, city: before.city } : null, after: values, critical: true,
  });
  revalidatePath("/painel/implantacao");
}

export async function createSupportTicketAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const subject = str(formData, "subject");
  if (!subject) return;
  const [row] = await db
    .insert(supportTickets)
    .values({
      condoId,
      userId: session.user.id,
      subject,
      body: str(formData, "body"),
      category: str(formData, "category", "duvida"),
      priority: str(formData, "priority", "normal"),
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "suporte", entityId: row.id, summary: subject });
  revalidatePath("/painel/ajuda");
}

export async function answerSupportTicketAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin"]);
  const id = num(formData, "id");
  await db
    .update(supportTickets)
    .set({ answer: str(formData, "answer"), status: "respondido" })
    .where(eq(supportTickets.id, id));
  await logAudit({ session, condoId, action: "responder", entity: "suporte", entityId: id, summary: "Suporte respondeu chamado", origin: "suporte" });
  revalidatePath("/painel/ajuda");
}

export async function rateSupportAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const id = num(formData, "id");
  await db
    .update(supportTickets)
    .set({ satisfaction: num(formData, "satisfaction", 5), status: "encerrado" })
    .where(eq(supportTickets.id, id));
  await logAudit({ session, condoId, action: "avaliar", entity: "suporte", entityId: id, summary: "Pesquisa de satisfação respondida" });
  revalidatePath("/painel/ajuda");
}

export async function seedDemoCondoAction() {
  const { session } = await requireRole(["superadmin"]);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(condominiums);
  const [condo] = await db
    .insert(condominiums)
    .values({
      name: `Condomínio Demonstração ${Number(row?.n ?? 0) + 1}`,
      slug: `demo-${Date.now().toString(36)}`,
      plan: "basico",
      onboardingStep: 1,
      onboardingDone: false,
    })
    .returning();
  await logAudit({ session, condoId: condo.id, action: "criar", entity: "condominio", entityId: condo.id, summary: `Criou ${condo.name}`, critical: true });
  revalidatePath("/painel/adocao");
}
