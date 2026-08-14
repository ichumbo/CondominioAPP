"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  blocks,
  documents,
  importJobs,
  memberships,
  pollOptions,
  pollVotes,
  polls,
  reservations,
  ticketComments,
  tickets,
  units,
  users,
} from "@/db/schema";
import { requireCondo, requireRole, hashPassword } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { ALL_STAFF } from "@/lib/rbac";
import { bool, maybeDate, num, sequence, str } from "@/lib/utils";
import { assistNote, suggestCategory, suggestPriority, summarize } from "@/lib/ai";

async function condoResidentIds(condoId: number) {
  const rows = await db.select({ userId: memberships.userId }).from(memberships).where(eq(memberships.condoId, condoId));
  return rows.map((r) => r.userId);
}

/* ------------------------------------------------------------ COMUNICADOS */

export async function createAnnouncementAction(formData: FormData) {
  const { session, condoId } = await requireRole([...ALL_STAFF, "porteiro"]);
  const title = str(formData, "title");
  if (!title) return;
  const [row] = await db
    .insert(announcements)
    .values({
      condoId,
      title,
      body: str(formData, "body"),
      category: str(formData, "category", "geral"),
      priority: str(formData, "priority", "normal"),
      audience: str(formData, "audience", "todos"),
      blockId: num(formData, "blockId") || null,
      pinned: bool(formData, "pinned"),
      showOnTv: bool(formData, "showOnTv"),
      authorId: session.user.id,
      publishedAt: new Date(),
      expiresAt: maybeDate(formData, "expiresAt"),
    })
    .returning();
  await notify(condoId, await condoResidentIds(condoId), `Novo comunicado: ${title}`, summarize(str(formData, "body"), 140), "/painel/comunicados");
  await logAudit({ session, condoId, action: "publicar", entity: "comunicado", entityId: row.id, summary: `Publicou "${title}"`, after: { title } });
  revalidatePath("/painel/comunicados");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const id = num(formData, "id");
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row || row.condoId !== condoId) return;
  await db.delete(announcements).where(eq(announcements.id, id));
  await logAudit({ session, condoId, action: "excluir", entity: "comunicado", entityId: id, summary: `Removeu "${row.title}"`, before: { title: row.title }, critical: true });
  revalidatePath("/painel/comunicados");
}

/* ---------------------------------------------------------------- CHAMADOS */

export async function createTicketAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const title = str(formData, "title");
  const description = str(formData, "description");
  if (!title || !description) return;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.condoId, condoId));
  const priority = suggestPriority(`${title} ${description}`);
  const category = str(formData, "category") || suggestCategory(`${title} ${description}`);
  const [ticket] = await db
    .insert(tickets)
    .values({
      condoId,
      code: sequence("CH", Number(row?.n ?? 0) + 1),
      unitId: session.role === "morador" ? session.unitId : num(formData, "unitId") || null,
      title,
      description,
      category,
      priority: str(formData, "priority") || priority,
      aiPriority: priority,
      aiSummary: assistNote(priority, category),
      openedById: session.user.id,
      dueAt: new Date(Date.now() + (priority === "alta" ? 1 : priority === "media" ? 3 : 7) * 86400000),
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "chamado", entityId: ticket.id, summary: `Abriu ${ticket.code}: ${title}` });
  revalidatePath("/painel/chamados");
}

export async function updateTicketAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const id = num(formData, "id");
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (!ticket || ticket.condoId !== condoId) return;
  const status = str(formData, "status", ticket.status);
  const values: Partial<typeof tickets.$inferInsert> = {
    status,
    priority: str(formData, "priority", ticket.priority),
    assignedToId: num(formData, "assignedToId") || ticket.assignedToId,
    closedAt: status === "concluido" ? new Date() : null,
  };
  await db.update(tickets).set(values).where(eq(tickets.id, id));
  if (ticket.openedById) {
    await notify(condoId, [ticket.openedById], `Chamado ${ticket.code} atualizado`, `Status: ${status}`, "/painel/chamados");
  }
  await logAudit({
    session, condoId, action: "atualizar", entity: "chamado", entityId: id,
    summary: `Alterou ${ticket.code} para ${status}`, before: { status: ticket.status }, after: { status },
  });
  revalidatePath("/painel/chamados");
}

export async function commentTicketAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const ticketId = num(formData, "ticketId");
  const body = str(formData, "body");
  if (!ticketId || !body) return;
  await db.insert(ticketComments).values({ ticketId, userId: session.user.id, body, internal: bool(formData, "internal") });
  await logAudit({ session, condoId, action: "comentar", entity: "chamado", entityId: ticketId, summary: summarize(body, 120) });
  revalidatePath("/painel/chamados");
}

export async function rateTicketAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const id = num(formData, "id");
  await db
    .update(tickets)
    .set({ rating: num(formData, "rating", 5), ratingComment: str(formData, "ratingComment") || null })
    .where(and(eq(tickets.id, id), eq(tickets.condoId, condoId)));
  await logAudit({ session, condoId, action: "avaliar", entity: "chamado", entityId: id, summary: `Pesquisa de satisfação: ${num(formData, "rating", 5)}/5` });
  revalidatePath("/painel/chamados");
}

