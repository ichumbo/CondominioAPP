import Link from "next/link";
import { and, count, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { charges, contracts, maintenancePlans, transactions } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Stat, StatCard } from "@/components/ui";
import { Icon, type IconName } from "@/components/icon";
import { addDays, isoDate, money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const { condoId } = await requireRole(["superadmin", "sindico", "conselho"]);
  const today = isoDate();
  const expiringUntil = isoDate(addDays(45));

  const tx = await db
    .select({ kind: transactions.kind, amount: transactions.amountCents })
    .from(transactions)
    .where(eq(transactions.condoId, condoId));
  const income = tx.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
  const expense = tx.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);

  const [overdue] = await db
    .select({ n: count(), total: sql<number>`coalesce(sum(${charges.amountCents}),0)::int` })
    .from(charges)
    .where(and(eq(charges.condoId, condoId), eq(charges.status, "vencida")));

  const [lateMaint] = await db
    .select({ n: count() })
    .from(maintenancePlans)
    .where(and(eq(maintenancePlans.condoId, condoId), lte(maintenancePlans.nextDueAt, today)));

  const [expiring] = await db
    .select({ n: count() })
    .from(contracts)
    .where(and(eq(contracts.condoId, condoId), lte(contracts.endAt, expiringUntil)));

  const hubs: { href: string; title: string; desc: string; icon: IconName; export?: string }[] = [
    { href: "/painel/financeiro", title: "Prestação de contas", desc: "Receitas, despesas, orçado x realizado e inadimplência.", icon: "wallet", export: "financeiro" },
    { href: "/painel/manutencao", title: "Manutenção", desc: "Equipamentos, planos preventivos, custos e falhas.", icon: "wrench" },
    { href: "/painel/fornecedores", title: "Contratos", desc: "Vigências, reajustes e vencimentos.", icon: "briefcase", export: "contratos" },
    { href: "/painel/auditoria", title: "Auditoria", desc: "Trilha completa de ações e acessos.", icon: "lock", export: "auditoria" },
  ];

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores consolidados e exportações para prestação de contas e gestão."
        actions={<a href="/api/export/financeiro" download className="btn-primary btn-sm"><Icon name="download" size={15} /> Exportar contas</a>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Receitas" value={money(income)} icon="wallet" href="/painel/financeiro" />
        <StatCard label="Despesas" value={money(expense)} icon="wallet" href="/painel/financeiro" />
        <Stat label="Inadimplência" value={money(overdue.total)} tone="red" hint={`${overdue.n} cobranças vencidas`} />
        <Stat label="Contratos a vencer" value={expiring.n} tone="amber" hint="próximos 45 dias" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {hubs.map((h) => (
          <Card key={h.href} className="surface-hover">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon name={h.icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-ink)]">{h.title}</p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">{h.desc}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Link href={h.href} className="btn-link text-xs">Abrir módulo</Link>
                  {h.export ? <a href={`/api/export/${h.export}`} download className="btn-link text-xs"><Icon name="download" size={13} /> CSV</a> : null}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <EmptyState
          title="Exportações adicionais"
          description="Moradores, visitantes, encomendas e ocorrências podem ser exportados em CSV nas respectivas páginas."
          icon="download"
        />
      </div>
    </>
  );
}
