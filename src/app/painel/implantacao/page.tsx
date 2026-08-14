import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { amenities, blocks, importJobs, memberships, units, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Progress, Stat } from "@/components/ui";
import { dateTimeBR, percent } from "@/lib/utils";
import { importResidentsAction } from "@/lib/actions/gestao";
import { saveCondoSettingsAction, updateOnboardingAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: 1, title: "Dados do condomínio", desc: "Razão social, CNPJ, endereço e responsável legal." },
  { n: 2, title: "Cadastro dos blocos", desc: "Estrutura de torres, blocos e pavimentos." },
  { n: 3, title: "Importação das unidades", desc: "Planilha com unidades, fração ideal e vagas." },
  { n: 4, title: "Importação dos moradores", desc: "Proprietários, inquilinos e contatos." },
  { n: 5, title: "Configuração dos espaços", desc: "Áreas comuns, regras, taxas e horários." },
  { n: 6, title: "Personalização das categorias", desc: "Chamados, documentos e ocorrências." },
  { n: 7, title: "Convite dos administradores", desc: "Síndico, conselho, zelador e portaria." },
  { n: 8, title: "Disparo dos convites", desc: "Envio em massa para moradores." },
  { n: 9, title: "Revisão e publicação", desc: "Checagem final e liberação do acesso." },
];

export default async function ImplantacaoPage() {
  const { condo, condoId } = await requireRole(["superadmin", "sindico"]);

  const [blockCount] = await db.select({ n: count() }).from(blocks).where(eq(blocks.condoId, condoId));
  const [unitCount] = await db.select({ n: count() }).from(units).where(eq(units.condoId, condoId));
  const [peopleCount] = await db.select({ n: count() }).from(memberships).where(eq(memberships.condoId, condoId));
  const [amenityCount] = await db.select({ n: count() }).from(amenities).where(eq(amenities.condoId, condoId));

  const people = await db
    .select({ status: memberships.status, firstAccessAt: users.firstAccessAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.condoId, condoId));
  const accessed = people.filter((p) => p.firstAccessAt).length;

  const jobs = await db.select().from(importJobs).where(eq(importJobs.condoId, condoId)).orderBy(desc(importJobs.createdAt)).limit(5);
  const progress = percent(condo.onboardingStep, STEPS.length);

  return (
    <>
      <PageHeader
        title="Assistente de implantação"
        subtitle="Etapas guiadas com modelos de planilha, validação prévia e publicação controlada do condomínio."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Progresso" value={`${progress}%`} tone={condo.onboardingDone ? "green" : "amber"} hint={condo.onboardingDone ? "publicado" : `etapa ${condo.onboardingStep}`} />
        <Stat label="Blocos / unidades" value={`${blockCount.n}/${unitCount.n}`} />
        <Stat label="Pessoas vinculadas" value={peopleCount.n} hint={`${accessed} com primeiro acesso`} />
        <Stat label="Espaços configurados" value={amenityCount.n} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Etapas da implantação">
            <Progress value={progress} />
            <ol className="mt-4 space-y-2">
              {STEPS.map((step) => {
                const done = step.n < condo.onboardingStep || condo.onboardingDone;
                const current = step.n === condo.onboardingStep && !condo.onboardingDone;
                return (
                  <li
                    key={step.n}
                    className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                      current ? "border-[#dce9b3] bg-[var(--color-primary-soft)]" : "border-[var(--color-line)]"
                    }`}
                  >
                    <div className="flex gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          done ? "bg-[var(--color-success)] text-white" : current ? "bg-[var(--color-primary)] text-[var(--color-ink)]" : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
                        }`}
                      >
                        {done ? "✓" : step.n}
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">{step.title}</p>
                        <p className="text-xs text-[var(--color-muted)]">{step.desc}</p>
                      </div>
                    </div>
                    {!done ? (
                      <form action={updateOnboardingAction} className="no-print">
                        <input type="hidden" name="step" value={step.n + 1} />
                        <input type="hidden" name="done" value={step.n === STEPS.length ? "on" : "off"} />
                        <button className="btn-ghost btn-sm">Concluir</button>
                      </form>
                    ) : (
                      <Badge tone="green">concluída</Badge>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title="Importações e erros de validação">
            {jobs.length === 0 ? (
              <EmptyState title="Nenhuma importação realizada" icon="📥" />
            ) : (
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li key={job.id} className="rounded-lg border border-[var(--color-line)] p-3 text-sm ">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--color-ink)]">{job.fileName}</span>
                      <span className="text-xs text-[var(--color-subtle)]">{dateTimeBR(job.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <Badge>{job.kind}</Badge>
                      <Badge tone="green">{job.succeeded} ok</Badge>
                      {job.failed > 0 ? <Badge tone="red">{job.failed} com erro</Badge> : null}
                      <Badge tone="zinc">{job.total} linhas</Badge>
                    </div>
                    {job.errors && job.errors.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-[var(--color-danger)] ">
                        {job.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Dados do condomínio">
            <form action={saveCondoSettingsAction} className="space-y-2">
              <input name="name" className="input" defaultValue={condo.name} required />
              <input name="cnpj" className="input" defaultValue={condo.cnpj ?? ""} placeholder="CNPJ" />
              <input name="address" className="input" defaultValue={condo.address ?? ""} placeholder="Endereço" />
              <div className="grid grid-cols-3 gap-2">
                <input name="city" className="input col-span-2" defaultValue={condo.city ?? ""} placeholder="Cidade" />
                <input name="state" className="input" defaultValue={condo.state ?? ""} placeholder="UF" maxLength={2} />
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <input type="checkbox" name="publicPage" defaultChecked={condo.publicPage} className="h-4 w-4" />
                Publicar página pública do condomínio
              </label>
              <button className="btn-primary w-full">Salvar</button>
            </form>
          </Card>

          <Panel summary="Modelos de planilha">
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-[var(--color-ink)]">Unidades</p>
                <p className="rounded bg-[var(--color-surface-muted)] p-2 font-mono text-[11px] ">bloco;unidade;andar;fracao;vagas</p>
                <a className="link" href="/api/modelos/unidades" download>baixar modelo CSV</a>
              </div>
              <div>
                <p className="font-bold text-[var(--color-ink)]">Moradores</p>
                <p className="rounded bg-[var(--color-surface-muted)] p-2 font-mono text-[11px] ">bloco;unidade;nome;email;telefone</p>
                <a className="link" href="/api/modelos/moradores" download>baixar modelo CSV</a>
              </div>
            </div>
          </Panel>

          <Panel summary="📥 Importar moradores agora">
            <form action={importResidentsAction} className="space-y-2">
              <textarea name="csv" rows={6} className="input font-mono text-xs" placeholder="bloco;unidade;nome;email;telefone" required />
              <input name="fileName" className="input" defaultValue="importacao-implantacao.csv" />
              <button className="btn-dark btn-sm w-full">Validar e importar</button>
            </form>
          </Panel>

          <InfoNote>
            A validação verifica formato de e-mail, duplicidade de cadastro e existência da unidade antes de gravar
            qualquer registro. Nada é publicado aos moradores até a etapa final.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
