import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blocks, occurrences, shifts, units, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { GATE } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Stat } from "@/components/ui";
import { dateTimeBR } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { ackOccurrenceAction, addOccurrenceFollowUpAction, createOccurrenceAction } from "@/lib/actions/portaria";
import { PrintButton } from "@/components/client-bits";

export const dynamic = "force-dynamic";

export default async function LivroPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { session, condoId } = await requireRole([...GATE, "conselho"]);
  const { v } = await searchParams;

  const allowed =
    session.role === "porteiro" || session.role === "zelador"
      ? ["publica", "administrativa"]
      : ["publica", "administrativa", "sigilosa"];
  const scope = v && allowed.includes(v) ? [v] : allowed;
  const canAck = ["superadmin", "sindico", "conselho"].includes(session.role);

  const rows = await db
    .select({
      id: occurrences.id,
      code: occurrences.code,
      visibility: occurrences.visibility,
      category: occurrences.category,
      severity: occurrences.severity,
      title: occurrences.title,
      description: occurrences.description,
      actionsTaken: occurrences.actionsTaken,
      occurredAt: occurrences.occurredAt,
      ackAt: occurrences.ackAt,
      attachments: occurrences.attachments,
      reporter: users.name,
      unit: units.number,
      block: blocks.name,
      shiftPeriod: shifts.period,
    })
    .from(occurrences)
    .leftJoin(users, eq(users.id, occurrences.reportedById))
    .leftJoin(units, eq(units.id, occurrences.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .leftJoin(shifts, eq(shifts.id, occurrences.shiftId))
    .where(and(eq(occurrences.condoId, condoId), inArray(occurrences.visibility, scope)))
    .orderBy(desc(occurrences.occurredAt))
    .limit(80);

  const unitList = await unitOptions(condoId);
  const withoutAck = rows.filter((r) => !r.ackAt).length;
  const high = rows.filter((r) => r.severity === "alta").length;

  return (
    <>
      <PageHeader
        title="Livro de ocorrências digital"
        subtitle="Registros por turno, classificação de sigilo, ações tomadas, ciência do síndico e histórico imutável com auditoria."
        actions={
          <>
            <PrintButton label="🖨 Imprimir / exportar" />
            <a className="btn-ghost btn-sm" href={`/api/export/ocorrencias`} download>
              ⬇ CSV
            </a>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Registros no período" value={rows.length} />
        <Stat label="Sem ciência do síndico" value={withoutAck} tone="amber" hint="pendentes" />
        <Stat label="Gravidade alta" value={high} tone="red" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 no-print">
        {["todas", ...allowed].map((key) => (
          <a
            key={key}
            href={key === "todas" ? "/painel/livro" : `/painel/livro?v=${key}`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
              (v ?? "todas") === key
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
                : "bg-white text-[var(--color-muted)] ring-1 ring-[var(--color-line)]   "
            }`}
          >
            {key}
          </a>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyState title="Nenhuma ocorrência registrada" icon="book" />
          ) : (
            rows.map((o) => (
              <article key={o.id} className="card-flat p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--color-muted)]">{o.code}</span>
                    <Badge tone={o.visibility === "sigilosa" ? "purple" : o.visibility === "administrativa" ? "blue" : "zinc"}>
                      {o.visibility}
                    </Badge>
                    <Badge tone={o.severity === "alta" ? "red" : o.severity === "media" ? "amber" : "green"}>{o.severity}</Badge>
                    <Badge>{o.category}</Badge>
                    {o.shiftPeriod ? <Badge tone="zinc">turno {o.shiftPeriod}</Badge> : null}
                    {o.ackAt ? <Badge tone="green">ciência do síndico</Badge> : <Badge tone="amber">aguardando ciência</Badge>}
                  </div>
                  <span className="text-xs text-[var(--color-subtle)]">{dateTimeBR(o.occurredAt)}</span>
                </div>
                <h3 className="mt-2 font-bold text-[var(--color-ink)]">{o.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-muted)]">{o.description}</p>
                {o.actionsTaken ? (
                  <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-muted)]   ">
                    <p className="font-bold uppercase tracking-wide text-[var(--color-muted)]">Ações tomadas</p>
                    <p className="mt-1 whitespace-pre-line">{o.actionsTaken}</p>
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-[var(--color-subtle)]">
                  Registrado por {o.reporter ?? "portaria"}
                  {o.unit ? ` · unidade ${o.block ?? ""} ${o.unit}` : ""} · registro protegido contra edição
                </p>
                <div className="mt-3 flex flex-wrap gap-2 no-print">
                  {canAck && !o.ackAt ? (
                    <form action={ackOccurrenceAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn-primary btn-sm">Dar ciência</button>
                    </form>
                  ) : null}
                  <Panel summary="Complementar ações" tone="ghost">
                    <form action={addOccurrenceFollowUpAction} className="space-y-2">
                      <input type="hidden" name="id" value={o.id} />
                      <textarea name="addition" rows={2} className="input" placeholder="Nova ação tomada..." required />
                      <button className="btn-dark btn-sm">Adicionar (versão auditada)</button>
                    </form>
                  </Panel>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card title="Registrar ocorrência">
            <form action={createOccurrenceAction} className="space-y-3">
              <label className="block">
                <span className="label">Título</span>
                <input name="title" className="input" required />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Visibilidade</span>
                  <select name="visibility" className="input">
                    <option value="publica">Pública</option>
                    <option value="administrativa">Administrativa</option>
                    <option value="sigilosa">Sigilosa</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Categoria</span>
                  <select name="category" className="input">
                    <option value="seguranca">Segurança</option>
                    <option value="manutencao">Manutenção</option>
                    <option value="convivencia">Convivência</option>
                    <option value="barulho">Barulho</option>
                    <option value="acesso">Acesso</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Gravidade</span>
                  <select name="severity" className="input">
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Data/hora</span>
                  <input type="datetime-local" name="occurredAt" className="input" />
                </label>
              </div>
              <label className="block">
                <span className="label">Unidade envolvida</span>
                <select name="unitId" className="input">
                  <option value="">Não se aplica</option>
                  {unitList.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Descrição</span>
                <textarea name="description" rows={4} className="input" required />
              </label>
              <label className="block">
                <span className="label">Ações tomadas</span>
                <textarea name="actionsTaken" rows={2} className="input" />
              </label>
              <label className="block">
                <span className="label">Evidências (URLs separadas por vírgula)</span>
                <input name="attachments" className="input" placeholder="foto1.jpg, video.mp4" />
              </label>
              <button className="btn-primary w-full">Registrar no livro</button>
            </form>
          </Card>

          <InfoNote tone="amber">
            Ocorrências sigilosas ficam visíveis apenas para síndico, conselho e super administrador. Nenhum registro pode
            ser excluído pelo administrador comum: complementos criam novas versões auditadas.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
