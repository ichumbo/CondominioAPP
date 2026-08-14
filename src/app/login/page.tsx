import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureSeed } from "@/db/seed";
import { Icon } from "@/components/icon";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const DEMOS = [
  { email: "sindico@portariamais.com.br", label: "Síndica", desc: "Acesso administrativo completo" },
  { email: "portaria@portariamais.com.br", label: "Portaria", desc: "Visitantes, encomendas e turnos" },
  { email: "morador@portariamais.com.br", label: "Morador", desc: "Apto 302 · Bloco A" },
  { email: "admin@portariamais.com.br", label: "Super admin", desc: "Multi-condomínio e adoção" },
];

export default async function LoginPage() {
  await ensureSeed();
  const session = await getSession();
  if (session) redirect("/painel");

  return (
    <main className="min-h-screen bg-white text-[var(--color-ink)] lg:h-screen lg:overflow-hidden">
      <section className="grid min-h-screen lg:h-screen lg:min-h-0 lg:grid-cols-[45%_55%]">
        <div className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:h-screen lg:min-h-0 lg:px-16 xl:px-24">
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold text-[var(--color-ink)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-ink)]">
                P+
              </span>
              Portaria+
            </Link>
            <Link href="/status" className="btn-ghost btn-sm">
              <Icon name="check" size={15} />
              Status
            </Link>
          </header>

          <div className="flex flex-1 items-center py-8 lg:py-4">
            <div className="w-full max-w-[500px]">
              <div className="mb-7">
                <h1 className="text-[36px] font-semibold leading-tight tracking-tight text-[var(--color-ink)] sm:text-[42px]">
                  Bem-vindo de volta
                </h1>
                <p className="mt-3 max-w-md text-[15px] font-medium leading-7 text-[var(--color-muted)]">
                  Entre na sua conta para acessar agenda, portaria, comunicados e relatórios.
                </p>
              </div>

              <LoginForm demos={DEMOS} />
            </div>
          </div>

          <p className="text-xs text-[var(--color-subtle)]">© 2026 Portaria+</p>
        </div>

        <aside className="relative hidden min-h-screen overflow-hidden bg-[var(--color-primary)] text-[var(--color-ink)] lg:block">
          <div className="absolute right-10 top-8 flex items-center gap-2.5 text-lg font-semibold">
            <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-white/90 text-sm font-semibold text-[var(--color-primary-dark)]">
              P+
            </span>
            Portaria+
          </div>

          <div className="absolute inset-0 opacity-[0.09]" aria-hidden="true">
            <div className="grid h-full grid-cols-6 grid-rows-6">
              {Array.from({ length: 36 }).map((_, index) => (
                <div key={index} className="border border-[var(--color-primary-dark)]" />
              ))}
            </div>
          </div>

          <div className="absolute inset-x-16 top-1/2 -translate-y-1/2">
            <div className="flex aspect-[4/3] items-center justify-center rounded-[24px] border-2 border-dashed border-white/70 bg-white/10 text-center text-white">
              <div>
                <Icon name="building" size={84} strokeWidth={1.35} className="mx-auto" />
                <p className="mt-5 text-sm font-semibold uppercase tracking-wide">Imagem principal</p>
                <p className="mt-2 text-sm text-white/85">Espaço reservado para sua arte</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-10 right-10 max-w-[320px] text-right">
            <p className="text-[38px] font-semibold leading-none tracking-tight text-white xl:text-[46px]">
              Gestão condominial simples.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
