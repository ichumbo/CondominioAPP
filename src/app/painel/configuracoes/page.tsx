import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/icon";
import { saveCondoSettingsAction, updateOnboardingAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const { session, condo } = await requireRole(["superadmin", "sindico"]);

  const sections: { href: string; title: string; desc: string; icon: IconName; badge?: string }[] = [
    { href: "/painel/moradores", title: "Moradores e unidades", desc: "Cadastros, convites e importação.", icon: "users" },
    { href: "/painel/implantacao", title: "Implantação", desc: "Assistente de configuração inicial.", icon: "sparkles", badge: condo.onboardingDone ? "concluída" : "em andamento" },
    { href: "/painel/auditoria", title: "Auditoria", desc: "Trilha de ações e acessos.", icon: "lock" },
    { href: "/painel/ajuda", title: "Central de ajuda", desc: "Suporte e base de conhecimento.", icon: "help" },
  ];
  if (session.role === "superadmin") {
    sections.push({ href: "/painel/adocao", title: "Painel do SaaS", desc: "Adoção e implantação multi-condomínio.", icon: "trending" });
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados do condomínio e atalhos de administração." />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Dados do condomínio">
            <form action={saveCondoSettingsAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <input name="name" className="input" defaultValue={condo.name} required />
                </Field>
                <Field label="CNPJ">
                  <input name="cnpj" className="input" defaultValue={condo.cnpj ?? ""} />
                </Field>
              </div>
              <Field label="Endereço">
                <input name="address" className="input" defaultValue={condo.address ?? ""} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Cidade" className="sm:col-span-2">
                  <input name="city" className="input" defaultValue={condo.city ?? ""} />
                </Field>
                <Field label="UF">
                  <input name="state" className="input" defaultValue={condo.state ?? ""} maxLength={2} />
                </Field>
              </div>
              <Field label="Plano">
                <input className="input opacity-70" defaultValue={condo.plan} disabled />
              </Field>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-ink)]">
                <input type="checkbox" name="publicPage" defaultChecked={condo.publicPage} className="h-4 w-4 accent-[var(--color-primary)]" />
                Exibir página pública do condomínio
              </label>
              <div className="flex justify-end">
                <button className="btn-primary"><Icon name="check" size={16} /> Salvar alterações</button>
              </div>
            </form>
          </Card>

          <Card title="Atalhos" className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="surface-hover flex items-center gap-3 rounded-[12px] border border-[var(--color-line)] p-3.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <Icon name={s.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">{s.title}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">{s.desc}</p>
                  </div>
                  {s.badge ? <Badge tone={s.badge === "concluída" ? "green" : "amber"}>{s.badge}</Badge> : null}
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Status da implantação">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Etapa atual</span>
                <span className="font-semibold text-[var(--color-ink)]">{condo.onboardingStep}/9</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Publicação</span>
                <Badge tone={condo.onboardingDone ? "green" : "amber"}>{condo.onboardingDone ? "publicado" : "rascunho"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Armazenamento</span>
                <span className="font-semibold text-[var(--color-ink)]">{condo.storageUsedMb} MB</span>
              </div>
            </div>
            <form action={updateOnboardingAction} className="mt-4">
              <input type="hidden" name="step" value={condo.onboardingStep} />
              <input type="hidden" name="done" value={condo.onboardingDone ? "off" : "on"} />
              <button className="btn-ghost btn-sm w-full">
                <Icon name="check" size={15} />
                {condo.onboardingDone ? "Reabrir publicação" : "Concluir publicação"}
              </button>
            </form>
            <Link href="/painel/implantacao" className="btn-link mt-2 text-xs">Abrir assistente</Link>
          </Card>

          <Card title="Minha conta">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Nome</span>
                <span className="font-medium text-[var(--color-ink)]">{session.user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">E-mail</span>
                <span className="truncate text-[var(--color-ink)]">{session.user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Perfil</span>
                <span className="font-medium text-[var(--color-ink)]">{session.role}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
