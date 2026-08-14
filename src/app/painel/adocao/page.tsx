import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, condominiums, importJobs, memberships, supportTickets, units, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Progress, Stat, TableWrap } from "@/components/ui";
import { dateTimeBR, percent } from "@/lib/utils";
import { seedDemoCondoAction } from "@/lib/actions/admin";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

export default async function AdocaoPage() {
  await requireRole(["superadmin"]);

  const condos = await db.select().from(condominiums).orderBy(condominiums.name);

  const memberRows = await db
    .select({
      condoId: memberships.condoId,
      status: memberships.status,
      firstAccessAt: users.firstAccessAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId));

  const unitRows = await db.select({ condoId: units.condoId, n: sql<number>`count(*)::int` }).from(units).groupBy(units.condoId);

  const moduleUsage = await db
    .select({ entity: auditLogs.entity, n: sql<number>`count(*)::int` })
    .from(auditLogs)
    .groupBy(auditLogs.entity)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const imports = await db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(6);
  const support = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(6);
  const activeSince = new Date();
  activeSince.setDate(activeSince.getDate() - 7);

  const rows = condos.map((condo) => {
    const people = memberRows.filter((m) => m.condoId === condo.id);
    const invited = people.filter((m) => m.status === "convidado").length;
    const accessed = people.filter((m) => m.firstAccessAt).length;
    const activeWeek = people.filter((m) => m.lastLoginAt && new Date(m.lastLoginAt) >= activeSince).length;
    return {
      condo,
      people: people.length,
      invited,
      accessed,
      activeWeek,
      firstAccessRate: percent(accessed, people.length),
      onboarding: condo.onboardingDone ? 100 : percent(condo.onboardingStep, 9),
      units: unitRows.find((u) => u.condoId === condo.id)?.n ?? 0,
      storage: percent(condo.storageUsedMb, condo.storageLimitMb),
    };
  });

  const lowUsage = rows.filter((r) => r.firstAccessRate < 60 || r.activeWeek === 0);
  const totalPeople = rows.reduce((a, r) => a + r.people, 0);
  const totalActive = rows.reduce((a, r) => a + r.activeWeek, 0);

  return (
    <>
      <PageHeader
        title="Painel do SaaS · implantação e adoção"
        subtitle="Acompanhe implantação, convites, primeiro acesso, uso por módulo, erros de importação, armazenamento e suporte."
        actions={
          <form action={seedDemoCondoAction}>
            <button className="btn-primary btn-sm"><Icon name="plus" size={15} />Novo condomínio</button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Condomínios" value={condos.length} />
        <Stat label="Usuários totais" value={totalPeople} />
        <Stat label="Ativos (7 dias)" value={totalActive} tone="green" hint={`${percent(totalActive, totalPeople)}% da base`} />
        <Stat label="Contas em risco" value={lowUsage.length} tone="red" hint="baixa utilização" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Carteira de condomínios">
            <TableWrap>
              <thead>
                <tr>
                  <th>Condomínio</th>
                  <th>Plano</th>
                  <th>Implantação</th>
                  <th>1º acesso</th>
                  <th>Convites</th>
                  <th>Armazenamento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.condo.id}>
                    <td>
                      <span className="font-semibold text-[var(--color-ink)]">{r.condo.name}</span>
                      <span className="block text-xs text-[var(--color-subtle)]">
                        {r.units} unidades · {r.people} pessoas · {r.condo.city ?? "—"}
                      </span>
                    </td>
                    <td><Badge tone={r.condo.plan === "enterprise" ? "purple" : r.condo.plan === "pro" ? "blue" : "zinc"}>{r.condo.plan}</Badge></td>
                    <td className="w-40">
                      <Progress value={r.onboarding} tone={r.onboarding === 100 ? "bg-[var(--color-success)]" : "bg-[var(--color-warn)]"} />
                      <span className="text-[11px] text-[var(--color-subtle)]">{r.onboarding}%</span>
                    </td>
                    <td>
                      <Badge tone={r.firstAccessRate >= 70 ? "green" : r.firstAccessRate >= 40 ? "amber" : "red"}>
                        {r.firstAccessRate}%
                      </Badge>
                      <span className="mt-1 block text-[11px] text-[var(--color-subtle)]">{r.activeWeek} ativos/7d</span>
                    </td>
                    <td className="text-xs">{r.invited} pendentes</td>
                    <td className="w-32">
                      <Progress value={r.storage} tone={r.storage > 80 ? "bg-[var(--color-danger)]" : "bg-[var(--color-primary)]"} />
                      <span className="text-[11px] text-[var(--color-subtle)]">
                        {r.condo.storageUsedMb} / {r.condo.storageLimitMb} MB
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <Card title="Módulos mais utilizados" description="Baseado nos eventos registrados na trilha de auditoria.">
            {moduleUsage.length === 0 ? (
              <EmptyState title="Sem dados de uso" icon="trending" />
            ) : (
              <ul className="space-y-2">
                {moduleUsage.map((m) => (
                  <li key={m.entity}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize text-[var(--color-ink)]">{m.entity.replace("_", " ")}</span>
                      <span className="text-xs text-[var(--color-muted)]">{m.n} eventos</span>
                    </div>
                    <Progress value={percent(m.n, moduleUsage[0]?.n ?? 1)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Erros de importação">
            {imports.length === 0 ? (
              <EmptyState title="Nenhuma importação" icon="📥" />
            ) : (
              <ul className="space-y-2 text-sm">
                {imports.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-line)] px-3 py-2 ">
                    <span>
                      <span className="block font-semibold text-[var(--color-ink)]">{job.fileName}</span>
                      <span className="text-xs text-[var(--color-subtle)]">
                        {condos.find((c) => c.id === job.condoId)?.name} · {dateTimeBR(job.createdAt)}
                      </span>
                    </span>
                    <span className="flex gap-1.5">
                      <Badge tone="green">{job.succeeded}</Badge>
                      {job.failed > 0 ? <Badge tone="red">{job.failed} erros</Badge> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Contas com risco de cancelamento">
            {lowUsage.length === 0 ? (
              <EmptyState title="Todas as contas engajadas" icon="🎯" />
            ) : (
              <ul className="space-y-2 text-xs">
                {lowUsage.map((r) => (
                  <li key={r.condo.id} className="rounded-lg border border-[#f0dfbc] bg-[var(--color-warn-soft)] px-3 py-2 text-[var(--color-warn)]   ">
                    <strong>{r.condo.name}</strong>
                    <p>
                      {r.firstAccessRate}% de primeiro acesso · {r.activeWeek} ativos nos últimos 7 dias · {r.invited} convites pendentes
                    </p>
                    <p className="mt-1 font-semibold">Ação sugerida: reenviar convites e agendar treinamento.</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Chamados de suporte">
            {support.length === 0 ? (
              <EmptyState title="Sem chamados" icon="help" />
            ) : (
              <ul className="space-y-2 text-xs">
                {support.map((t) => (
                  <li key={t.id} className="rounded-lg border border-[var(--color-line)] px-3 py-2 ">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--color-ink)]">{t.subject}</span>
                      <Badge tone={t.status === "aberto" ? "amber" : "green"}>{t.status}</Badge>
                    </div>
                    <p className="text-[var(--color-subtle)]">{condos.find((c) => c.id === t.condoId)?.name}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <InfoNote>
            Indicadores de adoção ajudam a antecipar cancelamentos: baixo primeiro acesso, convites pendentes e módulos
            sem uso disparam ações de sucesso do cliente.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
