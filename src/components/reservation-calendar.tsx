"use client";

import "temporal-polyfill/global";
import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { DateClickInfo, EventClickInfo, EventDisplayInfo, EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import formaPlugin from "@fullcalendar/react/themes/forma";
import ptBrLocale from "@fullcalendar/react/locales/pt-br";
import { Icon } from "@/components/icon";

export type ReservationCalendarView = "dia" | "semana" | "mes";

export type ReservationCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  statusLabel: string;
  person: string;
  amenity: string;
  unitLabel: string;
  dateLabel: string;
  timeLabel: string;
  feeLabel: string;
  guests: number;
  capacity: number | null;
  notes: string | null;
};

const VIEW_MAP: Record<ReservationCalendarView, string> = {
  dia: "timeGridDay",
  semana: "timeGridWeek",
  mes: "dayGridMonth",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  aprovada: { label: "Confirmado", className: "border-[#cdebd9] bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  pendente: { label: "Pendente", className: "border-[#f0dfbc] bg-[var(--color-warn-soft)] text-[var(--color-warn)]" },
  recusada: { label: "Recusado", className: "border-[#efc9c9] bg-[var(--color-danger-soft)] text-[var(--color-danger)]" },
};

function statusMeta(status: string, fallback: string) {
  return STATUS_META[status] ?? { label: fallback, className: "border-[var(--color-line)] bg-white text-[var(--color-muted)]" };
}

function eventContent(info: EventDisplayInfo) {
  const props = info.event.extendedProps as ReservationCalendarEvent;
  const tone = statusMeta(props.status, props.statusLabel);

  return (
    <div className="min-w-0 overflow-hidden rounded-[8px] px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
        <span className="truncate text-[11px] font-semibold leading-4">{props.timeLabel}</span>
      </div>
      <p className="mt-0.5 truncate text-[12px] font-semibold leading-4">{props.amenity}</p>
      <p className="truncate text-[11px] leading-4 opacity-80">{props.person}</p>
      <span className={`mt-1 inline-flex max-w-full rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-3 ${tone.className}`}>
        {tone.label}
      </span>
    </div>
  );
}

export function ReservationCalendar({
  events,
  selectedDate,
  view,
  onDateHref,
}: {
  events: ReservationCalendarEvent[];
  selectedDate: string;
  view: ReservationCalendarView;
  onDateHref: string;
}) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const effectiveSelectedId = events.some((event) => event.id === selectedId) ? selectedId : (events[0]?.id ?? "");

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        color: event.status === "recusada" ? "#C54848" : event.status === "pendente" ? "#A56B12" : "#90B800",
        textColor: event.status === "aprovada" ? "#1C2118" : "#FFFFFF",
        extendedProps: event,
      })),
    [events],
  );

  const selected = events.find((event) => event.id === effectiveSelectedId) ?? events[0] ?? null;
  const selectedTone = selected ? statusMeta(selected.status, selected.statusLabel) : null;

  function handleEventClick(info: EventClickInfo) {
    info.jsEvent.preventDefault();
    setSelectedId(info.event.id);
  }

  function handleDateClick(info: DateClickInfo) {
    const date = info.dateStr.slice(0, 10);
    if (date) window.location.href = `${onDateHref}${onDateHref.includes("?") ? "&" : "?"}date=${date}&view=dia`;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="agenda-calendar-shell overflow-x-auto overflow-y-hidden rounded-[12px] border border-[var(--color-line)] bg-white">
        <FullCalendar
          plugins={[formaPlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={ptBrLocale}
          initialView={VIEW_MAP[view]}
          initialDate={selectedDate}
          headerToolbar={false}
          allDaySlot={false}
          nowIndicator
          expandRows
          height="auto"
          contentHeight="auto"
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          dayMaxEvents={3}
          moreLinkText="mais"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: false }}
          events={calendarEvents}
          eventContent={eventContent}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
        />
      </div>

      <aside className="rounded-[12px] border border-[#dce9b3] bg-[var(--color-primary-soft)] p-4">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary-dark)]">Selecionado</p>
                <h3 className="mt-1 text-lg font-semibold leading-tight text-[var(--color-ink)]">{selected.amenity}</h3>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{selected.person}</p>
              </div>
              {selectedTone ? <span className={`chip shrink-0 ${selectedTone.className}`}>{selectedTone.label}</span> : null}
            </div>

            <dl className="grid gap-2 text-sm">
              <div className="rounded-[8px] bg-white px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Horário</dt>
                <dd className="mt-1 font-semibold text-[var(--color-ink)]">{selected.dateLabel} · {selected.timeLabel}</dd>
              </div>
              <div className="rounded-[8px] bg-white px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Unidade</dt>
                <dd className="mt-1 font-semibold text-[var(--color-ink)]">{selected.unitLabel}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[8px] bg-white px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Taxa</dt>
                  <dd className="mt-1 font-semibold text-[var(--color-ink)]">{selected.feeLabel}</dd>
                </div>
                <div className="rounded-[8px] bg-white px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Convidados</dt>
                  <dd className="mt-1 font-semibold text-[var(--color-ink)]">{selected.guests}</dd>
                </div>
              </div>
            </dl>

            {selected.notes ? <p className="rounded-[8px] border border-[#dce9b3] bg-white px-3 py-2 text-sm leading-6 text-[var(--color-muted)]">{selected.notes}</p> : null}
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-white text-[var(--color-primary-dark)]">
              <Icon name="calendar" size={18} />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">Nenhum agendamento no período</p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">Use os filtros ou crie uma nova reserva para preencher a agenda.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
