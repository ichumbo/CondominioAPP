import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeed } from "@/db/seed";
import { auditLogs, blocks, charges, contracts, memberships, occurrences, parcels, transactions, units, users, vendors, visitors, visits } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dateTimeBR, money } from "@/lib/utils";

export const dynamic = "force-dynamic";

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "sem registros\n";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(";"), ...rows.map((row) => headers.map((h) => escape(row[h])).join(";"))].join("\n");
}

export async function GET(_request: Request, { params }: { params: Promise<{ entity: string }> }) {
  await ensureSeed();
  const { entity } = await params;
  const { session, condoId } = await requireCondo();
  let rows: Record<string, unknown>[] = [];

  if (entity === "moradores") {
    const data = await db
      .select({ nome: users.name, email: users.email, telefone: users.phone, perfil: memberships.role, situacao: memberships.status, bloco: blocks.name, unidade: units.number })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(units, eq(units.id, memberships.unitId))
      .leftJoin(blocks, eq(blocks.id, units.blockId))
      .where(eq(memberships.condoId, condoId));
    rows = data;
  } else if (entity === "ocorrencias") {
    const data = await db
      .select({ codigo: occurrences.code, titulo: occurrences.title, visibilidade: occurrences.visibility, gravidade: occurrences.severity, categoria: occurrences.category, ocorrido_em: occurrences.occurredAt, acoes: occurrences.actionsTaken })
      .from(occurrences)
      .where(eq(occurrences.condoId, condoId))
      .orderBy(desc(occurrences.occurredAt));
    rows = data.map((r) => ({ ...r, ocorrido_em: dateTimeBR(r.ocorrido_em) }));
  } else if (entity === "visitantes") {
    const data = await db
      .select({ visitante: visitors.name, documento: visitors.document, tipo: visitors.kind, empresa: visitors.company, status: visits.status, entrada: visits.checkinAt, saida: visits.checkoutAt, unidade: units.number, bloco: blocks.name })
      .from(visits)
      .innerJoin(visitors, eq(visitors.id, visits.visitorId))
      .leftJoin(units, eq(units.id, visits.unitId))
      .leftJoin(blocks, eq(blocks.id, units.blockId))
      .where(eq(visits.condoId, condoId))
      .orderBy(desc(visits.createdAt));
    rows = data.map((r) => ({ ...r, entrada: dateTimeBR(r.entrada), saida: dateTimeBR(r.saida) }));
  } else if (entity === "encomendas") {
    const data = await db
      .select({ codigo: parcels.code, tipo: parcels.kind, transportadora: parcels.carrier, status: parcels.status, recebida: parcels.receivedAt, retirada: parcels.pickedUpAt, retirada_por: parcels.pickedUpBy, unidade: units.number })
      .from(parcels)
      .leftJoin(units, eq(units.id, parcels.unitId))
      .where(eq(parcels.condoId, condoId))
      .orderBy(desc(parcels.receivedAt));
    rows = data.map((r) => ({ ...r, recebida: dateTimeBR(r.recebida), retirada: dateTimeBR(r.retirada) }));
  } else if (entity === "financeiro") {
    const data = await db
      .select({ tipo: transactions.kind, descricao: transactions.description, categoria: transactions.category, centro_custo: transactions.costCenter, valor: transactions.amountCents, vencimento: transactions.dueDate, pagamento: transactions.paidDate, status: transactions.status })
      .from(transactions)
      .where(eq(transactions.condoId, condoId))
      .orderBy(desc(transactions.dueDate));
    const cobrancas = await db
      .select({ referencia: charges.reference, valor: charges.amountCents, vencimento: charges.dueDate, status: charges.status, unidade: units.number })
      .from(charges)
      .leftJoin(units, eq(units.id, charges.unitId))
      .where(and(eq(charges.condoId, condoId), eq(charges.status, "vencida")));
    rows = [
      ...data.map((r) => ({ ...r, valor: money(r.valor) })),
      ...cobrancas.map((c) => ({ tipo: "cobranca", descricao: `Unidade ${c.unidade}`, categoria: "taxa_condominial", centro_custo: "-", valor: money(c.valor), vencimento: c.vencimento, pagamento: "", status: c.status })),
    ];
  } else if (entity === "contratos") {
    const data = await db
      .select({ contrato: contracts.title, fornecedor: vendors.name, inicio: contracts.startAt, fim: contracts.endAt, valor: contracts.valueCents, ciclo: contracts.billingCycle, indice: contracts.adjustmentIndex, status: contracts.status })
      .from(contracts)
      .innerJoin(vendors, eq(vendors.id, contracts.vendorId))
      .where(eq(contracts.condoId, condoId));
    rows = data.map((r) => ({ ...r, valor: money(r.valor) }));
  } else if (entity === "auditoria") {
    const data = await db
      .select({ data: auditLogs.createdAt, usuario: auditLogs.userName, acao: auditLogs.action, entidade: auditLogs.entity, registro: auditLogs.entityId, resumo: auditLogs.summary, ip: auditLogs.ip, origem: auditLogs.origin, critico: auditLogs.critical })
      .from(auditLogs)
      .where(eq(auditLogs.condoId, condoId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1000);
    rows = data.map((r) => ({ ...r, data: dateTimeBR(r.data) }));
  } else {
    return new Response("Exportação não suportada", { status: 404 });
  }

  await logAudit({
    session,
    condoId,
    action: "exportar",
    entity: `exportacao_${entity}`,
    summary: `Exportou ${rows.length} registro(s) de ${entity}`,
    critical: true,
  });

  return new Response(`\ufeff${toCsv(rows)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
