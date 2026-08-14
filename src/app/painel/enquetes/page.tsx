import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pollOptions, pollVotes, polls } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Progress } from "@/components/ui";
import { dateTimeBR, percent } from "@/lib/utils";
import { closePollAction, createPollAction, votePollAction } from "@/lib/actions/gestao";

export const dynamic = "force-dynamic";

export default async function EnquetesPage() {
  const { session, condoId } = await requireCondo();
  const canManage = ALL_STAFF.includes(session.role);

  const rows = await db.select().from(polls).where(eq(polls.condoId, condoId)).orderBy(desc(polls.createdAt));
  const ids = rows.map((r) => r.id);
  const options = ids.length ? await db.select().from(pollOptions).where(inArray(pollOptions.pollId, ids)) : [];
  const votes = ids.length ? await db.select().from(pollVotes).where(inArray(pollVotes.pollId, ids)) : [];

  return (
    <>
      <PageHeader
        title="Enquetes"
        subtitle="Consultas rápidas e não deliberativas. Decisões com efeito jurídico devem ocorrer em assembleia."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyState title="Nenhuma enquete" icon="🗳" />
          ) : (
            rows.map((poll) => {
              const pollOpts = options.filter((o) => o.pollId === poll.id);
              const pollVotesList = votes.filter((v) => v.pollId === poll.id);
              const myVote = pollVotesList.find((v) => v.userId === session.user.id);
              const total = pollVotesList.length;
              return (
                <Card
                  key={poll.id}
                  title={poll.question}
                  description={poll.description ?? undefined}
                  actions={
                    <>
                      <Badge tone={poll.status === "aberta" ? "green" : "zinc"}>{poll.status}</Badge>
                      {canManage && poll.status === "aberta" ? (
                        <form action={closePollAction}>
                          <input type="hidden" name="id" value={poll.id} />
                          <button className="btn-ghost btn-sm">Encerrar</button>
                        </form>
                      ) : null}
                    </>
                  }
                >
                  <ul className="space-y-3">
                    {pollOpts.map((option) => {
                      const count = pollVotesList.filter((v) => v.optionId === option.id).length;
                      const pct = percent(count, total);
                      return (
                        <li key={option.id}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-[var(--color-ink)]">{option.label}</span>
                            <span className="text-xs text-[var(--color-muted)]">
                              {count} voto(s) · {pct}%
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Progress value={pct} />
                            {poll.status === "aberta" && !myVote ? (
                              <form action={votePollAction}>
                                <input type="hidden" name="pollId" value={poll.id} />
                                <input type="hidden" name="optionId" value={option.id} />
                                <button className="btn-ghost btn-sm">Votar</button>
                              </form>
                            ) : null}
                            {myVote?.optionId === option.id ? <Badge tone="blue">seu voto</Badge> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-[var(--color-subtle)]">
                    {total} participação(ões){poll.endsAt ? ` · encerra em ${dateTimeBR(poll.endsAt)}` : ""}
                  </p>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          {canManage ? (
            <Card title="Nova enquete">
              <form action={createPollAction} className="space-y-3">
                <label className="block">
                  <span className="label">Pergunta</span>
                  <input name="question" className="input" required />
                </label>
                <label className="block">
                  <span className="label">Descrição</span>
                  <textarea name="description" rows={2} className="input" />
                </label>
                <label className="block">
                  <span className="label">Opções (uma por linha)</span>
                  <textarea name="options" rows={4} className="input" required placeholder={"Opção A\nOpção B"} />
                </label>
                <label className="block">
                  <span className="label">Encerra em</span>
                  <input type="datetime-local" name="endsAt" className="input" />
                </label>
                <button className="btn-primary w-full">Publicar enquete</button>
              </form>
            </Card>
          ) : null}

          <InfoNote tone="amber">
            Enquetes têm caráter consultivo. Para deliberações válidas, utilize o módulo de assembleias, respeitando a
            convenção do condomínio e a legislação aplicável.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