/* ---------------------------------------------------------------- RESERVAS */

export async function createReservationAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const amenityId = num(formData, "amenityId");
  const date = str(formData, "date");
  if (!amenityId || !date) return;
  const start = str(formData, "startTime", "10:00");
  const end = str(formData, "endTime", "12:00");

  const clash = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.condoId, condoId),
        eq(reservations.amenityId, amenityId),
        eq(reservations.date, date),
        inArray(reservations.status, ["pendente", "aprovada"]),
        sql`${reservations.startTime} < ${end} and ${reservations.endTime} > ${start}`,
      ),
    )
    .limit(1);
  if (clash.length > 0) return;

  const [row] = await db
    .insert(reservations)
    .values({
      condoId,
      amenityId,
      unitId: session.role === "morador" ? session.unitId : num(formData, "unitId") || session.unitId,
      userId: session.user.id,
      date,
      startTime: start,
      endTime: end,
      guests: num(formData, "guests"),
      notes: str(formData, "notes") || null,
      status: ["sindico", "superadmin"].includes(session.role) ? "aprovada" : "pendente",
      qrToken: Math.random().toString(36).slice(2, 10).toUpperCase(),
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "reserva", entityId: row.id, summary: `Reserva em ${date} ${start}-${end}` });
  revalidatePath("/painel/reservas");
}

export async function decideReservationAction(formData: FormData) {
  const { session, condoId } = await requireRole([...ALL_STAFF]);
  const id = num(formData, "id");
  const status = str(formData, "status", "aprovada");
  const [row] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  if (!row || row.condoId !== condoId) return;
  await db.update(reservations).set({ status }).where(eq(reservations.id, id));
  if (row.userId) await notify(condoId, [row.userId], `Reserva ${status}`, `Sua reserva de ${row.date} foi ${status}.`, "/painel/reservas");
  await logAudit({ session, condoId, action: "decidir", entity: "reserva", entityId: id, summary: `Reserva ${status}`, before: { status: row.status }, after: { status } });
  revalidatePath("/painel/reservas");
}

/* -------------------------------------------------------------- DOCUMENTOS */

