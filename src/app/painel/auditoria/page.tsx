import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Stat, TableWrap } from "@/components/ui";
import { dateTimeBR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const { condoId } = await requireRole(["superadmin", "sindico", "conselho"]);
  const { q, f } = await searchParams;

  const search = q
    ? or(ilike(auditLogs.userName, `%${q}%`), ilike(auditLogs.entity, `%${q}%`), ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.summary, `%${q}%`))
    : undefined;
  const filter = f === "criticos" ? eq(auditLogs.critical, true) : f === "suporte" ? eq(auditLogs.origin, "suporte") : undefined;

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.condoId, condoId), search, filter))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  const critical = rows.filter((r) => r.critical).length;
  const support = rows.filter((r) => r.origin === "suporte").length;
  const denied = rows.filter((r) => r.action.includes("negado")).length;

  return (
    <>
      <PageHeader
        title="Trilha de auditoria"
        subtitle="Quem fez, quando, de onde, com valores anterior e novo. Registros críticos não podem ser apagados por administradores comuns."
        actions={<a href="/api/export/auditoria" download className="btn-ghost btn-sm">⬇ Exportar CSV</a>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Eventos exibidos" value={rows.length} />
        <Stat label="Eventos críticos" value={critical} tone="red" />
        <Stat label="Acessos do suporte" value={support} tone="purple" />
        <Stat label="Acessos negados" value={denied} tone="amber" />
      </div>

      <Card className="mt-4" title="Filtros">
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q ?? ""} className="input flex-1" placeholder="Buscar por usuário, ação, entidade..." />
          <select name="f" defaultValue={f ?? ""} className="input sm:w-52">
            <option value="">Todos os eventos</option>
            <option value="criticos">Somente críticos</option>
            <option value="suporte">Acessos do suporte</option>
          </select>
          <button className="btn-primary">Filtrar</button>
        </form>
      </Card>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState title="Nenhum evento encontrado" icon="lock" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Data / hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Detalhes</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap text-xs">{dateTimeBR(log.createdAt)}</td>
                  <td className="text-xs">
                    <span className="font-semibold text-[var(--color-ink)]">{log.userName}</span>
                    <span className="block text-[var(--color-subtle)]">{log.ip}</span>
                  </td>
                  <td>
                    <Badge tone={log.critical ? "red" : "zinc"}>{log.action}</Badge>
                    <span className="mt-1 block text-[11px] text-[var(--color-subtle)]">{log.entity} #{log.entityId ?? "—"}</span>
                  </td>
                  <td className="max-w-md text-xs">
                    {log.summary}
                    {log.before || log.after ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-[var(--color-primary-dark)]">valores</summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-surface-muted)] p-2 text-[10px] text-[var(--color-muted)]  ">
{JSON.stringify({ antes: log.before, depois: log.after }, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </td>
                  <td className="text-xs">
                    <Badge tone={log.origin === "suporte" ? "purple" : log.origin === "portaria" ? "blue" : "zinc"}>{log.origin}</Badge>
                    <span className="mt-1 block max-w-40 truncate text-[10px] text-[var(--color-subtle)]">{log.userAgent}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>

      <div className="mt-4">
        <InfoNote tone="amber">
          Política de retenção: eventos críticos são mantidos por 5 anos e exportáveis para auditoria externa. Exclusões
          de registros operacionais exigem perfil de super administrador e ficam registradas nesta trilha.
        </InfoNote>
      </div>
    </>
  );
}
