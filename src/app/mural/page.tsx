import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeed } from "@/db/seed";
import { amenities, announcements, condominiums, reservations } from "@/db/schema";
import { dateBR, isoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MuralPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await ensureSeed();
  const { c } = await searchParams;
  const currentDate = new Date().toLocaleDateString("pt-BR");
  const [condo] = c
    ? await db.select().from(condominiums).where(eq(condominiums.slug, c)).limit(1)
    : await db.select().from(condominiums).orderBy(asc(condominiums.id)).limit(1);

  if (!condo) {
    return <main className="flex min-h-screen items-center justify-center text-[var(--color-muted)]">Condomínio não encontrado.</main>;
  }

  const news = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.condoId, condo.id), eq(announcements.showOnTv, true)))
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt))
    .limit(5);

  const agenda = await db
    .select({ date: reservations.date, start: reservations.startTime, end: reservations.endTime, amenity: amenities.name, status: reservations.status })
    .from(reservations)
    .innerJoin(amenities, eq(amenities.id, reservations.amenityId))
    .where(and(eq(reservations.condoId, condo.id), gte(reservations.date, isoDate()), eq(reservations.status, "aprovada")))
    .orderBy(asc(reservations.date))
    .limit(6);

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] p-6 text-[var(--color-ink)] sm:p-8">
      <meta httpEquiv="refresh" content="120" />
      <header className="flex items-center justify-between border-b border-[var(--color-line)] pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--color-primary-dark)]">Mural digital</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{condo.name}</h1>
          <p className="mt-1 text-[var(--color-muted)]">{condo.address} · {condo.city}/{condo.state}</p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-semibold tabular-nums">{currentDate}</p>
          <p className="text-[var(--color-muted)]">Atualização automática a cada 2 minutos</p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold uppercase tracking-widest text-[var(--color-muted)]">Avisos</h2>
          {news.length === 0 ? (
            <p className="text-[var(--color-muted)]">Nenhum aviso publicado.</p>
          ) : (
            news.map((item) => (
              <article
                key={item.id}
                className={`rounded-[12px] border bg-white p-6 ${
                  item.priority === "alta" ? "border-[#efc9c9]" : "border-[var(--color-line)]"
                }`}
              >
                <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-[var(--color-muted)]">
                  <span>{item.category}</span>
                  <span>{dateBR(item.publishedAt)}</span>
                  {item.pinned ? <span className="rounded-[6px] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[var(--color-primary-dark)]">fixado</span> : null}
                </div>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 line-clamp-3 text-lg text-[var(--color-muted)]">{item.body}</p>
              </article>
            ))
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold uppercase tracking-widest text-[var(--color-muted)]">Agenda dos espaços</h2>
          {agenda.length === 0 ? (
            <p className="text-[var(--color-muted)]">Sem reservas confirmadas.</p>
          ) : (
            agenda.map((item, index) => (
              <div key={index} className="rounded-[12px] border border-[var(--color-line)] bg-white p-4">
                <p className="text-xl font-semibold">{item.amenity}</p>
                <p className="text-[var(--color-muted)]">
                  {dateBR(item.date)} · {item.start}–{item.end}
                </p>
              </div>
            ))
          )}
          <div className="rounded-[12px] border border-[#dce9b3] bg-[var(--color-primary-soft)] p-4 text-sm font-medium text-[var(--color-primary-dark)]">
            Encomendas são entregues mediante código de retirada. Visitantes devem apresentar QR Code e documento com
            foto na portaria.
          </div>
        </section>
      </div>
    </main>
  );
}
