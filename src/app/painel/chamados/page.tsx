import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { blocks, ticketComments, tickets, units, users } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, StatCard, TableWrap, statusLabel, statusTone } from "@/components/ui";
import { Icon } from "@/components/icon";
import { dateBR, dateTimeBR } from "@/lib/utils";
import { peopleOptions, unitOptions } from "@/lib/queries";
import { commentTicketAction, createTicketAction, rateTicketAction, updateTicketAction } from "@/lib/actions/gestao";

export const dynamic = "force-dynamic";

const STATUS = ["aberto", "em_andamento", "aguardando_morador", "concluido"];
const STATUS_OPTIONS = [
  { key: "todos", label: "Todos" },
  { key: "aberto", label: "Em aberto" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "aguardando_morador", label: "Aguardando morador" },
  { key: "concluido", label: "Concluídos" },
];
const PRIORITIES = ["baixa", "media", "alta"];
const CATEGORIES = ["manutencao", "seguranca", "convivencia", "limpeza", "administrativo"];
const STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_morador: "Aguardando morador",
  concluido: "Concluído",
};
const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
const CATEGORY_LABELS: Record<string, string> = {
  manutencao: "Manutenção",
  seguranca: "Segurança",
  convivencia: "Convivência",
  limpeza: "Limpeza",
  administrativo: "Administrativo",
};

function labelFor(value: string, labels: Record<string, string>) {
  return labels[value] ?? statusLabel(value);
}

