import Link from "next/link";
import { and, asc, count, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { amenities, announcements, blocks, parcels, reservations, tickets, units, users, visits } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader, StatCard, statusLabel, statusTone } from "@/components/ui";
import { Icon } from "@/components/icon";
import { dateBR, dateTimeBR, isoDate, money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PainelHome() {
  const { session, condo, condoId } = await requireCondo();
  const isResident = session.role === "morador";
  const isStaff = ["superadmin", "sindico", "conselho", "zelador"].includes(session.role);
  const today = isoDate();
  const unitId = session.unitId;
  const reservationScope = isResident ? eq(reservations.userId, session.user.id) : undefined;

  const reservationRows = await db
    .select({
      id: reservations.id,
      date: reservations.date,
      start: reservations.startTime,
      end: reservations.endTime,
      status: reservations.status,
      guests: reservations.guests,
      amenity: amenities.name,
      fee: amenities.feeCents,
      person: users.name,
      unit: units.number,
      block: blocks.name,
    })
    .from(reservations)
    .innerJoin(amenities, eq(amenities.id, reservations.amenityId))
    .leftJoin(users, eq(users.id, reservations.userId))
    .leftJoin(units, eq(units.id, reservations.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(and(eq(reservations.condoId, condoId), gte(reservations.date, today), reservationScope))
    .orderBy(asc(reservations.date), asc(reservations.startTime))
    .limit(12);

  const todayAgenda = reservationRows.filter((item) => item.date === today);
  const nextReservation = reservationRows.find((item) => ["aprovada", "pendente"].includes(item.status));
  const pendingReservations = reservationRows.filter((item) => item.status === "pendente");
  const todayRevenue = todayAgenda
    .filter((item) => item.status === "aprovada")
    .reduce((total, item) => total + (item.fee ?? 0), 0);

  const ticketScope = isResident ? eq(tickets.openedById, session.user.id) : undefined;
  const parcelScope = isResident && unitId ? eq(parcels.unitId, unitId) : undefined;

  const [openTickets] = await db
    .select({ n: count() })
    .from(tickets)
    .where(and(eq(tickets.condoId, condoId), ne(tickets.status, "concluido"), ticketScope));

  const [pendingParcels] = await db
    .select({ n: count() })
    .from(parcels)
    .where(and(eq(parcels.condoId, condoId), eq(parcels.status, "pendente"), parcelScope));

  const [inside] = await db
    .select({ n: count() })
    .from(visits)
    .where(and(eq(visits.condoId, condoId), eq(visits.status, "dentro")));

  const [pinned] = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.condoId, condoId)))
    .orderBy(desc(announcements.pinned), desc(announcements.priority), desc(announcements.publishedAt))
    .limit(1);

  return (
    <>
      <PageHeader
        title={isStaff ? "Agenda de hoje" : "Minha agenda"}
        subtitle={isStaff ? `${condo.name} · ${dateBR(today)}` : `Seus próximos horários e solicitações · ${dateBR(today)}`}
        actions={
          <Link href="/painel/reservas" className="btn-primary">
            <Icon name="plus" size={16} />
            Novo agendamento
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Agendamentos hoje" value={todayAgenda.length} icon="calendar" hint="reservas e uso de espaços" href="/painel/reservas" />
        <StatCard
          label="Próximo horário"
          value={nextReservation ? nextReservation.start : "—"}
          icon="clock"
          hint={nextReservation ? `${dateBR(nextReservation.date)} · ${nextReservation.amenity}` : "agenda livre"}
          href="/painel/reservas"
        />
        <StatCard label="Pendentes" value={pendingReservations.length} icon="bell" hint="aguardando confirmação" href="/painel/reservas" />
        <StatCard label="Faturamento" value={money(todayRevenue)} icon="wallet" hint="estimado hoje" href={isStaff ? "/painel/financeiro" : "/painel/reservas"} />
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Linha do tempo"
          description="Acompanhe somente o que precisa de ação agora. Detalhes completos ficam na tela de agenda."
          actions={<Link href="/painel/reservas" className="btn-ghost btn-sm">Abrir agenda</Link>}
        >
          {todayAgenda.length === 0 ? (
            <EmptyState
              title="Nenhum agendamento para hoje"
              description="Crie uma nova reserva ou consulte a visão semanal da agenda."
              icon="calendar"
              action={<Link href="/painel/reservas" className="btn-primary btn-sm">Novo agendamento</Link>}
            />
          ) : (
            <ol className="relative space-y-3">
              {todayAgenda.map((item, index) => {
                const highlight = index === 0 && ["aprovada", "pendente"].includes(item.status);
                return (
                  <li
                    key={item.id}
                    className={`grid gap-3 rounded-[12px] border p-4 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center ${
                      highlight ? "border-[#d8e8a6] bg-[var(--color-primary-soft)]" : "border-[var(--color-line)] bg-white"
                    }`}
                  >
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-[var(--color-ink)]">{item.start}</p>
                      <p className="text-xs text-[var(--color-muted)]">{item.end}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{item.person ?? "Morador"}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {item.amenity} · {item.block ?? ""} {item.unit ?? "área comum"}
                      </p>
                    </div>
                    <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <aside className="space-y-4">
          <Card title="Próximo agendamento">
            {nextReservation ? (
              <div className="space-y-3">
                <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{dateBR(nextReservation.date)}</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">
                    {nextReservation.start}–{nextReservation.end}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{nextReservation.amenity}</p>
                </div>
                <Link href="/painel/reservas" className="btn-dark w-full">Ver detalhes</Link>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">Nenhum horário futuro encontrado.</p>
            )}
          </Card>

          <Card title="Resumo operacional">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Atendimentos abertos</span>
                <strong>{openTickets.n}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Encomendas pendentes</span>
                <strong>{pendingParcels.n}</strong>
              </div>
              {isStaff ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-muted)]">Pessoas no condomínio</span>
                  <strong>{inside.n}</strong>
                </div>
              ) : null}
            </div>
          </Card>

          {pendingReservations.length > 0 ? (
            <Card title="Confirmações pendentes">
              <ul className="space-y-2">
                {pendingReservations.slice(0, 3).map((item) => (
                  <li key={item.id} className="rounded-[10px] border border-[var(--color-line)] p-3 text-sm">
                    <p className="font-semibold text-[var(--color-ink)]">{item.amenity}</p>
                    <p className="text-xs text-[var(--color-muted)]">{dateBR(item.date)} · {item.start}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Aviso importante">
            {pinned ? (
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">{pinned.title}</p>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--color-muted)]">{pinned.body}</p>
                <Link href="/painel/comunicados" className="btn-link mt-2 text-xs">Ler comunicado</Link>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">Sem avisos no momento.</p>
            )}
          </Card>

          <InfoNote>
            A disponibilidade é confirmada no backend no momento da criação, evitando agendamentos duplicados no mesmo horário.
          </InfoNote>
        </aside>
      </div>
    </>
  );
}
