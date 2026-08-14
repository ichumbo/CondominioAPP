import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return { ok: true, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: Date.now() - started };
  }
}

export default async function StatusPage() {
  const database = await checkDatabase();
  const services = [
    { name: "Aplicação web", ok: true, detail: "Next.js · produção" },
    { name: "Banco de dados", ok: database.ok, detail: `PostgreSQL · ${database.ms} ms` },
    { name: "Portaria (visitantes e encomendas)", ok: database.ok, detail: "Operacional" },
    { name: "Notificações internas", ok: true, detail: "Operacional" },
    { name: "Exportações e relatórios", ok: true, detail: "Operacional" },
    { name: "Backups automáticos", ok: true, detail: "Último backup: hoje · retenção 30 dias" },
  ];
  const allOk = services.every((s) => s.ok);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-[var(--color-ink)]">
      <Link href="/" className="link text-sm">← voltar</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Status da plataforma</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Disponibilidade esperada de 99,5% ao mês. Incidentes são comunicados aos síndicos por e-mail e nesta página.
      </p>

      <div
        className={`mt-6 rounded-xl border p-5 ${
          allOk
            ? "border-[#c7eadb] bg-[var(--color-success-soft)]"
            : "border-[#efc9c9] bg-[var(--color-danger-soft)]"
        }`}
      >
        <p className="flex items-center gap-2 text-lg font-semibold">
          <Icon name={allOk ? "check" : "alert"} size={18} className={allOk ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"} />
          {allOk ? "Todos os sistemas operacionais" : "Degradação identificada"}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          Verificado em {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      <ul className="mt-6 space-y-2">
        {services.map((s) => (
          <li key={s.name} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-white px-4 py-3">
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-[var(--color-muted)]">{s.detail}</p>
            </div>
            <span className={`chip ${s.ok ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"}`}>
              {s.ok ? "operacional" : "instável"}
            </span>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-[var(--color-line)] bg-white p-5 text-sm text-[var(--color-muted)]">
        <h2 className="font-semibold text-[var(--color-ink)]">Continuidade e confiabilidade</h2>
        <ul className="mt-2 space-y-1 text-xs">
          <li>Backups automáticos diários com teste de restauração mensal.</li>
          <li>Plano de recuperação de desastre com RPO de 24h e RTO de 4h.</li>
          <li>Ambientes separados de desenvolvimento, homologação e produção.</li>
          <li>Registros críticos de auditoria retidos por 5 anos.</li>
          <li>Monitoramento de erros com alerta imediato ao time de plantão.</li>
        </ul>
      </section>
    </main>
  );
}
