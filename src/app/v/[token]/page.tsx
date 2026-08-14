import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSeed } from "@/db/seed";
import { blocks, condominiums, units, users, visitors, visits } from "@/db/schema";
import { dateTimeBR } from "@/lib/utils";
import { qrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export default async function VisitPassPage({ params }: { params: Promise<{ token: string }> }) {
  await ensureSeed();
  const { token } = await params;
  const [row] = await db
    .select({
      id: visits.id,
      status: visits.status,
      purpose: visits.purpose,
      validFrom: visits.validFrom,
      validUntil: visits.validUntil,
      qrToken: visits.qrToken,
      plate: visits.vehiclePlate,
      name: visitors.name,
      document: visitors.document,
      kind: visitors.kind,
      company: visitors.company,
      unit: units.number,
      block: blocks.name,
      host: users.name,
      condo: condominiums.name,
      address: condominiums.address,
    })
    .from(visits)
    .innerJoin(visitors, eq(visitors.id, visits.visitorId))
    .innerJoin(condominiums, eq(condominiums.id, visits.condoId))
    .leftJoin(units, eq(units.id, visits.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .leftJoin(users, eq(users.id, visits.hostUserId))
    .where(eq(visits.qrToken, token))
    .limit(1);

  if (!row) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-3 text-xl font-bold text-[var(--color-ink)]">Convite não encontrado</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            O código informado é inválido ou o convite foi cancelado. Procure a portaria.
          </p>
          <Link href="/" className="btn-primary mt-4">Voltar ao início</Link>
        </div>
      </main>
    );
  }

  const expired = new Date(row.validUntil) < new Date();
  const qr = await qrDataUrl(row.qrToken, 220);
  const statusLabel = expired && !["dentro", "finalizado"].includes(row.status) ? "expirado" : row.status;
  const tone =
    statusLabel === "autorizado"
      ? "border-[#cdebd9] bg-[var(--color-success-soft)] text-[var(--color-success)]"
      : statusLabel === "dentro"
        ? "border-[#dce9b3] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
        : statusLabel === "negado" || statusLabel === "expirado"
          ? "border-[#efc9c9] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
          : "border-[#f0dfbc] bg-[var(--color-warn-soft)] text-[var(--color-warn)]";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-surface-muted)] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[12px] border border-[var(--color-line)] bg-white">
        <div className="border-b border-[#dce9b3] bg-[var(--color-primary-soft)] px-6 py-5 text-[var(--color-ink)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary-dark)]">Convite de acesso</p>
          <h1 className="text-xl font-semibold">{row.condo}</h1>
          <p className="text-xs text-[var(--color-primary-dark)]">{row.address}</p>
        </div>

        <div className="flex flex-col items-center border-b border-[var(--color-line)] p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code do convite" className="rounded-[8px] border border-[var(--color-line)]" />
          <p className="mt-3 font-mono text-xs text-[var(--color-subtle)]">{row.qrToken}</p>
          <span className={`mt-3 rounded-full border px-3 py-1 text-xs font-semibold uppercase ${tone}`}>{statusLabel}</span>
        </div>

        <dl className="space-y-2 p-6 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted)]">Visitante</dt>
            <dd className="text-right font-semibold text-[var(--color-ink)]">{row.name}</dd>
          </div>
          {row.company ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Empresa</dt>
              <dd className="text-right text-[var(--color-ink)]">{row.company}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted)]">Documento</dt>
            <dd className="text-right text-[var(--color-ink)]">{row.document ?? "informar na portaria"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted)]">Destino</dt>
            <dd className="text-right text-[var(--color-ink)]">
              {row.block ?? ""} {row.unit ?? "—"} {row.host ? `· ${row.host}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted)]">Validade</dt>
            <dd className="text-right text-[var(--color-ink)]">
              {dateTimeBR(row.validFrom)} até {dateTimeBR(row.validUntil)}
            </dd>
          </div>
          {row.plate ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Veículo</dt>
              <dd className="text-right font-mono text-[var(--color-ink)]">{row.plate}</dd>
            </div>
          ) : null}
          {row.purpose ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Finalidade</dt>
              <dd className="text-right text-[var(--color-ink)]">{row.purpose}</dd>
            </div>
          ) : null}
        </dl>

        <p className="border-t border-[var(--color-line)] px-6 py-4 text-center text-[11px] text-[var(--color-subtle)]">
          Apresente este QR Code na portaria com documento com foto. O acesso é sempre confirmado por um operador humano.
        </p>
      </div>
    </main>
  );
}
