import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireCondo, requireSession } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader } from "@/components/ui";
import { dateTimeBR } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function markAllReadAction() {
  "use server";
  const session = await requireSession();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));
  revalidatePath("/painel/notificacoes");
  revalidatePath("/painel", "layout");
}

export default async function NotificacoesPage() {
  const { session, condoId } = await requireCondo();

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, session.user.id), eq(notifications.condoId, condoId)))
    .orderBy(desc(notifications.createdAt))
    .limit(60);

  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Avisos de portaria, encomendas, chamados, contratos e assembleias. Integração opcional com e-mail e WhatsApp."
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <button className="btn-primary btn-sm">Marcar todas como lidas ({unread})</button>
            </form>
          ) : null
        }
      />

      <Card title={`Caixa de entrada (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma notificação" icon="bell" />
        ) : (
          <ul className="space-y-2">
            {rows.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-3 ${
                  n.readAt ? "border-[var(--color-line)]" : "border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]  "
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[var(--color-ink)]">{n.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={n.channel === "whatsapp" ? "green" : "zinc"}>{n.channel}</Badge>
                    <span className="text-xs text-[var(--color-subtle)]">{dateTimeBR(n.createdAt)}</span>
                  </div>
                </div>
                {n.body ? <p className="mt-1 text-sm text-[var(--color-muted)]">{n.body}</p> : null}
                {n.link ? (
                  <Link href={n.link} className="link mt-1 inline-block text-xs">
                    abrir módulo
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4">
        <InfoNote>
          Canais adicionais (e-mail e WhatsApp) podem ser habilitados por condomínio. Comunicados em massa sempre exigem
          confirmação humana antes do disparo.
        </InfoNote>
      </div>
    </>
  );
}
