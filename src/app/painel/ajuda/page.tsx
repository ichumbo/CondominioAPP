import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { helpArticles, supportTickets, users } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, statusTone } from "@/components/ui";
import { dateTimeBR } from "@/lib/utils";
import { answerSupportTicketAction, createSupportTicketAction, rateSupportAction } from "@/lib/actions/admin";
import { rankByQuery } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function AjudaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { session, condoId } = await requireCondo();
  const { q } = await searchParams;
  const isSupport = session.role === "superadmin";

  const articles = await db.select().from(helpArticles).orderBy(helpArticles.category);
  const list = q ? rankByQuery(articles, ["title", "body", "tags", "category"], q) : articles;

  const tickets = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      body: supportTickets.body,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      answer: supportTickets.answer,
      satisfaction: supportTickets.satisfaction,
      createdAt: supportTickets.createdAt,
      author: users.name,
    })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.userId))
    .where(isSupport ? or(eq(supportTickets.condoId, condoId), eq(supportTickets.condoId, condoId)) : eq(supportTickets.condoId, condoId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(20);

  const categories = [...new Set(articles.map((a) => a.category))];

  return (
    <>
      <PageHeader
        title="Central de ajuda"
        subtitle="Base de conhecimento pesquisável, tutoriais por tela, vídeos de treinamento e abertura de suporte com histórico."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Base de conhecimento">
            <form className="flex flex-wrap gap-2">
              <input name="q" defaultValue={q ?? ""} className="input flex-1" placeholder="Pesquisar: visitante, encomenda, assembleia..." />
              <button className="btn-primary">Pesquisar</button>
            </form>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <Badge key={c} tone="blue">{c}</Badge>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {list.length === 0 ? (
                <EmptyState title="Nada encontrado" description="Tente outros termos ou abra um chamado de suporte." icon="help" />
              ) : (
                list.map((article) => (
                  <details key={article.id} className="rounded-lg border border-[var(--color-line)] p-3 ">
                    <summary className="cursor-pointer font-semibold text-[var(--color-ink)]">
                      {article.title}
                      <span className="ml-2 text-xs font-normal text-[var(--color-subtle)]">{article.category}</span>
                    </summary>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">{article.body}</p>
                    {article.videoUrl ? (
                      <p className="mt-2 text-xs text-[var(--color-primary-dark)]">Vídeo de treinamento: {article.videoUrl}</p>
                    ) : null}
                  </details>
                ))
              )}
            </div>
          </Card>

          <Card title="Meus chamados de suporte">
            {tickets.length === 0 ? (
              <EmptyState title="Nenhum chamado aberto" icon="help" />
            ) : (
              <ul className="space-y-2">
                {tickets.map((t) => (
                  <li key={t.id} className="rounded-lg border border-[var(--color-line)] p-3 ">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--color-ink)]">{t.subject}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={t.priority === "alta" ? "red" : "zinc"}>{t.priority}</Badge>
                        <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{t.body}</p>
                    <p className="text-xs text-[var(--color-subtle)]">
                      {t.author} · {dateTimeBR(t.createdAt)} · categoria {t.category}
                    </p>
                    {t.answer ? (
                      <p className="mt-2 rounded-lg border border-[#cdebd9] bg-[var(--color-success-soft)] p-2 text-xs text-[var(--color-success)]   ">
                        <strong>Suporte:</strong> {t.answer}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 no-print">
                      {isSupport && !t.answer ? (
                        <Panel summary="Responder" tone="ghost">
                          <form action={answerSupportTicketAction} className="space-y-2">
                            <input type="hidden" name="id" value={t.id} />
                            <textarea name="answer" rows={3} className="input" required />
                            <button className="btn-primary btn-sm">Responder</button>
                          </form>
                        </Panel>
                      ) : null}
                      {t.answer && !t.satisfaction ? (
                        <form action={rateSupportAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={t.id} />
                          <select name="satisfaction" className="input py-1 text-xs">
                            {[5, 4, 3, 2, 1].map((n) => (
                              <option key={n} value={n}>{n}/5</option>
                            ))}
                          </select>
                          <button className="btn-success btn-sm">Avaliar atendimento</button>
                        </form>
                      ) : null}
                      {t.satisfaction ? <Badge tone="green">avaliado {t.satisfaction}/5</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Abrir chamado de suporte">
            <form action={createSupportTicketAction} className="space-y-2">
              <input name="subject" className="input" placeholder="Assunto" required />
              <textarea name="body" rows={4} className="input" placeholder="Descreva o que aconteceu" required />
              <div className="grid grid-cols-2 gap-2">
                <select name="category" className="input">
                  <option value="duvida">Dúvida</option>
                  <option value="incidente">Incidente</option>
                  <option value="treinamento">Treinamento</option>
                  <option value="melhoria">Sugestão</option>
                </select>
                <select name="priority" className="input">
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <button className="btn-primary w-full">Enviar</button>
            </form>
          </Card>

          <Card title="Tour inicial">
            <ol className="list-decimal space-y-1.5 pl-4 text-sm text-[var(--color-muted)]">
              <li>Escolha o condomínio ativo na barra lateral.</li>
              <li>Portaria: valide QR Codes e registre entradas em <strong>Painel da portaria</strong>.</li>
              <li>Encomendas: registre e entregue com código e assinatura digital.</li>
              <li>Livro de ocorrências: registre o turno e peça ciência do síndico.</li>
              <li>Administração: acompanhe manutenções, contratos e financeiro.</li>
            </ol>
          </Card>

          <Card title="Confiabilidade do serviço">
            <ul className="space-y-1.5 text-xs text-[var(--color-muted)]">
              <li>Backups automáticos diários com teste de restauração mensal</li>
              <li>Ambientes separados de desenvolvimento e produção</li>
              <li>Monitoramento de erros e página pública de status</li>
              <li>Política de retenção e plano de recuperação de desastre</li>
              <li>Disponibilidade esperada de 99,5% ao mês</li>
            </ul>
            <a href="/status" target="_blank" className="btn-ghost btn-sm mt-3">Ver página de status</a>
          </Card>

          <InfoNote>
            O suporte só acessa dados do condomínio mediante registro na trilha de auditoria, identificando o operador e
            o motivo do acesso.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