function dueSummary(dueAt: Date | string | null | undefined, status: string, now: Date) {
  if (status === "concluido") return "Concluído";
  if (!dueAt) return "Sem prazo";
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (Number.isNaN(due.getTime())) return "Sem prazo";
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} em atraso`;
  if (days === 0) return "Vence hoje";
  return `Em ${days} dia${days === 1 ? "" : "s"}`;
}

export default async function ChamadosPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; q?: string; p?: string; c?: string; view?: string }>;
}) {
  const { session, condoId } = await requireCondo();
  const { s, q = "", p = "", c = "", view = "cards" } = await searchParams;
  const isStaff = ALL_STAFF.includes(session.role);
  const activeStatus = s && STATUS.includes(s) ? s : "todos";
  const activeView = view === "table" ? "table" : "cards";
  const search = q.trim();

  const scope = session.role === "morador" ? eq(tickets.openedById, session.user.id) : undefined;
  const statusFilter = activeStatus !== "todos" ? eq(tickets.status, activeStatus) : undefined;
  const priorityFilter = PRIORITIES.includes(p) ? eq(tickets.priority, p) : undefined;
  const categoryFilter = CATEGORIES.includes(c) ? eq(tickets.category, c) : undefined;
  const searchFilter = search
    ? or(ilike(tickets.title, `%${search}%`), ilike(tickets.description, `%${search}%`), ilike(tickets.code, `%${search}%`))
    : undefined;

  const rows = await db
    .select({
      id: tickets.id,
      code: tickets.code,
      title: tickets.title,
      description: tickets.description,
      category: tickets.category,
      priority: tickets.priority,
      status: tickets.status,
      aiPriority: tickets.aiPriority,
      aiSummary: tickets.aiSummary,
      dueAt: tickets.dueAt,
      createdAt: tickets.createdAt,
      rating: tickets.rating,
      assignedToId: tickets.assignedToId,
      openedBy: users.name,
      unit: units.number,
      block: blocks.name,
    })
    .from(tickets)
    .leftJoin(users, eq(users.id, tickets.openedById))
    .leftJoin(units, eq(units.id, tickets.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(and(eq(tickets.condoId, condoId), scope, statusFilter, priorityFilter, categoryFilter, searchFilter))
    .orderBy(desc(tickets.createdAt))
    .limit(80);

  const ids = rows.map((r) => r.id);
  const comments = ids.length
    ? await db
        .select({
          id: ticketComments.id,
          ticketId: ticketComments.ticketId,
          body: ticketComments.body,
          internal: ticketComments.internal,
          createdAt: ticketComments.createdAt,
          author: users.name,
        })
        .from(ticketComments)
        .leftJoin(users, eq(users.id, ticketComments.userId))
        .where(inArray(ticketComments.ticketId, ids))
        .orderBy(asc(ticketComments.createdAt))
    : [];

  const staff = await peopleOptions(condoId, ["sindico", "zelador", "porteiro", "conselho"]);
  const unitList = await unitOptions(condoId);
  const staffById = new Map(staff.map((person) => [person.id, person.name]));
  const commentsByTicket = new Map<number, typeof comments>();
  for (const comment of comments) {
    const list = commentsByTicket.get(comment.ticketId) ?? [];
    list.push(comment);
    commentsByTicket.set(comment.ticketId, list);
  }

  const now = new Date();
  const ticketsWithMeta = rows.map((ticket) => {
    const visibleComments = (commentsByTicket.get(ticket.id) ?? []).filter((comment) => isStaff || !comment.internal);
    const last = visibleComments.at(-1);
    return {
      ...ticket,
      visibleComments,
      lastInteractionAt: last?.createdAt ?? ticket.createdAt,
      lastInteraction: last?.body ?? ticket.description,
      assignedTo: ticket.assignedToId ? (staffById.get(ticket.assignedToId) ?? "Responsável definido") : null,
      late: Boolean(ticket.dueAt && new Date(ticket.dueAt) < now && ticket.status !== "concluido"),
      dueSummary: dueSummary(ticket.dueAt, ticket.status, now),
    };
  });

  const open = ticketsWithMeta.filter((ticket) => ticket.status !== "concluido").length;
  const late = ticketsWithMeta.filter((ticket) => ticket.late).length;
  const rated = ticketsWithMeta.filter((ticket) => ticket.rating);
  const satisfaction = rated.length ? (rated.reduce((acc, ticket) => acc + (ticket.rating ?? 0), 0) / rated.length).toFixed(1) : "—";

  const hrefFor = (next: { s?: string; q?: string; p?: string; c?: string; view?: string }) => {
    const params = new URLSearchParams();
    const nextStatus = next.s ?? activeStatus;
    const nextSearch = next.q ?? search;
    const nextPriority = next.p ?? p;
    const nextCategory = next.c ?? c;
    const nextView = next.view ?? activeView;
    if (nextStatus !== "todos") params.set("s", nextStatus);
    if (nextSearch) params.set("q", nextSearch);
    if (nextPriority) params.set("p", nextPriority);
    if (nextCategory) params.set("c", nextCategory);
    if (nextView !== "cards") params.set("view", nextView);
    const suffix = params.toString();
    return `/painel/chamados${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Chamados"
        subtitle="Acompanhe solicitações, prazos, responsáveis e interações com moradores em uma fila clara de atendimento."
        actions={
          <details className="relative no-print">
            <summary className="btn-primary list-none">
              <Icon name="plus" size={16} />
              Abrir chamado
            </summary>
            <div className="drawer-scrim" />
            <aside className="drawer-panel">
              <div className="mb-7 flex items-start justify-between gap-4 border-b border-[var(--color-line)] pb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Novo atendimento</p>
                  <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-[var(--color-ink)]">Abrir chamado</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    Descreva a solicitação com clareza. A IA sugere categoria e prioridade, mas a decisão final continua com a equipe.
                  </p>
                </div>
                <a href="/painel/chamados" className="btn-ghost btn-sm">
                  <Icon name="x" size={15} />
                  Fechar
                </a>
              </div>

              <form action={createTicketAction} className="space-y-4">
                <label className="block">
                  <span className="label">Título</span>
                  <input name="title" className="input" required placeholder="Ex.: Vazamento no hall do Bloco A" />
                </label>
                <label className="block">
                  <span className="label">Descrição</span>
                  <textarea name="description" rows={6} className="input" required placeholder="Informe local, impacto e qualquer detalhe importante." />
                </label>
                {session.role !== "morador" ? (
                  <label className="block">
                    <span className="label">Unidade</span>
                    <select name="unitId" className="input">
                      <option value="">Área comum</option>
                      {unitList.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">Categoria</span>
                    <select name="category" className="input">
                      <option value="">Sugerida pela IA</option>
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {statusLabel(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Prioridade</span>
                    <select name="priority" className="input">
                      <option value="">Sugerida pela IA</option>
                      {PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {statusLabel(priority)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <InfoNote icon="sparkles">
                  A sugestão da IA aparece no chamado depois da abertura e pode ser revisada pela equipe administrativa.
                </InfoNote>
                <div className="sticky bottom-0 -mx-6 border-t border-[var(--color-line)] bg-white px-6 py-5 sm:-mx-8 sm:px-8">
                  <button className="btn-primary w-full" type="submit">
                    <Icon name="send" size={16} />
                    Abrir chamado
                  </button>
                </div>
              </form>
            </aside>
          </details>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Em aberto" value={open} icon="wrench" hint="em atendimento" />
        <StatCard label="Fora do prazo" value={late} icon="alert" hint={late ? "ação necessária" : "nenhum atraso"} />
        <StatCard label="Total no período" value={ticketsWithMeta.length} icon="inbox" />
        <StatCard label="Satisfação média" value={satisfaction} icon="check" hint={`${rated.length} avaliações`} />
      </section>

      <section className="section-shell mt-6 no-print">
        <div className="mb-4 rounded-[10px] border border-[#dce9b3] bg-[var(--color-primary-soft)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-[var(--color-ink)]">
              <Icon name="filter" size={17} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">Fila de atendimento</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                Priorize atrasos, acompanhe responsáveis e filtre solicitações por status, categoria ou protocolo.
              </p>
            </div>
          </div>
        </div>
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center" action="/painel/chamados">
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-[8px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-4 text-sm text-[var(--color-muted)]">
            <Icon name="search" size={16} />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Buscar por protocolo, título ou descrição"
              className="w-full bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-subtle)]"
            />
          </label>
          <input type="hidden" name="view" value={activeView} />
          <button className="btn-primary" type="submit">
            <Icon name="search" size={16} />
            Buscar
          </button>
          <details className="relative">
            <summary className="btn-ghost list-none">
              <Icon name="filter" size={16} />
              Mais filtros
            </summary>
            <div className="menu-surface absolute right-0 z-50 mt-2 w-72 p-4">
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Status</span>
                  <select name="s" className="input" defaultValue={activeStatus === "todos" ? "" : activeStatus}>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key === "todos" ? "" : option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Prioridade</span>
                  <select name="p" className="input" defaultValue={p}>
                    <option value="">Todas</option>
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {statusLabel(priority)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Categoria</span>
                  <select name="c" className="input" defaultValue={c}>
                    <option value="">Todas</option>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {statusLabel(category)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-primary btn-sm w-full" type="submit">
                  Aplicar filtros
                </button>
              </div>
            </div>
          </details>
        </form>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="tabbar">
            {STATUS_OPTIONS.map((option) => (
              <a
                key={option.key}
                href={hrefFor({ s: option.key })}
                className={`tab flex-1 sm:flex-none ${activeStatus === option.key ? "tab-active" : ""}`}
              >
                {option.label}
              </a>
            ))}
          </div>
          <div className="tabbar justify-self-start xl:justify-self-end">
            <a href={hrefFor({ view: "cards" })} className={`tab ${activeView === "cards" ? "tab-active" : ""}`}>
              Cards
            </a>
            <a href={hrefFor({ view: "table" })} className={`tab ${activeView === "table" ? "tab-active" : ""}`}>
              Tabela
            </a>
          </div>
        </div>
      </section>

      <div className="mt-6">
        {ticketsWithMeta.length === 0 ? (
          <EmptyState
            title="Nenhum chamado encontrado"
            description={search || activeStatus !== "todos" || p || c ? "Ajuste a busca ou remova filtros para ampliar os resultados." : "Quando um chamado for aberto, ele aparecerá nesta fila."}
            icon="wrench"
          />
        ) : (
          <>
            {activeView === "table" ? (
              <div className="hidden lg:block">
                <Card>
                  <TableWrap>
                    <thead>
                      <tr>
                        <th>Chamado</th>
                        <th>Status</th>
                        <th>Unidade</th>
                        <th>Responsável</th>
                        <th>Prazo</th>
                        <th>Atualização</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketsWithMeta.map((ticket) => (
                        <tr key={ticket.id}>
                          <td>
                            <span className="block font-mono text-xs font-semibold text-[var(--color-muted)]">{ticket.code}</span>
                            <span className="block max-w-md truncate font-semibold text-[var(--color-ink)]">{ticket.title}</span>
                            <span className="block text-xs text-[var(--color-muted)]">{labelFor(ticket.category, CATEGORY_LABELS)}</span>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge tone={ticket.late ? "red" : statusTone(ticket.status)}>{ticket.late ? "Atrasado" : labelFor(ticket.status, STATUS_LABELS)}</Badge>
                              <Badge tone={ticket.priority === "alta" ? "red" : ticket.priority === "media" ? "amber" : "neutral"}>{labelFor(ticket.priority, PRIORITY_LABELS)}</Badge>
                            </div>
                          </td>
                          <td>{ticket.block || ticket.unit ? `${ticket.block ?? ""} ${ticket.unit ?? ""}` : "Área comum"}</td>
                          <td>{ticket.assignedTo ?? "Sem responsável"}</td>
                          <td>{ticket.dueSummary}</td>
                          <td>{dateTimeBR(ticket.lastInteractionAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </Card>
              </div>
            ) : null}

            <div className={activeView === "table" ? "space-y-4 lg:hidden" : "space-y-4"}>
              {ticketsWithMeta.map((ticket) => (
                <details
                  key={ticket.id}
                  className={`group relative overflow-hidden rounded-[12px] border bg-white shadow-[0_1px_2px_rgba(16,17,20,0.04)] transition-[border-color,box-shadow] hover:border-[#dce9b3] hover:shadow-[0_10px_28px_rgba(16,17,20,0.05)] open:border-[var(--color-primary-hover)] ${
                    ticket.late ? "border-[#efc9c9]" : "border-[var(--color-line)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-1 ${
                      ticket.late ? "bg-[var(--color-danger)]" : ticket.status === "concluido" ? "bg-[var(--color-success)]" : "bg-[var(--color-primary)]"
                    }`}
                  />
                  <summary className="cursor-pointer list-none p-5 pl-6 transition-colors hover:bg-[var(--color-canvas)] sm:p-6 sm:pl-7">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-stretch">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-[6px] border border-[#dce9b3] bg-[var(--color-primary-soft)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--color-primary-dark)]">{ticket.code}</span>
                            <Badge tone={ticket.late ? "red" : statusTone(ticket.status)}>{ticket.late ? "Atrasado" : labelFor(ticket.status, STATUS_LABELS)}</Badge>
                            <Badge tone={ticket.priority === "alta" ? "red" : ticket.priority === "media" ? "amber" : "neutral"}>{labelFor(ticket.priority, PRIORITY_LABELS)}</Badge>
                            <Badge tone="primary">{labelFor(ticket.category, CATEGORY_LABELS)}</Badge>
                          </div>
                          <span className="hidden items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-muted)] sm:inline-flex">
                            <Icon name="clock" size={13} />
                            Atualizado {dateTimeBR(ticket.lastInteractionAt)}
                          </span>
                        </div>

                        <div className="mt-5 flex gap-4">
                          <span
                            className={`mt-1 hidden h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border sm:flex ${
                              ticket.late
                                ? "border-[#efc9c9] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                                : ticket.status === "concluido"
                                  ? "border-[#cdebd9] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                                  : "border-[#dce9b3] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
                            }`}
                          >
                            <Icon name={ticket.late ? "alert" : ticket.status === "concluido" ? "check" : "wrench"} size={18} />
                          </span>
                          <div className="min-w-0">
                            <h2 className="text-[21px] font-semibold leading-tight tracking-tight text-[var(--color-ink)]">{ticket.title}</h2>
                            <p className="mt-2 line-clamp-2 max-w-4xl text-[15px] leading-6 text-[var(--color-muted)]">{ticket.lastInteraction}</p>
                          </div>
                        </div>

                        <dl className="mt-5 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3.5 py-3">
                            <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              <Icon name="building" size={13} />
                              Local
                            </dt>
                            <dd className="mt-1.5 truncate text-sm font-semibold text-[var(--color-ink)]">{ticket.block || ticket.unit ? `${ticket.block ?? ""} ${ticket.unit ?? ""}` : "Área comum"}</dd>
                          </div>
                          <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3.5 py-3">
                            <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              <Icon name="users" size={13} />
                              Morador
                            </dt>
                            <dd className="mt-1.5 truncate text-sm font-semibold text-[var(--color-ink)]">{ticket.openedBy ?? "—"}</dd>
                          </div>
                          <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3.5 py-3">
                            <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              <Icon name="user-check" size={13} />
                              Responsável
                            </dt>
                            <dd className="mt-1.5 truncate text-sm font-semibold text-[var(--color-ink)]">{ticket.assignedTo ?? "Sem responsável"}</dd>
                          </div>
                        </dl>
                      </div>

                      <aside className="flex flex-col justify-between rounded-[12px] border border-[#dce9b3] bg-[var(--color-primary-soft)] p-4">
                        <div>
                          <div className="flex items-start gap-3">
                            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white text-[var(--color-primary-dark)]">
                              <Icon name={ticket.late ? "alert" : ticket.status === "concluido" ? "check" : "clock"} size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary-dark)]">Próxima ação</p>
                              <p className={`mt-1 text-lg font-semibold leading-tight ${ticket.late ? "text-[var(--color-danger)]" : "text-[var(--color-ink)]"}`}>{ticket.dueSummary}</p>
                              <p className="mt-1 text-xs font-medium text-[var(--color-muted)]">Prazo {dateBR(ticket.dueAt)}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-[8px] bg-white px-3 py-2">
                              <p className="font-semibold uppercase tracking-wide text-[var(--color-muted)]">Aberto</p>
                              <p className="mt-1 font-semibold text-[var(--color-ink)]">{dateBR(ticket.createdAt)}</p>
                            </div>
                            <div className="rounded-[8px] bg-white px-3 py-2">
                              <p className="font-semibold uppercase tracking-wide text-[var(--color-muted)]">Interações</p>
                              <p className="mt-1 font-semibold text-[var(--color-ink)]">{ticket.visibleComments.length}</p>
                            </div>
                          </div>
                        </div>
                        <span className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[var(--color-primary-dark)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-primary-dark)] transition-colors group-open:bg-[var(--color-primary)] group-open:text-[var(--color-ink)]">
                          <Icon name="chevron-down" size={15} className="transition-transform group-open:rotate-180" />
                          Detalhes do chamado
                        </span>
                      </aside>
                    </div>
                  </summary>

                  <div className="border-t border-[var(--color-line)] p-5 sm:p-6">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                      <div>
                        <p className="text-sm leading-6 text-[var(--color-ink)]">{ticket.description}</p>
                        {ticket.aiSummary && isStaff ? (
                          <div className="mt-4">
                            <InfoNote icon="sparkles">{ticket.aiSummary}</InfoNote>
                          </div>
                        ) : null}

                        <div className="mt-5">
                          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Interações</h3>
                          {ticket.visibleComments.length === 0 ? (
                            <p className="mt-2 text-sm text-[var(--color-muted)]">Sem respostas até o momento.</p>
                          ) : (
                            <ul className="mt-3 space-y-3">
                              {ticket.visibleComments.slice(-4).map((comment) => (
                                <li key={comment.id} className="rounded-[8px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-4 text-sm">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-[var(--color-ink)]">{comment.author ?? "Usuário"}</span>
                                    <span className="text-xs text-[var(--color-muted)]">{dateTimeBR(comment.createdAt)}</span>
                                    {comment.internal ? <Badge tone="primary">interno</Badge> : null}
                                  </div>
                                  <p className="mt-1 text-[var(--color-muted)]">{comment.body}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Card title="Responder">
                          <form action={commentTicketAction} className="space-y-3">
                            <input type="hidden" name="ticketId" value={ticket.id} />
                            <textarea name="body" rows={3} className="input" required placeholder="Escreva uma atualização objetiva..." />
                            {isStaff ? (
                              <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                                <input type="checkbox" name="internal" className="h-4 w-4 accent-[var(--color-primary)]" />
                                Nota interna
                              </label>
                            ) : null}
                            <button className="btn-primary btn-sm" type="submit">
                              <Icon name="send" size={15} />
                              Enviar resposta
                            </button>
                          </form>
                        </Card>

                        {isStaff ? (
                          <Card title="Atualizar atendimento">
                            <form action={updateTicketAction} className="space-y-3">
                              <input type="hidden" name="id" value={ticket.id} />
                              <label className="block">
                                <span className="label">Status</span>
                                <select name="status" className="input" defaultValue={ticket.status}>
                                  {STATUS.map((status) => (
                                    <option key={status} value={status}>
                                      {statusLabel(status)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="label">Prioridade</span>
                                <select name="priority" className="input" defaultValue={ticket.priority}>
                                  {PRIORITIES.map((priority) => (
                                    <option key={priority} value={priority}>
                                      {statusLabel(priority)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="label">Responsável</span>
                                <select name="assignedToId" className="input" defaultValue={ticket.assignedToId ?? ""}>
                                  <option value="">Sem responsável</option>
                                  {staff.map((person) => (
                                    <option key={person.id} value={person.id}>
                                      {person.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button className="btn-dark btn-sm" type="submit">
                                <Icon name="check" size={15} />
                                Salvar alterações
                              </button>
                            </form>
                          </Card>
                        ) : null}

                        {ticket.status === "concluido" && !ticket.rating ? (
                          <Card title="Avaliar atendimento">
                            <form action={rateTicketAction} className="space-y-3">
                              <input type="hidden" name="id" value={ticket.id} />
                              <label className="block">
                                <span className="label">Nota</span>
                                <select name="rating" className="input" defaultValue="5">
                                  {[5, 4, 3, 2, 1].map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <textarea name="ratingComment" rows={2} className="input" placeholder="Comentário opcional" />
                              <button className="btn-success btn-sm" type="submit">
                                Enviar avaliação
                              </button>
                            </form>
                          </Card>
                        ) : ticket.rating ? (
                          <Badge tone="green">Avaliado {ticket.rating}/5</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
