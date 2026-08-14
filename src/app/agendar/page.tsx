import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeed } from "@/db/seed";
import { amenities, condominiums, reservations } from "@/db/schema";
import { Badge, EmptyState, InfoNote } from "@/components/ui";
import { Icon } from "@/components/icon";
import { addDays, dateBR, isoDate, money } from "@/lib/utils";

export const dynamic = "force-dynamic";

function addHours(time: string, hours: number) {
  const [h = "0", m = "0"] = time.split(":");
  return `${String(Number(h) + hours).padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function buildSlots(open = "08:00", close = "22:00") {
  const start = Number(open.slice(0, 2));
  const end = Number(close.slice(0, 2));
  return Array.from({ length: Math.max(0, end - start) }, (_, index) => `${String(start + index).padStart(2, "0")}:00`);
}

export default async function PublicBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; date?: string; time?: string }>;
}) {
  await ensureSeed();
  const params = await searchParams;
  const [condo] = await db.select().from(condominiums).orderBy(condominiums.id).limit(1);
  const services = condo
    ? await db
        .select()
        .from(amenities)
        .where(and(eq(amenities.condoId, condo.id), eq(amenities.active, true)))
        .orderBy(amenities.name)
    : [];

  const selectedService = services.find((item) => String(item.id) === params.service) ?? services[0];
  const selectedDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : isoDate();
  const existing =
    condo && selectedService
      ? await db
          .select({ start: reservations.startTime, end: reservations.endTime })
          .from(reservations)
          .where(
            and(
              eq(reservations.condoId, condo.id),
              eq(reservations.amenityId, selectedService.id),
              eq(reservations.date, selectedDate),
              inArray(reservations.status, ["pendente", "aprovada"]),
            ),
          )
      : [];

  const slots = selectedService
    ? buildSlots(selectedService.openTime ?? "08:00", selectedService.closeTime ?? "22:00").filter((slot) => {
        const slotEnd = addHours(slot, 2);
        return !existing.some((item) => slot < item.end && slotEnd > item.start);
      })
    : [];
  const selectedTime = slots.includes(params.time ?? "") ? params.time : "";
  const dayOptions = [0, 1, 2, 3, 4].map((offset) => isoDate(addDays(offset, new Date(`${selectedDate}T12:00:00`))));

  const hrefFor = (next: Partial<{ service: string; date: string; time: string }>) => {
    const url = new URLSearchParams();
    if (next.service ?? selectedService?.id) url.set("service", String(next.service ?? selectedService?.id));
    url.set("date", next.date ?? selectedDate);
    if (next.time ?? selectedTime) url.set("time", String(next.time ?? selectedTime));
    return `/agendar?${url.toString()}`;
  };

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] px-4 py-6 text-[var(--color-ink)] sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-ink)]">
              P+
            </span>
            Portaria+
          </Link>
          <Link href="/login" className="btn-ghost btn-sm">Entrar</Link>
        </header>

        <section className="rounded-[16px] border border-[var(--color-line)] bg-white p-5 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <Badge tone="primary">Agendamento online</Badge>
              <h1 className="mt-4 max-w-2xl text-[34px] font-semibold leading-tight tracking-tight sm:text-[44px]">
                Escolha o espaço, a data e o melhor horário.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
                Consulte a disponibilidade antes de entrar. A confirmação usa as regras reais do condomínio.
              </p>

              <div className="mt-8 space-y-7">
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">1. Serviço</h2>
                  {services.length === 0 ? (
                    <EmptyState title="Nenhum serviço disponível" icon="calendar" />
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {services.map((service) => (
                        <Link
                          key={service.id}
                          href={hrefFor({ service: String(service.id), time: "" })}
                          className={`rounded-[12px] border p-4 transition-colors ${
                            selectedService?.id === service.id
                              ? "border-[#dce9b3] bg-[var(--color-primary-soft)]"
                              : "border-[var(--color-line)] bg-white hover:bg-[var(--color-surface-muted)]"
                          }`}
                        >
                          <p className="font-semibold">{service.name}</p>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">
                            {service.openTime}–{service.closeTime} · capacidade {service.capacity}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[var(--color-primary-dark)]">
                            {service.feeCents ? money(service.feeCents) : "sem taxa"}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">2. Data</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dayOptions.map((date, offset) => {
                      return (
                        <Link
                          key={date}
                          href={hrefFor({ date, time: "" })}
                          className={`tab ${selectedDate === date ? "tab-active" : "border border-[var(--color-line)] bg-white"}`}
                        >
                          {offset === 0 ? "Hoje" : dateBR(date)}
                        </Link>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">3. Horário</h2>
                  {slots.length === 0 ? (
                    <div className="mt-3">
                      <EmptyState title="Nenhum horário disponível" description="Escolha outra data ou serviço." icon="clock" />
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => (
                        <Link
                          key={slot}
                          href={hrefFor({ time: slot })}
                          className={`min-h-11 rounded-[8px] border px-3 py-2.5 text-center text-sm font-semibold ${
                            selectedTime === slot
                              ? "border-[#dce9b3] bg-[var(--color-primary)] text-[var(--color-ink)]"
                              : "border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)]"
                          }`}
                        >
                          {slot}
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            <aside className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-5">
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Resumo</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Condomínio</dt>
                  <dd className="mt-1 font-semibold">{condo?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Serviço</dt>
                  <dd className="mt-1">{selectedService?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Data</dt>
                  <dd className="mt-1">{dateBR(selectedDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Horário</dt>
                  <dd className="mt-1">{selectedTime ? `${selectedTime}–${addHours(selectedTime, 2)}` : "Escolha um horário"}</dd>
                </div>
              </dl>

              <div className="mt-5">
                {selectedTime ? (
                  <Link href="/login" className="btn-primary w-full">Entrar para confirmar</Link>
                ) : (
                  <button className="btn-primary w-full" disabled>Escolha um horário</button>
                )}
              </div>

              <div className="mt-5">
                <InfoNote>
                  O agendamento público sem login ainda depende de ação backend própria para cadastrar dados pessoais e pagamento.
                </InfoNote>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
