import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { occurrences, parcels, shifts, units, users, visitors, visits, blocks } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { GATE } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, StatCard, statusTone } from "@/components/ui";
import { dateTimeBR, timeBR } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { createOccurrenceAction, gateMoveAction, registerParcelAction } from "@/lib/actions/portaria";
import { GateSearch } from "./gate-search";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

export default async function PortariaPanel() {
  const { session, condoId } = await requireRole(GATE);

  const activeVisits = await db
    .select({
      id: visits.id,
      status: visits.status,
      purpose: visits.purpose,
      checkinAt: visits.checkinAt,
      validUntil: visits.validUntil,
      qrToken: visits.qrToken,
      plate: visits.vehiclePlate,
      name: visitors.name,
      document: visitors.document,
      kind: visitors.kind,
      company: visitors.company,
      blocked: visitors.blocked,
      unit: units.number,
      block: blocks.name,
      host: users.name,
    })
    .from(visits)
    .innerJoin(visitors, eq(visitors.id, visits.visitorId))
    .leftJoin(units, eq(units.id, visits.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .leftJoin(users, eq(users.id, visits.hostUserId))
    .where(and(eq(visits.condoId, condoId), inArray(visits.status, ["autorizado", "dentro", "aguardando"])))
    .orderBy(desc(visits.createdAt));

  const inside = activeVisits.filter((v) => v.status === "dentro");
  const expected = activeVisits.filter((v) => v.status === "autorizado");
  const waiting = activeVisits.filter((v) => v.status === "aguardando");

  const pendingParcels = await db
    .select({ id: parcels.id, code: parcels.code, carrier: parcels.carrier, receivedAt: parcels.receivedAt, unit: units.number, block: blocks.name })
    .from(parcels)
    .leftJoin(units, eq(units.id, parcels.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(and(eq(parcels.condoId, condoId), eq(parcels.status, "pendente")))
    .orderBy(desc(parcels.receivedAt))
    .limit(8);

  const [openShift] = await db
    .select({ id: shifts.id, period: shifts.period, startedAt: shifts.startedAt, userName: users.name })
    .from(shifts)
    .innerJoin(users, eq(users.id, shifts.userId))
    .where(and(eq(shifts.condoId, condoId), eq(shifts.status, "aberto")))
    .orderBy(desc(shifts.startedAt))
    .limit(1);

  const [lastClosed] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.condoId, condoId), eq(shifts.status, "encerrado")))
    .orderBy(desc(shifts.endedAt))
    .limit(1);

  const recentOccurrences = await db
    .select()
    .from(occurrences)
    .where(and(eq(occurrences.condoId, condoId), inArray(occurrences.visibility, ["publica", "administrativa"])))
    .orderBy(desc(occurrences.occurredAt))
    .limit(4);

  const blockedList = await db
    .select()
    .from(visitors)
    .where(and(eq(visitors.condoId, condoId), eq(visitors.blocked, true)));

  const [{ n: parcelCount } = { n: 0 }] = await db
    .select({ n: count() })
    .from(parcels)
    .where(and(eq(parcels.condoId, condoId), eq(parcels.status, "pendente")));

  const unitList = await unitOptions(condoId);

  return (
    <>
      <PageHeader
        title="Painel da portaria"
        subtitle="Interface simplificada para o turno: valide QR Codes, registre entradas, saídas, encomendas e ocorrências."
        actions={
          <>
            <Link href="/painel/turnos" className="btn-ghost btn-sm"><Icon name="refresh" size={15} />Turnos</Link>
            <Link href="/painel/livro" className="btn-ghost btn-sm"><Icon name="book" size={15} />Livro</Link>
            <Link href="/painel/visitantes" className="btn-primary btn-sm"><Icon name="user-check" size={15} />Visitantes</Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="No condomínio agora" value={inside.length} icon="shield" hint="entradas sem saída" />
        <StatCard label="Visitas esperadas" value={expected.length} icon="user-check" hint="autorizadas e válidas" />
        <StatCard label="Aguardando morador" value={waiting.length} icon="clock" hint="autorização pendente" />
        <StatCard label="Encomendas na portaria" value={parcelCount} icon="package" href="/painel/encomendas" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Turno em andamento"
            description={openShift ? `${openShift.userName} · ${openShift.period} · desde ${timeBR(openShift.startedAt)}` : "Nenhum turno aberto"}
            actions={<Link href="/painel/turnos" className="btn-dark btn-sm">{openShift ? "Encerrar / passar turno" : "Abrir turno"}</Link>}
            accent
          >
            {lastClosed?.handoverNotes ? (
              <div className="rounded-[10px] border border-[#dce9b3] bg-[var(--color-primary-soft)] p-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-[var(--color-ink)]">
                    <Icon name="refresh" size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary-dark)]">Última passagem de serviço</p>
                    <p className="mt-1 leading-6 text-[var(--color-ink)]">{lastClosed.handoverNotes}</p>
                  </div>
                </div>
                {lastClosed.pendingItems ? (
                  <p className="mt-3 rounded-[8px] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-warn)]">Pendências: {lastClosed.pendingItems}</p>
                ) : null}
              </div>
            ) : (
              <EmptyState title="Sem registro de passagem anterior" icon="refresh" />
            )}
          </Card>

          <GateSearch
            visits={activeVisits.map((v) => ({
              id: v.id,
              name: v.name,
              document: v.document,
              unit: `${v.block ?? ""} ${v.unit ?? "—"}`.trim(),
              host: v.host,
              status: v.status,
              kind: v.kind,
              company: v.company,
              plate: v.plate,
              purpose: v.purpose,
              validUntil: dateTimeBR(v.validUntil),
              checkinAt: v.checkinAt ? dateTimeBR(v.checkinAt) : null,
              qrToken: v.qrToken,
            }))}
            moveAction={gateMoveAction}
          />
        </div>

        <div className="space-y-4">
          <section className="card-flat overflow-hidden">
            <div className="border-b border-[var(--color-primary-hover)] bg-[var(--color-primary)] p-5 text-[var(--color-ink)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white/85 text-[var(--color-primary-dark)]">
                  <Icon name="package" size={18} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Registro rápido de encomenda</h2>
                  <p className="mt-1 text-sm leading-6">Cadastre o pacote e notifique o morador sem sair da portaria.</p>
                </div>
              </div>
            </div>
            <form action={registerParcelAction} className="space-y-3 p-5">
              <label className="block">
                <span className="label">Unidade</span>
                <select name="unitId" className="input" required>
                  <option value="">Selecione</option>
                  {unitList.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Tipo</span>
                  <select name="kind" className="input">
                    <option value="encomenda">Encomenda</option>
                    <option value="correspondencia">Correspondência</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Transportadora</span>
                  <input name="carrier" className="input" placeholder="Correios" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Prateleira</span>
                  <input name="shelf" className="input" placeholder="A2" />
                </label>
                <label className="block">
                  <span className="label">Rastreio</span>
                  <input name="trackingCode" className="input" />
                </label>
              </div>
              <label className="block">
                <span className="label">Foto do pacote (URL opcional)</span>
                <input name="photoUrl" className="input" placeholder="https://" />
              </label>
              <button className="btn-primary w-full"><Icon name="package" size={16} />Registrar e avisar morador</button>
            </form>
          </section>

          <Card title="Encomendas aguardando retirada" actions={<Link href="/painel/encomendas" className="link text-xs">ver todas</Link>} accent>
            {pendingParcels.length === 0 ? (
              <EmptyState title="Nenhuma encomenda pendente" icon="package" />
            ) : (
              <ul className="space-y-2 text-sm">
                {pendingParcels.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
                        <Icon name="package" size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[var(--color-ink)]">{p.block} {p.unit}</span>
                      <span className="text-xs text-[var(--color-muted)]">{p.code} · {p.carrier}</span>
                    </span>
                    </span>
                    <span className="text-xs text-[var(--color-subtle)]">{dateTimeBR(p.receivedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {blockedList.length > 0 ? (
            <Card title="Lista de bloqueio">
              <ul className="space-y-2 text-xs">
                {blockedList.map((b) => (
                  <li key={b.id} className="rounded-lg border border-[#efc9c9] bg-[var(--color-danger-soft)] px-3 py-2 text-[var(--color-danger)]   ">
                    <strong>{b.name}</strong> {b.document ? `· ${b.document}` : ""}
                    <p className="mt-0.5">{b.blockReason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Panel summary="Registrar ocorrência do turno" tone="dark">
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
                  <span className="label">Gravidade</span>
                  <select name="severity" className="input">
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="label">Descrição</span>
                <textarea name="description" rows={3} className="input" required />
              </label>
              <label className="block">
                <span className="label">Ações tomadas</span>
                <textarea name="actionsTaken" rows={2} className="input" />
              </label>
              <button className="btn-primary w-full">Registrar no livro</button>
            </form>
          </Panel>

          <Card title="Últimas ocorrências">
            {recentOccurrences.length === 0 ? (
              <EmptyState title="Turno sem ocorrências" icon="book" />
            ) : (
              <ul className="space-y-2 text-sm">
                {recentOccurrences.map((o) => (
                  <li key={o.id} className="rounded-lg border border-[var(--color-line)] px-3 py-2 ">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--color-ink)]">{o.title}</span>
                      <Badge tone={statusTone(o.severity)}>{o.severity}</Badge>
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">{dateTimeBR(o.occurredAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <InfoNote tone="amber">
            Operando como <strong>{session.user.name}</strong>. Toda entrada, saída, entrega e ocorrência é registrada com
            usuário, data/hora e IP na trilha de auditoria — registros críticos não podem ser apagados.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
