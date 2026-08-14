import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { amenities, blocks, reservations, units, users } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Card, EmptyState, InfoNote, PageHeader, Stat, statusLabel } from "@/components/ui";
import { Icon } from "@/components/icon";
import { addDays, dateBR, isoDate, money } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { createReservationAction, decideReservationAction } from "@/lib/actions/gestao";
import { qrDataUrl } from "@/lib/qr";
import { ReservationCalendar, type ReservationCalendarEvent } from "@/components/reservation-calendar";

export const dynamic = "force-dynamic";

type AgendaView = "dia" | "semana" | "mes";

function parseDay(value: string | undefined) {
  const raw = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : isoDate();
  return new Date(`${raw}T12:00:00`);
}

function rangeFor(view: AgendaView, selected: Date) {
  if (view === "dia") return { start: isoDate(selected), end: isoDate(selected) };
  if (view === "semana") {
    const start = new Date(selected);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { start: isoDate(start), end: isoDate(addDays(6, start)) };
  }
  const start = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12);
  return { start: isoDate(start), end: isoDate(end) };
}

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; space?: string; status?: string; unit?: string }>;
}) {
  const { session, condoId } = await requireCondo();
  const params = await searchParams;
  const canDecide = ALL_STAFF.includes(session.role);
  const isResident = session.role === "morador";
  const view: AgendaView = params.view === "semana" || params.view === "mes" ? params.view : "dia";
  const selectedDate = parseDay(params.date);
  const range = rangeFor(view, selectedDate);
  const selectedSpaceId = Number(params.space || 0);
  const selectedUnitId = Number(params.unit || 0);
  const selectedStatus = params.status && params.status !== "todos" ? params.status : "";

  const spaces = await db
    .select()
    .from(amenities)
    .where(and(eq(amenities.condoId, condoId), eq(amenities.active, true)))
    .orderBy(asc(amenities.name));

  const rows = await db
    .select({
      id: reservations.id,
      date: reservations.date,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      guests: reservations.guests,
      status: reservations.status,
      qrToken: reservations.qrToken,
      notes: reservations.notes,
      amenityId: reservations.amenityId,
      amenity: amenities.name,
      capacity: amenities.capacity,
      fee: amenities.feeCents,
      unit: units.number,
      block: blocks.name,
      unitId: reservations.unitId,
      person: users.name,
      userId: reservations.userId,
    })
    .from(reservations)
    .innerJoin(amenities, eq(amenities.id, reservations.amenityId))
    .leftJoin(units, eq(units.id, reservations.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .leftJoin(users, eq(users.id, reservations.userId))
    .where(
      and(
        eq(reservations.condoId, condoId),
        gte(reservations.date, range.start),
        lte(reservations.date, range.end),
        isResident ? eq(reservations.userId, session.user.id) : undefined,
        selectedSpaceId ? eq(reservations.amenityId, selectedSpaceId) : undefined,
        selectedUnitId ? eq(reservations.unitId, selectedUnitId) : undefined,
        selectedStatus ? eq(reservations.status, selectedStatus) : undefined,
      ),
    )
    .orderBy(asc(reservations.date), asc(reservations.startTime));

  const pending = rows.filter((item) => item.status === "pendente");
  const approved = rows.filter((item) => item.status === "aprovada");
  const nextApproved = rows.find((item) => item.status === "aprovada");
  const qr = nextApproved?.qrToken ? await qrDataUrl(`RES:${nextApproved.qrToken}`, 130) : null;
  const unitList = await unitOptions(condoId);
  const revenue = approved.reduce((total, item) => total + (item.fee ?? 0), 0);
  const statusOptions = ["todos", "pendente", "aprovada", "recusada"];

  const hrefFor = (next: Partial<{ view: AgendaView; date: string; space: string; status: string; unit: string }>) => {
    const url = new URLSearchParams();
    url.set("view", next.view ?? view);
    url.set("date", next.date ?? isoDate(selectedDate));
    const space = next.space ?? params.space ?? "";
    const status = next.status ?? params.status ?? "";
    const unit = next.unit ?? params.unit ?? "";
    if (space) url.set("space", space);
    if (status && status !== "todos") url.set("status", status);
    if (unit) url.set("unit", unit);
    return `/painel/reservas?${url.toString()}`;
  };

  const calendarHrefParams = new URLSearchParams();
  if (params.space) calendarHrefParams.set("space", params.space);
  if (params.status && params.status !== "todos") calendarHrefParams.set("status", params.status);
  if (params.unit) calendarHrefParams.set("unit", params.unit);
  const calendarDateHref = `/painel/reservas${calendarHrefParams.toString() ? `?${calendarHrefParams.toString()}` : ""}`;

  const calendarEvents: ReservationCalendarEvent[] = rows.map((item) => {
    const unitLabel = item.block || item.unit ? `${item.block ?? ""} ${item.unit ?? ""}`.trim() : "área comum";
    const timeLabel = `${item.startTime}–${item.endTime}`;
    return {
      id: String(item.id),
      title: `${item.amenity} · ${item.person ?? "Morador"}`,
      start: `${item.date}T${item.startTime}`,
      end: `${item.date}T${item.endTime}`,
      status: item.status,
      statusLabel: statusLabel(item.status),
      person: item.person ?? "Morador",
      amenity: item.amenity,
      unitLabel,
      dateLabel: dateBR(item.date),
      timeLabel,
      feeLabel: money(item.fee),
      guests: item.guests ?? 0,
      capacity: item.capacity ?? null,
      notes: item.notes ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={`${dateBR(range.start)}${range.start !== range.end ? ` até ${dateBR(range.end)}` : ""} · reservas de espaços e confirmações.`}
        actions={
          <details className="relative no-print">
            <summary className="btn-primary list-none">
              <Icon name="plus" size={16} />
              Novo agendamento
            </summary>
            <div className="drawer-scrim" />
            <aside className="drawer-panel">
              <div className="mb-7 flex items-start justify-between gap-4 border-b border-[var(--color-line)] pb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Fluxo rápido</p>
                  <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-[var(--color-ink)]">Novo agendamento</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    O backend valida conflito de horário no mesmo espaço antes de confirmar a reserva.
                  </p>
                </div>
                <a href={hrefFor({})} className="btn-ghost btn-sm">
                  <Icon name="x" size={15} />
                  Fechar
                </a>
              </div>

              <form action={createReservationAction} className="space-y-5">
                <label className="block">
                  <span className="label">Serviço / espaço</span>
                  <select name="amenityId" className="input" required>
                    {spaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.name} · {space.feeCents ? money(space.feeCents) : "sem taxa"}
                      </option>
                    ))}
                  </select>
                </label>

                {!isResident ? (
                  <label className="block">
                    <span className="label">Cliente / unidade</span>
                    <select name="unitId" className="input">
                      <option value="">Selecione</option>
                      {unitList.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="label">Data</span>
                    <input type="date" name="date" className="input" required defaultValue={isoDate(selectedDate)} />
                  </label>
                  <label className="block">
                    <span className="label">Início</span>
                    <input type="time" name="startTime" className="input" defaultValue="16:00" />
                  </label>
                  <label className="block">
                    <span className="label">Fim</span>
                    <input type="time" name="endTime" className="input" defaultValue="22:00" />
                  </label>
                </div>

                <label className="block">
                  <span className="label">Convidados</span>
                  <input type="number" name="guests" className="input" min={0} defaultValue={0} />
                </label>

                <label className="block">
                  <span className="label">Observações</span>
                  <textarea name="notes" rows={4} className="input" placeholder="Informe detalhes relevantes para a administração." />
                </label>

                <InfoNote icon="calendar">
                  Horários com reservas pendentes ou aprovadas no mesmo espaço são bloqueados automaticamente.
                </InfoNote>

                <div className="sticky bottom-0 -mx-6 border-t border-[var(--color-line)] bg-white px-6 py-5 sm:-mx-8 sm:px-8">
                  <button className="btn-primary w-full" type="submit">
                    <Icon name="check" size={16} />
                    Confirmar agendamento
                  </button>
                </div>
              </form>
            </aside>
          </details>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Agendamentos" value={rows.length} hint={view === "dia" ? "no dia" : "no período"} />
        <Stat label="Confirmados" value={approved.length} tone="green" hint="com horário liberado" />
        <Stat label="Pendentes" value={pending.length} tone="amber" hint="aguardando decisão" />
        <Stat label="Taxas" value={money(revenue)} hint="confirmadas" />
      </section>

      <section className="section-shell mt-6 no-print">
        <form className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]" action="/painel/reservas">
          <input type="hidden" name="view" value={view} />
          <label className="block">
            <span className="label">Data-base</span>
            <input type="date" name="date" className="input" defaultValue={isoDate(selectedDate)} />
          </label>
          <label className="block">
            <span className="label">Espaço</span>
            <select name="space" className="input" defaultValue={params.space ?? ""}>
              <option value="">Todos</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
          {!isResident ? (
            <label className="block">
              <span className="label">Unidade</span>
              <select name="unit" className="input" defaultValue={params.unit ?? ""}>
                <option value="">Todas</option>
                {unitList.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="label">Status</span>
            <select name="status" className="input" defaultValue={params.status ?? "todos"}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "todos" ? "Todos" : statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary self-end" type="submit">
            <Icon name="filter" size={16} />
            Filtrar
          </button>
        </form>

        <div className="mt-4 tabbar">
          {[
            ["dia", "Dia"],
            ["semana", "Semana"],
            ["mes", "Mês"],
          ].map(([key, label]) => (
            <a key={key} href={hrefFor({ view: key as AgendaView })} className={`tab flex-1 sm:flex-none ${view === key ? "tab-active" : ""}`}>
              {label}
            </a>
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-5">
        <Card
          title="Calendário"
          description="Visualize reservas por dia, semana ou mês com a agenda real do condomínio. Clique em um horário para ver os detalhes."
        >
          <ReservationCalendar events={calendarEvents} selectedDate={isoDate(selectedDate)} view={view} onDateHref={calendarDateHref} />
        </Card>

        <aside className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {canDecide && pending.length > 0 ? (
            <Card title="Aguardando confirmação">
              <ul className="space-y-3">
                {pending.slice(0, 5).map((item) => (
                  <li key={item.id} className="rounded-[12px] border border-[var(--color-line)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">{item.amenity}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {dateBR(item.date)} · {item.startTime} · {item.block} {item.unit}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <form action={decideReservationAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="aprovada" />
                        <button className="btn-success btn-sm">Aprovar</button>
                      </form>
                      <form action={decideReservationAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="recusada" />
                        <button className="btn-danger btn-sm">Recusar</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Serviços disponíveis">
            {spaces.length === 0 ? (
              <EmptyState title="Nenhum espaço ativo" icon="calendar" />
            ) : (
              <ul className="space-y-3">
                {spaces.slice(0, 4).map((space) => (
                  <li key={space.id} className="rounded-[12px] border border-[var(--color-line)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">{space.name}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {space.openTime}–{space.closeTime} · capacidade {space.capacity}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-primary-dark)]">{space.feeCents ? money(space.feeCents) : "sem taxa"}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {qr && nextApproved ? (
            <Card title="Check-in">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code da reserva" className="h-28 w-28 rounded-[8px] border border-[var(--color-line)] bg-white" />
                <div className="text-xs text-[var(--color-muted)]">
                  <p className="font-semibold text-[var(--color-ink)]">{nextApproved.amenity}</p>
                  <p>{dateBR(nextApproved.date)} · {nextApproved.startTime}–{nextApproved.endTime}</p>
                  <p className="mt-1 font-mono">{nextApproved.qrToken}</p>
                </div>
              </div>
            </Card>
          ) : null}

          <InfoNote>
            Cancelamento, reagendamento público e pagamento antecipado dependem de regras/integrações que ainda não existem no backend atual.
          </InfoNote>
        </aside>
      </div>
    </>
  );
}