export async function createDocumentAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const title = str(formData, "title");
  if (!title) return;
  const [row] = await db
    .insert(documents)
    .values({
      condoId,
      title,
      category: str(formData, "category", "geral"),
      description: str(formData, "description") || null,
      fileName: str(formData, "fileName") || `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      fileUrl: str(formData, "fileUrl") || null,
      sizeKb: num(formData, "sizeKb", 320),
      visibility: str(formData, "visibility", "moradores"),
      version: str(formData, "version", "1.0"),
      uploadedById: session.user.id,
    })
    .returning();
  await logAudit({ session, condoId, action: "criar", entity: "documento", entityId: row.id, summary: `Publicou documento ${title}` });
  revalidatePath("/painel/documentos");
}

/* ---------------------------------------------------------------- ENQUETES */

export async function createPollAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const question = str(formData, "question");
  if (!question) return;
  const [poll] = await db
    .insert(polls)
    .values({
      condoId,
      question,
      description: str(formData, "description") || null,
      endsAt: maybeDate(formData, "endsAt"),
      createdById: session.user.id,
    })
    .returning();
  const options = str(formData, "options")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  if (options.length > 0) {
    await db.insert(pollOptions).values(options.map((label) => ({ pollId: poll.id, label })));
  }
  await notify(condoId, await condoResidentIds(condoId), "Nova enquete disponível", question, "/painel/enquetes");
  await logAudit({ session, condoId, action: "criar", entity: "enquete", entityId: poll.id, summary: question });
  revalidatePath("/painel/enquetes");
}

export async function votePollAction(formData: FormData) {
  const { session, condoId } = await requireCondo();
  const pollId = num(formData, "pollId");
  const optionId = num(formData, "optionId");
  if (!pollId || !optionId) return;
  const existing = await db
    .select({ id: pollVotes.id })
    .from(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, session.user.id)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(pollVotes).values({ pollId, optionId, userId: session.user.id, unitId: session.unitId });
  await logAudit({ session, condoId, action: "votar", entity: "enquete", entityId: pollId, summary: "Registrou voto" });
  revalidatePath("/painel/enquetes");
}

export async function closePollAction(formData: FormData) {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const id = num(formData, "id");
  await db.update(polls).set({ status: "encerrada" }).where(and(eq(polls.id, id), eq(polls.condoId, condoId)));
  await logAudit({ session, condoId, action: "encerrar", entity: "enquete", entityId: id, summary: "Encerrou enquete" });
  revalidatePath("/painel/enquetes");
}

/* ------------------------------------------------- MORADORES / UNIDADES --- */

export async function saveBlockAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const name = str(formData, "name");
  if (!name) return;
  await db.insert(blocks).values({ condoId, name, floors: num(formData, "floors", 1) });
  await logAudit({ session, condoId, action: "criar", entity: "bloco", summary: `Criou bloco ${name}` });
  revalidatePath("/painel/moradores");
}

export async function saveUnitAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const number = str(formData, "number");
  if (!number) return;
  await db.insert(units).values({
    condoId,
    blockId: num(formData, "blockId") || null,
    number,
    floor: num(formData, "floor"),
    fraction: str(formData, "fraction", "1.00"),
    kind: str(formData, "kind", "apartamento"),
    parkingSpots: num(formData, "parkingSpots", 1),
  });
  await logAudit({ session, condoId, action: "criar", entity: "unidade", summary: `Criou unidade ${number}` });
  revalidatePath("/painel/moradores");
}

export async function inviteResidentAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const email = str(formData, "email").toLowerCase();
  const name = str(formData, "name");
  if (!email || !name) return;
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ name, email, passwordHash: hashPassword("demo1234"), phone: str(formData, "phone") || null, status: "convidado" })
      .returning();
  }
  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.condoId, condoId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(memberships).values({
      userId: user.id,
      condoId,
      role: str(formData, "role", "morador"),
      unitId: num(formData, "unitId") || null,
      relation: str(formData, "relation", "proprietario"),
      status: "convidado",
      invitedAt: new Date(),
    });
  }
  await logAudit({ session, condoId, action: "convidar", entity: "morador", entityId: user.id, summary: `Convidou ${name} (${email})` });
  revalidatePath("/painel/moradores");
}

export async function bulkMembershipAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const ids = formData.getAll("ids").map((v) => Number(v)).filter(Boolean);
  const operation = str(formData, "operation");
  if (ids.length === 0) return;

  if (operation === "reenviar") {
    await db.update(memberships).set({ invitedAt: new Date() }).where(and(eq(memberships.condoId, condoId), inArray(memberships.userId, ids)));
    await notify(condoId, ids, "Convite reenviado", "Acesse o sistema e defina sua senha para concluir o cadastro.", "/login");
  } else if (operation === "ativar" || operation === "desativar") {
    const status = operation === "ativar" ? "ativo" : "inativo";
    await db.update(memberships).set({ status }).where(and(eq(memberships.condoId, condoId), inArray(memberships.userId, ids)));
    await db.update(users).set({ status: operation === "ativar" ? "ativo" : "bloqueado" }).where(inArray(users.id, ids));
  }
  await logAudit({
    session, condoId, action: `massa_${operation}`, entity: "morador",
    summary: `${operation} aplicado a ${ids.length} usuário(s)`, after: { ids }, critical: true,
  });
  revalidatePath("/painel/moradores");
}

export async function importResidentsAction(formData: FormData) {
  const { session, condoId } = await requireRole(["superadmin", "sindico"]);
  const raw = str(formData, "csv");
  if (!raw) return;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  let ok = 0;

  const blockList = await db.select().from(blocks).where(eq(blocks.condoId, condoId));
  const unitList = await db.select().from(units).where(eq(units.condoId, condoId));

  for (const [index, line] of lines.entries()) {
    if (index === 0 && /bloco/i.test(line)) continue;
    const [blockName, unitNumber, name, email, phone] = line.split(/[;,]/).map((p) => p?.trim() ?? "");
    if (!name || !email) {
      errors.push(`Linha ${index + 1}: nome e e-mail são obrigatórios`);
      continue;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`Linha ${index + 1}: e-mail inválido (${email})`);
      continue;
    }
    const block = blockList.find((b) => b.name.toLowerCase() === blockName.toLowerCase());
    const unit = unitList.find((u) => u.number === unitNumber && (!block || u.blockId === block.id));
    if (unitNumber && !unit) {
      errors.push(`Linha ${index + 1}: unidade ${blockName} ${unitNumber} não encontrada`);
      continue;
    }
    let [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({ name, email: email.toLowerCase(), passwordHash: hashPassword("demo1234"), phone: phone || null, status: "convidado" })
        .returning();
    }
    const exists = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.condoId, condoId)))
      .limit(1);
    if (exists.length === 0) {
      await db.insert(memberships).values({ userId: user.id, condoId, role: "morador", unitId: unit?.id ?? null, status: "convidado", invitedAt: new Date() });
    }
    ok += 1;
  }

  await db.insert(importJobs).values({
    condoId,
    kind: "moradores",
    fileName: str(formData, "fileName", "importacao-manual.csv"),
    total: lines.length,
    succeeded: ok,
    failed: errors.length,
    errors,
    createdById: session.user.id,
  });
  await logAudit({
    session, condoId, action: "importar", entity: "morador",
    summary: `Importou ${ok} morador(es), ${errors.length} erro(s)`, critical: true, after: { ok, errors: errors.length },
  });
  revalidatePath("/painel/moradores");
  revalidatePath("/painel/implantacao");
}
