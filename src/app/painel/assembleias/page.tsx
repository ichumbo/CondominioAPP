import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assemblies, assemblyAgenda, assemblyAttendance, assemblyVotes, units } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Progress, Stat } from "@/components/ui";
import { dateTimeBR, percent } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { confirmAttendanceAction, createAssemblyAction, publishMinutesAction, voteAssemblyAction } from "@/lib/actions/admin";
import { PrintButton } from "@/components/client-bits";

export const dynamic = "force-dynamic";

export default async function AssembleiasPage() {
  const { session, condoId } = await requireCondo();
  const canManage = ["superadmin", "sindico"].includes(session.role);

  const rows = await db.select().from(assemblies).where(eq(assemblies.condoId, condoId)).orderBy(desc(assemblies.firstCallAt));
  const ids = rows.map((r) => r.id);
  const agenda = ids.length ? await db.select().from(assemblyAgenda).where(inArray(assemblyAgenda.assemblyId, ids)).orderBy(asc(assemblyAgenda.position)) : [];
  const attendance = ids.length ? await db.select().from(assemblyAttendance).where(inArray(assemblyAttendance.assemblyId, ids)) : [];
  const votes = ids.length ? await db.select().from(assemblyVotes).where(inArray(assemblyVotes.assemblyId, ids)) : [];
  const allUnits = await db.select().from(units).where(eq(units.condoId, condoId));
  const unitList = await unitOptions(condoId);

  return (
    <>
      <PageHeader
        title="Assembleias"
        subtitle="Convocação digital, pauta, confirmação de presença, procurações, quórum, votação por unidade ou fração ideal e ata."
        actions={<PrintButton label="🖨 Imprimir convocação" />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyState title="Nenhuma assembleia registrada" icon="scale" />
          ) : (
            rows.map((a) => {
              const items = agenda.filter((i) => i.assemblyId === a.id);
              const present = attendance.filter((i) => i.assemblyId === a.id);
              const proxies = present.filter((p) => p.proxyForUnitId).length;
              const quorum = percent(present.length + proxies, allUnits.length);
              const myAttendance = present.find((p) => p.userId === session.user.id);
              return (
                <Card
                  key={a.id}
                  title={a.title}
                  description={`${a.kind} · ${a.mode} · 1ª convocação ${dateTimeBR(a.firstCallAt)}${a.secondCallAt ? ` · 2ª ${dateTimeBR(a.secondCallAt)}` : ""}`}
                  actions={<Badge tone={a.status === "encerrada" ? "zinc" : "green"}>{a.status}</Badge>}
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Quórum atual</p>
                      <p className="text-2xl font-bold text-[var(--color-ink)]">{quorum}%</p>
                      <Progress value={quorum} tone={quorum >= a.quorumFirst ? "bg-[var(--color-success)]" : "bg-[var(--color-warn)]"} />
                      <p className="mt-1 text-[11px] text-[var(--color-subtle)]">
                        mínimo 1ª {a.quorumFirst}% · 2ª {a.quorumSecond}% · {present.length} unidades + {proxies} procuração(ões)
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Local / acesso</p>
                      <p className="text-sm text-[var(--color-ink)]">{a.location ?? "—"}</p>
                      {a.onlineLink ? <p className="truncate text-xs text-[var(--color-primary-dark)]">{a.onlineLink}</p> : null}
                      {a.recordingUrl ? <p className="truncate text-xs text-[var(--color-muted)]">Gravação: {a.recordingUrl}</p> : null}
                    </div>
                  </div>

                  <ol className="mt-4 space-y-3">
                    {items.map((item) => {
                      const itemVotes = votes.filter((v) => v.agendaId === item.id);
                      const byChoice = (choice: string) =>
                        item.votingType === "fracao"
                          ? itemVotes.filter((v) => v.choice === choice).reduce((acc, v) => acc + Number(v.weight ?? 1), 0)
                          : itemVotes.filter((v) => v.choice === choice).length;
                      const total = item.votingType === "fracao" ? itemVotes.reduce((acc, v) => acc + Number(v.weight ?? 1), 0) : itemVotes.length;
                      const mine = itemVotes.find((v) => v.userId === session.user.id);
                      return (
                        <li key={item.id} className="rounded-lg border border-[var(--color-line)] p-3 ">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-[var(--color-ink)]">
                              {item.position}. {item.title}
                            </p>
                            <Badge tone="purple">votação por {item.votingType}</Badge>
                          </div>
                          {item.description ? <p className="mt-1 text-xs text-[var(--color-muted)]">{item.description}</p> : null}
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            {(["sim", "nao", "abstencao"] as const).map((choice) => (
                              <div key={choice} className="rounded border border-[var(--color-line)] p-2 text-center ">
                                <p className="font-bold uppercase text-[var(--color-muted)]">{choice}</p>
                                <p className="text-lg font-bold text-[var(--color-ink)]">
                                  {byChoice(choice).toFixed(item.votingType === "fracao" ? 2 : 0)}
                                </p>
                                <p className="text-[10px] text-[var(--color-subtle)]">{percent(byChoice(choice), total)}%</p>
                              </div>
                            ))}
                          </div>
                          {a.status !== "encerrada" && !mine ? (
                            <div className="mt-2 flex gap-2 no-print">
                              {(["sim", "nao", "abstencao"] as const).map((choice) => (
                                <form key={choice} action={voteAssemblyAction}>
                                  <input type="hidden" name="assemblyId" value={a.id} />
                                  <input type="hidden" name="agendaId" value={item.id} />
                                  <input type="hidden" name="choice" value={choice} />
                                  <button className="btn-ghost btn-sm capitalize">{choice}</button>
                                </form>
                              ))}
                            </div>
                          ) : null}
                          {mine ? <p className="mt-2 text-xs font-semibold text-[var(--color-primary-dark)]">Seu voto: {mine.choice}</p> : null}
                        </li>
                      );
                    })}
                  </ol>

                  {a.minutes ? (
                    <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3 text-sm  ">
                      <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Ata</p>
                      <p className="mt-1 whitespace-pre-line text-[var(--color-ink)] ">{a.minutes}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2 no-print">
                    {!myAttendance && a.status !== "encerrada" ? (
                      <Panel summary="✋ Confirmar presença / procuração" tone="ghost">
                        <form action={confirmAttendanceAction} className="space-y-2">
                          <input type="hidden" name="assemblyId" value={a.id} />
                          {session.role !== "morador" ? (
                            <label className="block">
                              <span className="label">Unidade representada</span>
                              <select name="unitId" className="input">
                                <option value="">—</option>
                                {unitList.map((u) => (
                                  <option key={u.id} value={u.id}>{u.label}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          <label className="block">
                            <span className="label">Procuração para a unidade</span>
                            <select name="proxyForUnitId" className="input">
                              <option value="">Não represento outra unidade</option>
                              {unitList.map((u) => (
                                <option key={u.id} value={u.id}>{u.label}</option>
                              ))}
                            </select>
                          </label>
                          <input name="proxyDoc" className="input" placeholder="Documento da procuração (URL/arquivo)" />
                          <button className="btn-primary btn-sm w-full">Confirmar</button>
                        </form>
                      </Panel>
                    ) : (
                      myAttendance ? <Badge tone="green">presença confirmada</Badge> : null
                    )}

                    {canManage && a.status !== "encerrada" ? (
                      <Panel summary="📝 Registrar deliberações e ata" tone="ghost">
                        <form action={publishMinutesAction} className="space-y-2">
                          <input type="hidden" name="id" value={a.id} />
                          <textarea name="minutes" rows={5} className="input" placeholder="Deliberações aprovadas..." required />
                          <input name="recordingUrl" className="input" placeholder="Link da gravação" />
                          <button className="btn-dark btn-sm w-full">Publicar ata e encerrar</button>
                        </form>
                      </Panel>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          {canManage ? (
            <Card title="Nova convocação">
              <form action={createAssemblyAction} className="space-y-3">
                <label className="block">
                  <span className="label">Título</span>
                  <input name="title" className="input" required />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="label">Tipo</span>
                    <select name="kind" className="input">
                      <option value="ordinaria">Ordinária</option>
                      <option value="extraordinaria">Extraordinária</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Formato</span>
                    <select name="mode" className="input">
                      <option value="hibrida">Híbrida</option>
                      <option value="presencial">Presencial</option>
                      <option value="online">Online</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="label">1ª convocação</span>
                  <input type="datetime-local" name="firstCallAt" className="input" required />
                </label>
                <label className="block">
                  <span className="label">2ª convocação</span>
                  <input type="datetime-local" name="secondCallAt" className="input" />
                </label>
                <label className="block">
                  <span className="label">Local</span>
                  <input name="location" className="input" placeholder="Salão de festas" />
                </label>
                <label className="block">
                  <span className="label">Link online</span>
                  <input name="onlineLink" className="input" placeholder="https://" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="label">Quórum 1ª (%)</span>
                    <input type="number" name="quorumFirst" className="input" defaultValue={50} />
                  </label>
                  <label className="block">
                    <span className="label">Quórum 2ª (%)</span>
                    <input type="number" name="quorumSecond" className="input" defaultValue={25} />
                  </label>
                </div>
                <label className="block">
                  <span className="label">Pauta (uma por linha)</span>
                  <textarea name="agenda" rows={4} className="input" required />
                </label>
                <label className="block">
                  <span className="label">Tipo de votação</span>
                  <select name="votingType" className="input">
                    <option value="unidade">Por unidade</option>
                    <option value="fracao">Por fração ideal</option>
                  </select>
                </label>
                <button className="btn-primary w-full">Publicar convocação</button>
              </form>
            </Card>
          ) : null}

          <InfoNote tone="amber">
            A validade jurídica da assembleia e das votações depende do cumprimento da convenção do condomínio e da
            legislação aplicável. O sistema registra evidências (presenças, procurações, votos e horários) para apoiar a
            ata assinada.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
