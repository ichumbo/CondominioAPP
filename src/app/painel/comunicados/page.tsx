import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, blocks, users } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/icon";
import { dateBR } from "@/lib/utils";
import { blockOptions } from "@/lib/queries";
import { createAnnouncementAction, deleteAnnouncementAction } from "@/lib/actions/gestao";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral",
  manutencao: "Manutenção",
  portaria: "Portaria",
  assembleia: "Assembleia",
  financeiro: "Financeiro",
};

const CATEGORY_ICONS: Record<string, IconName> = {
  geral: "megaphone",
  manutencao: "wrench",
  portaria: "shield",
  assembleia: "vote",
  financeiro: "wallet",
};

function labelFor(labels: Record<string, string>, value: string | null) {
  if (!value) return "Geral";
  return labels[value] ?? value;
}

function categoryIcon(category: string | null): IconName {
  return category ? (CATEGORY_ICONS[category] ?? "megaphone") : "megaphone";
}

export default async function ComunicadosPage() {
  const { session, condoId } = await requireCondo();
  const canPublish = [...ALL_STAFF, "porteiro"].includes(session.role);

  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      category: announcements.category,
      priority: announcements.priority,
      audience: announcements.audience,
      pinned: announcements.pinned,
      publishedAt: announcements.publishedAt,
      expiresAt: announcements.expiresAt,
      author: users.name,
      block: blocks.name,
    })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(blocks, eq(blocks.id, announcements.blockId))
    .where(eq(announcements.condoId, condoId))
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt));

  const blockList = await blockOptions(condoId);
  const pinnedCount = rows.filter((item) => item.pinned).length;
  const highPriorityCount = rows.filter((item) => item.priority === "alta").length;
  const segmentedCount = rows.filter((item) => item.audience === "bloco").length;
  const tvCount = rows.filter((item) => item.audience === "todos" || item.pinned).length;
  const summaryCards = [
    { label: "Publicados", value: rows.length, hint: "comunicados ativos", icon: "megaphone" as IconName },
    { label: "Fixados", value: pinnedCount, hint: "no topo do mural", icon: "pin" as IconName },
    { label: "Alta prioridade", value: highPriorityCount, hint: "exigem atenção", icon: "alert" as IconName },
    { label: "Segmentados", value: segmentedCount, hint: "por bloco", icon: "building" as IconName },
  ];

  return (
    <>
      <PageHeader
        title="Comunicados"
        subtitle="Publicação segmentada por bloco, prioridade, validade e envio automático de notificações aos moradores."
        actions={
          <Link href="/mural" target="_blank" className="btn-ghost btn-sm">
            <Icon name="panel" size={15} />
            Mural para TV da recepção
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="surface-hover flex min-h-[96px] items-start justify-between gap-3 rounded-[10px] border border-[var(--color-primary-hover)] bg-[var(--color-primary)] p-4 text-[var(--color-ink)]"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide">{card.label}</p>
              <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight">{card.value}</p>
              <p className="mt-2 text-[13px] font-medium leading-5">{card.hint}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white/85 text-[var(--color-primary-dark)]">
              <Icon name={card.icon} size={17} />
            </span>
          </div>
        ))}
      </section>

      <div className={`mt-6 grid gap-5 ${canPublish ? "xl:grid-cols-[minmax(0,1fr)_430px]" : ""}`}>
        <div className="space-y-4">
          <section className="rounded-[12px] border border-[#dce9b3] bg-[var(--color-primary-soft)] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-[var(--color-ink)]">
                <Icon name="bell" size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-[var(--color-ink)]">Central de avisos do condomínio</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                  {rows.length} comunicados publicados, {tvCount} prontos para o mural e {segmentedCount} segmentados por bloco.
                </p>
              </div>
            </div>
            <Link href="/mural" target="_blank" className="btn-dark btn-sm mt-4 sm:mt-0">
              <Icon name="arrow-right" size={15} />
              Abrir mural
            </Link>
          </section>

          {rows.length === 0 ? (
            <EmptyState title="Nenhum comunicado publicado" icon="megaphone" />
          ) : (
            rows.map((a) => (
              <article key={a.id} className="surface-hover overflow-hidden rounded-[12px] border border-[var(--color-line)] bg-white shadow-[0_1px_2px_rgba(16,17,20,0.04)]">
                <div className="flex">
                  <div className="w-1.5 shrink-0 bg-[var(--color-primary)]" />
                  <div className="min-w-0 flex-1 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
                          <Icon name={categoryIcon(a.category)} size={18} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {a.pinned ? <Badge tone="primary">Fixado</Badge> : null}
                            <Badge tone={a.priority === "alta" ? "red" : "zinc"}>{a.priority === "alta" ? "Alta" : "Normal"}</Badge>
                            <Badge>{labelFor(CATEGORY_LABELS, a.category)}</Badge>
                            <Badge tone="primary">{a.audience === "bloco" ? `Bloco ${a.block ?? ""}` : "Todos"}</Badge>
                          </div>
                          <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight text-[var(--color-ink)]">{a.title}</h2>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--color-muted)]">{a.body}</p>
                        </div>
                      </div>

                      {["superadmin", "sindico"].includes(session.role) ? (
                        <form action={deleteAnnouncementAction} className="no-print sm:shrink-0">
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn-ghost btn-sm">
                            <Icon name="x" size={14} />
                            Remover
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-2 border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-muted)] sm:grid-cols-3">
                      <span className="flex items-center gap-2 rounded-[8px] bg-[var(--color-surface-muted)] px-3 py-2">
                        <Icon name="clock" size={14} />
                        {dateBR(a.publishedAt)}
                      </span>
                      <span className="flex items-center gap-2 rounded-[8px] bg-[var(--color-surface-muted)] px-3 py-2">
                        <Icon name="users" size={14} />
                        {a.author ?? "Administração"}
                      </span>
                      <span className="flex items-center gap-2 rounded-[8px] bg-[var(--color-surface-muted)] px-3 py-2">
                        <Icon name="calendar" size={14} />
                        {a.expiresAt ? `Até ${dateBR(a.expiresAt)}` : "Sem expiração"}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {canPublish ? (
          <aside className="card-flat h-fit overflow-hidden xl:sticky xl:top-6">
            <div className="border-b border-[var(--color-primary-hover)] bg-[var(--color-primary)] p-5 text-[var(--color-ink)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white/85 text-[var(--color-primary-dark)]">
                  <Icon name="send" size={18} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Novo comunicado</h2>
                  <p className="mt-1 text-sm leading-6">Publique no app, segmente o público e mantenha o mural atualizado.</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <form action={createAnnouncementAction} className="space-y-4">
                <label className="block">
                  <span className="label">Título</span>
                  <input name="title" className="input" required />
                </label>
                <label className="block">
                  <span className="label">Mensagem</span>
                  <textarea name="body" rows={7} className="input" required />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">Categoria</span>
                    <select name="category" className="input">
                      <option value="geral">Geral</option>
                      <option value="manutencao">Manutenção</option>
                      <option value="portaria">Portaria</option>
                      <option value="assembleia">Assembleia</option>
                      <option value="financeiro">Financeiro</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Prioridade</span>
                    <select name="priority" className="input">
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">Público</span>
                    <select name="audience" className="input">
                      <option value="todos">Todos</option>
                      <option value="bloco">Bloco específico</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Bloco</span>
                    <select name="blockId" className="input">
                      <option value="">-</option>
                      {blockList.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="label">Expira em</span>
                  <input type="date" name="expiresAt" className="input" />
                </label>
                <div className="rounded-[10px] border border-[#dce9b3] bg-[var(--color-primary-soft)] p-3">
                  <div className="mb-3 flex items-start gap-2 text-sm leading-6 text-[var(--color-muted)]">
                    <Icon name="bell" size={16} className="mt-1 shrink-0 text-[var(--color-primary-dark)]" />
                    <p>Use as opções abaixo para dar destaque e controlar a exibição no mural da recepção.</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <input type="checkbox" name="pinned" className="h-4 w-4 accent-[var(--color-primary)]" /> Fixar no topo
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <input type="checkbox" name="showOnTv" defaultChecked className="h-4 w-4 accent-[var(--color-primary)]" /> Exibir no mural da TV
                  </label>
                </div>
                <button className="btn-primary w-full">
                  <Icon name="send" size={16} />
                  Publicar e notificar
                </button>
              </form>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
