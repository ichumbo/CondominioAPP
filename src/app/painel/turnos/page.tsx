import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shifts, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { GATE } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader } from "@/components/ui";
import { dateTimeBR } from "@/lib/utils";
import { peopleOptions } from "@/lib/queries";
import { closeShiftAction, openShiftAction } from "@/lib/actions/portaria";

export const dynamic = "force-dynamic";

const CHECKLIST = [
  ["radios", "Rádios e baterias"],
  ["chaves", "Chaves e cofre"],
  ["cameras", "Câmeras e gravação"],
  ["extintores", "Extintores e rotas"],
  ["interfone", "Interfone e portões"],
] as const;

export default async function TurnosPage() {
  const { session, condoId } = await requireRole(GATE);

  const rows = await db
    .select({
      id: shifts.id,
      period: shifts.period,
      status: shifts.status,
      startedAt: shifts.startedAt,
      endedAt: shifts.endedAt,
      handoverNotes: shifts.handoverNotes,
      pendingItems: shifts.pendingItems,
      checklist: shifts.checklist,
      userName: users.name,
    })
    .from(shifts)
    .innerJoin(users, eq(users.id, shifts.userId))
    .where(eq(shifts.condoId, condoId))
    .orderBy(desc(shifts.startedAt))
    .limit(20);

  const [openShift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.condoId, condoId), eq(shifts.status, "aberto")))
    .orderBy(desc(shifts.startedAt))
    .limit(1);

  const staff = await peopleOptions(condoId, ["porteiro", "zelador", "sindico"]);

  return (
    <>
      <PageHeader
        title="Passagem de turno"
        subtitle="Abertura e encerramento de turno com checklist de conferência, pendências e passagem de serviço entre porteiros."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Histórico de turnos">
            {rows.length === 0 ? (
              <EmptyState title="Nenhum turno registrado" icon="refresh" />
            ) : (
              <ul className="space-y-3">
                {rows.map((s) => (
                  <li key={s.id} className="rounded-lg border border-[var(--color-line)] p-3 ">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--color-ink)]">{s.userName}</span>
                        <Badge tone="blue">{s.period}</Badge>
                        <Badge tone={s.status === "aberto" ? "amber" : "green"}>{s.status}</Badge>
                      </div>
                      <span className="text-xs text-[var(--color-subtle)]">
                        {dateTimeBR(s.startedAt)} → {s.endedAt ? dateTimeBR(s.endedAt) : "em andamento"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CHECKLIST.map(([key, label]) => (
                        <span
                          key={key}
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            (s.checklist as Record<string, boolean> | null)?.[key]
                              ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                              : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                          }`}
                        >
                          {(s.checklist as Record<string, boolean> | null)?.[key] ? "Conferido" : "Pendente"} · {label}
                        </span>
                      ))}
                    </div>
                    {s.handoverNotes ? (
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{s.handoverNotes}</p>
                    ) : null}
                    {s.pendingItems ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--color-warn)] ">Pendências: {s.pendingItems}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {openShift ? (
            <Card title="Encerrar turno e passar serviço" description={`Turno ${openShift.period} aberto em ${dateTimeBR(openShift.startedAt)}`}>
              <form action={closeShiftAction} className="space-y-3">
                <input type="hidden" name="id" value={openShift.id} />
                <label className="block">
                  <span className="label">Passar para</span>
                  <select name="handoverToId" className="input" required>
                    <option value="">Selecione o colega</option>
                    {staff
                      .filter((s) => s.id !== session.user.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Relato da passagem de serviço</span>
                  <textarea name="handoverNotes" rows={4} className="input" required placeholder="Rondas, intercorrências, chaves, obras em andamento..." />
                </label>
                <label className="block">
                  <span className="label">Pendências para o próximo turno</span>
                  <textarea name="pendingItems" rows={2} className="input" />
                </label>
                <button className="btn-dark w-full">Encerrar turno</button>
              </form>
            </Card>
          ) : (
            <Card title="Abrir turno">
              <form action={openShiftAction} className="space-y-3">
                <label className="block">
                  <span className="label">Período</span>
                  <select name="period" className="input">
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="noite">Noite</option>
                  </select>
                </label>
                <fieldset className="space-y-1.5">
                  <legend className="label">Checklist de conferência</legend>
                  {CHECKLIST.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                      <input type="checkbox" name={key} className="h-4 w-4" defaultChecked />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <button className="btn-primary w-full">Abrir turno</button>
              </form>
            </Card>
          )}

          <InfoNote>
            A abertura e o encerramento de turno geram registro crítico na auditoria com usuário, horário e IP, servindo
            como comprovação para a administradora.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
