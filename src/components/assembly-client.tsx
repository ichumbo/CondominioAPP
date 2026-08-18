"use client";

import { useState } from "react";
import { Badge, Card, Drawer, InfoNote, Panel, StatCard } from "@/components/ui";
import { Icon } from "@/components/icon";
import { dateBR, dateTimeBR } from "@/lib/utils";
import {
  saveAssemblyAction,
  notifyAssemblyAction,
  confirmAttendanceAction,
  adminRecordAttendanceAction,
  voteAssemblyAction,
  generateAISummaryAction,
  approveAndPublishMinutesAction,
  updateMinutesVersionAction,
  cancelAssemblyAction,
} from "@/lib/actions/assemblies";

export type AssemblyView = "list" | "calendar";
export type AssemblyTab = "proximas" | "realizadas" | "canceladas";

type AssemblyRow = {
  id: number;
  condoId: number;
  title: string;
  kind: string;
  mode: string;
  noticeAt: Date | null;
  firstCallAt: Date;
  secondCallAt: Date | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  onlineLink: string | null;
  quorumFirst: number;
  quorumSecond: number;
  status: string;
  minutes: string | null;
  recordingUrl: string | null;
  description: string | null;
  guidelines: string | null;
  audienceScope: string;
  targetBlockId: number | null;
  targetUnitId: number | null;
  responsibleName: string | null;
  confirmationDeadline: Date | null;
  remindersConfig: string[] | null;
  attachments: { name: string; url: string; sizeKb?: number }[] | null;
  noticeDocumentUrl: string | null;
  createdAt: Date;
};

type AgendaItem = {
  id: number;
  assemblyId: number;
  position: number;
  title: string;
  description: string | null;
  votingType: string;
  status: string;
  result: string | null;
  presenter: string | null;
  discussionResult: string | null;
  decision: string | null;
  notes: string | null;
  requiresVoting: boolean;
  votingResult: string | null;
};

type AttendanceItem = {
  id: number;
  assemblyId: number;
  unitId: number | null;
  userId: number | null;
  status: string;
  proxyForUnitId: number | null;
  proxyDoc: string | null;
  proxyName: string | null;
  proxyCpf: string | null;
  checkinAt: Date | null;
};

type MinutesItem = {
  id: number;
  assemblyId: number;
  status: string;
  currentVersion: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSizeKb: number | null;
  fileFormat: string | null;
  content: string | null;
  summary: string | null;
  aiSuggestedSummary: string | null;
  summaryStatus: string;
  publishedAt: Date | null;
};

type MinuteVersionItem = {
  id: number;
  minutesId: number;
  version: string;
  fileUrl: string | null;
  fileName: string | null;
  summary: string | null;
  changeReason: string | null;
  createdAt: Date;
};

type UnitOption = { id: number; label: string };

export function AssembliesClientView({
  session,
  assemblies,
  agendaItems,
  attendances,
  votes,
  minutesList,
  minuteVersions,
  unitOptions,
  blocks,
}: {
  session: { role: string; user: { id: number; name: string }; unitId: number | null };
  assemblies: AssemblyRow[];
  agendaItems: AgendaItem[];
  attendances: AttendanceItem[];
  votes: any[];
  minutesList: MinutesItem[];
  minuteVersions: MinuteVersionItem[];
  unitOptions: UnitOption[];
  blocks: { id: number; name: string }[];
}) {
  const isStaff = ["superadmin", "sindico", "conselho", "zelador"].includes(session.role);
  const canManage = ["superadmin", "sindico"].includes(session.role);

  const [tab, setTab] = useState<AssemblyTab>("proximas");
  const [view, setView] = useState<AssemblyView>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("todos");
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [editingAssembly, setEditingAssembly] = useState<AssemblyRow | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const upcomingList = assemblies.filter((a) => ["rascunho", "agendada", "convocacao_enviada", "em_andamento"].includes(a.status));
  const finishedList = assemblies.filter((a) => ["finalizada", "ata_em_revisao", "ata_publicada"].includes(a.status));
  const cancelledList = assemblies.filter((a) => a.status === "cancelada");

  const filtered = assemblies.filter((a) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchLoc = (a.location || "").toLowerCase().includes(q);
      if (!matchTitle && !matchLoc) return false;
    }
    if (kindFilter !== "todos" && a.kind !== kindFilter) return false;

    if (tab === "proximas") return ["rascunho", "agendada", "convocacao_enviada", "em_andamento"].includes(a.status);
    if (tab === "realizadas") return ["finalizada", "ata_em_revisao", "ata_publicada"].includes(a.status);
    if (tab === "canceladas") return a.status === "cancelada";
    return true;
  });

  const nextAssembly = upcomingList[0];
  const publishedMinutesCount = minutesList.filter((m) => m.status === "publicada").length;
  const confirmedAttendanceCount = attendances.filter((att) => att.status === "confirmado").length;

  return (
    <div className="space-y-6">
      {/* Metrics Row — Exact Home Page StatCard Identity */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Próximas" value={upcomingList.length} icon="scale" hint="assembleias ativas" href="/painel/assembleias" />
        <StatCard label="Presenças" value={confirmedAttendanceCount} icon="user-check" hint="unidades confirmadas" href="/painel/assembleias" />
        <StatCard label="Atas publicadas" value={publishedMinutesCount} icon="file-text" hint="documentos ativas" href="/painel/assembleias" />
        <StatCard label="Convocações" value={assemblies.length} icon="bell" hint="histórico registrado" href="/painel/assembleias" />
      </section>

      {/* Resident Feature Highlight */}
      {session.role === "morador" && nextAssembly ? (
        <Card title="Sua próxima assembleia convocada">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--color-primary-dark)] animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Convocação digital</p>
            </div>
            <Badge tone="purple">{nextAssembly.kind}</Badge>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h3 className="text-lg font-bold text-[var(--color-ink)]">{nextAssembly.title}</h3>
              {nextAssembly.description ? <p className="mt-1 text-xs text-[var(--color-muted)]">{nextAssembly.description}</p> : null}
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3">
                  <p className="label text-[10px]">Data & Horário</p>
                  <p className="font-bold text-[var(--color-ink)]">{dateTimeBR(nextAssembly.firstCallAt)}</p>
                  {nextAssembly.startTime ? <p className="text-[11px] text-[var(--color-subtle)]">{nextAssembly.startTime} às {nextAssembly.endTime || "término"}</p> : null}
                </div>
                <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3">
                  <p className="label text-[10px]">Local / Formato</p>
                  <p className="font-bold text-[var(--color-ink)]">{nextAssembly.mode}</p>
                  <p className="truncate text-[11px] text-[var(--color-subtle)]">{nextAssembly.location || "Online"}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3">
                  <p className="label text-[10px]">Responsável</p>
                  <p className="font-bold text-[var(--color-ink)]">{nextAssembly.responsibleName || "Síndico(a)"}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-[12px] border border-[var(--color-line)] bg-white p-4">
              <div>
                <p className="text-xs font-bold text-[var(--color-ink)]">Confirme sua Participação</p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">Registre se irá comparecer ou se representará por procuração.</p>
              </div>
              <div className="mt-3 space-y-2">
                <form action={confirmAttendanceAction}>
                  <input type="hidden" name="assemblyId" value={nextAssembly.id} />
                  <input type="hidden" name="status" value="confirmado" />
                  <button className="btn-primary btn-sm w-full">
                    <Icon name="check-circle" size={14} /> Confirmar presença
                  </button>
                </form>
                <form action={confirmAttendanceAction}>
                  <input type="hidden" name="assemblyId" value={nextAssembly.id} />
                  <input type="hidden" name="status" value="ausente" />
                  <button className="btn-ghost btn-sm w-full text-xs">
                    <Icon name="x-circle" size={14} /> Informar ausência
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Navigation Toolbar — Matching System Tab Pills and Buttons */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-[var(--color-line)] pb-4">
        {/* Tab Pills */}
        <div className="tabbar">
          <button
            onClick={() => setTab("proximas")}
            className={`tab ${tab === "proximas" ? "tab-active" : ""}`}
          >
            <Icon name="clock" size={14} />
            Próximas ({upcomingList.length})
          </button>

          <button
            onClick={() => setTab("realizadas")}
            className={`tab ${tab === "realizadas" ? "tab-active" : ""}`}
          >
            <Icon name="check-circle" size={14} />
            Realizadas ({finishedList.length})
          </button>

          <button
            onClick={() => setTab("canceladas")}
            className={`tab ${tab === "canceladas" ? "tab-active" : ""}`}
          >
            <Icon name="x-circle" size={14} />
            Canceladas ({cancelledList.length})
          </button>
        </div>

        {/* View Toggle & New Assembly Primary Action */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="tabbar">
            <button
              onClick={() => setView("list")}
              className={`tab ${view === "list" ? "tab-active" : ""}`}
            >
              <Icon name="grid" size={14} />
              Lista
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`tab ${view === "calendar" ? "tab-active" : ""}`}
            >
              <Icon name="calendar" size={14} />
              Calendário
            </button>
          </div>

          {canManage ? (
            <button
              onClick={() => {
                setEditingAssembly(null);
                setNewModalOpen(true);
              }}
              className="btn-primary"
            >
              <Icon name="plus" size={16} />
              Nova assembleia
            </button>
          ) : null}
        </div>
      </div>

      {/* Search & Type Filter Bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2 relative">
          <input
            type="text"
            placeholder="Buscar por título da assembleia, local ou pauta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
          <span className="pointer-events-none absolute left-3 top-3.5 text-[var(--color-subtle)]">
            <Icon name="search" size={16} />
          </span>
        </div>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="input"
        >
          <option value="todos">Todos os tipos de assembleia</option>
          <option value="ordinaria">Ordinária</option>
          <option value="extraordinaria">Extraordinária</option>
          <option value="outra">Outra</option>
        </select>
      </div>

      {/* CALENDAR VIEW */}
      {view === "calendar" ? (
        <Card title="Calendário de Assembleias">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => (
              <div key={a.id} className="rounded-[12px] border border-[var(--color-line)] bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <Badge tone={a.status === "cancelada" ? "red" : a.status === "ata_publicada" ? "green" : "purple"}>
                    {a.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs font-bold text-[var(--color-primary-dark)]">{dateBR(a.firstCallAt.toISOString().split("T")[0])}</span>
                </div>
                <h4 className="font-bold text-[var(--color-ink)]">{a.title}</h4>
                <p className="text-xs text-[var(--color-muted)]">{a.kind} · {a.mode} · {a.location || "Online"}</p>
                <button
                  onClick={() => setView("list")}
                  className="btn-ghost btn-sm w-full text-xs mt-2"
                >
                  Ver detalhes da assembleia
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        /* LIST VIEW */
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card>
              <div className="py-12 text-center space-y-3">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
                  <Icon name="scale" size={20} />
                </span>
                <h3 className="font-semibold text-[var(--color-ink)]">Nenhuma assembleia encontrada</h3>
                <p className="text-xs text-[var(--color-muted)]">Ajuste os filtros ou a busca para localizar assembleias cadastradas.</p>
              </div>
            </Card>
          ) : (
            filtered.map((a) => {
              const items = agendaItems.filter((i) => i.assemblyId === a.id);
              const present = attendances.filter((i) => i.assemblyId === a.id);
              const proxies = present.filter((p) => p.proxyForUnitId || p.proxyName).length;
              const minutes = minutesList.find((m) => m.assemblyId === a.id);
              const myAttendance = present.find((p) => p.userId === session.user.id || (session.unitId && p.unitId === session.unitId));

              return (
                <Card key={a.id} className="relative overflow-visible">
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
                          <Icon name="scale" size={15} />
                        </span>
                        <h3 className="text-base font-semibold text-[var(--color-ink)]">{a.title}</h3>
                        <Badge tone={a.status === "cancelada" ? "red" : a.status === "ata_publicada" ? "green" : "purple"}>
                          {a.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Tipo: <strong className="capitalize text-[var(--color-ink)]">{a.kind}</strong> · Formato: <strong className="text-[var(--color-ink)]">{a.mode}</strong> · 1ª Convocação: <strong className="text-[var(--color-ink)]">{dateTimeBR(a.firstCallAt)}</strong>
                        {a.secondCallAt ? ` · 2ª Convocação: ${dateTimeBR(a.secondCallAt)}` : ""}
                      </p>
                    </div>

                    {/* Vector 3-Dots Admin Menu */}
                    {canManage ? (
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === a.id ? null : a.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                          title="Ações da Assembleia"
                        >
                          <Icon name="dots" size={16} />
                        </button>
                        {activeMenuId === a.id ? (
                          <div className="menu-surface absolute right-0 top-10 z-30 w-56 p-1.5 text-xs shadow-xl">
                            <button
                              onClick={() => {
                                setEditingAssembly(a);
                                setNewModalOpen(true);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                            >
                              <Icon name="wrench" size={14} /> Editar convocação
                            </button>
                            <form action={notifyAssemblyAction} onSubmit={() => setActiveMenuId(null)}>
                              <input type="hidden" name="assemblyId" value={a.id} />
                              <input type="hidden" name="triggerEvent" value="nova_assembleia" />
                              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]">
                                <Icon name="megaphone" size={14} /> Enviar convocação
                              </button>
                            </form>
                            <form action={cancelAssemblyAction} onSubmit={() => setActiveMenuId(null)}>
                              <input type="hidden" name="assemblyId" value={a.id} />
                              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]">
                                <Icon name="lock" size={14} /> Cancelar assembleia
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {/* Information Grid */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 label text-[10px] mb-1">
                        <Icon name="pin" size={13} className="text-[var(--color-primary-dark)]" />
                        Local / Acesso Online
                      </div>
                      <p className="font-semibold text-[var(--color-ink)]">{a.location || "Não especificado"}</p>
                      {a.onlineLink ? (
                        <a href={a.onlineLink} target="_blank" rel="noreferrer" className="link flex items-center gap-1 truncate">
                          <Icon name="external-link" size={12} />
                          {a.onlineLink}
                        </a>
                      ) : null}
                    </div>

                    <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 label text-[10px] mb-1">
                        <Icon name="users" size={13} className="text-[var(--color-primary-dark)]" />
                        Quórum & Confirmações
                      </div>
                      <p className="font-bold text-[var(--color-ink)]">
                        {present.length} confirmados {proxies > 0 ? `(${proxies} procurações)` : ""}
                      </p>
                      <p className="text-[11px] text-[var(--color-subtle)]">
                        Quórum 1ª: {a.quorumFirst}% · 2ª: {a.quorumSecond}%
                      </p>
                    </div>

                    <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 label text-[10px] mb-1">
                        <Icon name="user-check" size={13} className="text-[var(--color-primary-dark)]" />
                        Responsável
                      </div>
                      <p className="font-semibold text-[var(--color-ink)]">{a.responsibleName || "Administração"}</p>
                      {a.guidelines ? <p className="line-clamp-1 text-[11px] text-[var(--color-subtle)]">{a.guidelines}</p> : null}
                    </div>
                  </div>

                  {/* Agenda Items */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="label text-[11px] flex items-center gap-1.5">
                        <Icon name="vote" size={14} className="text-[var(--color-primary-dark)]" />
                        Pauta da Assembleia ({items.length} itens)
                      </h4>
                    </div>
                    <ol className="space-y-3">
                      {items.map((item) => {
                        const itemVotes = votes.filter((v) => v.agendaId === item.id);
                        const mine = itemVotes.find((v) => v.userId === session.user.id);
                        const simCount = itemVotes.filter((v) => v.choice === "sim").length;
                        const naoCount = itemVotes.filter((v) => v.choice === "nao").length;
                        const absCount = itemVotes.filter((v) => v.choice === "abstencao").length;

                        return (
                          <li key={item.id} className="rounded-[10px] border border-[var(--color-line)] p-3.5 bg-white space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-sm text-[var(--color-ink)]">
                                {item.position}. {item.title}
                              </p>
                              <Badge tone="purple">votação por {item.votingType}</Badge>
                            </div>
                            {item.description ? <p className="text-xs text-[var(--color-muted)]">{item.description}</p> : null}

                            {item.decision ? (
                              <div className="rounded-[8px] bg-[var(--color-surface-muted)] border border-[var(--color-line)] p-2.5 text-xs">
                                <strong className="text-[var(--color-ink)]">Decisão deliberada:</strong> {item.decision}
                              </div>
                            ) : null}

                            {item.requiresVoting ? (
                              <div className="grid grid-cols-3 gap-2.5 pt-1 text-center text-xs">
                                <div className="rounded-[8px] border border-[#cdebd9] bg-[var(--color-success-soft)] p-2">
                                  <span className="font-bold text-[var(--color-success)]">SIM: {simCount}</span>
                                </div>
                                <div className="rounded-[8px] border border-[#f2caca] bg-[var(--color-danger-soft)] p-2">
                                  <span className="font-bold text-[var(--color-danger)]">NÃO: {naoCount}</span>
                                </div>
                                <div className="rounded-[8px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-2">
                                  <span className="font-bold text-[var(--color-muted)]">ABSTENÇÃO: {absCount}</span>
                                </div>
                              </div>
                            ) : null}

                            {/* Vote Buttons */}
                            {a.status !== "cancelada" && a.status !== "ata_publicada" && !mine ? (
                              <div className="flex gap-2 pt-1">
                                {(["sim", "nao", "abstencao"] as const).map((choice) => (
                                  <form key={choice} action={voteAssemblyAction}>
                                    <input type="hidden" name="assemblyId" value={a.id} />
                                    <input type="hidden" name="agendaId" value={item.id} />
                                    <input type="hidden" name="choice" value={choice} />
                                    <button className="btn-ghost btn-sm capitalize">
                                      {choice === "sim" ? <Icon name="check" size={14} className="text-[var(--color-success)]" /> : choice === "nao" ? <Icon name="x" size={14} className="text-[var(--color-danger)]" /> : <Icon name="minus-circle" size={14} />}
                                      {choice}
                                    </button>
                                  </form>
                                ))}
                              </div>
                            ) : mine ? (
                              <p className="text-xs font-semibold text-[var(--color-primary-dark)] flex items-center gap-1">
                                <Icon name="check-circle" size={14} />
                                Seu voto registrado: <span className="uppercase font-bold">{mine.choice}</span>
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {/* Minutes Section */}
                  {minutes && (isStaff || minutes.status === "publicada") ? (
                    <div className="mt-6 rounded-[12px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-4 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="file-text" size={17} className="text-[var(--color-primary-dark)]" />
                          <h4 className="font-semibold text-sm text-[var(--color-ink)]">Ata Oficial & Resumo Executivo (v{minutes.currentVersion})</h4>
                        </div>
                        <Badge tone={minutes.status === "publicada" ? "green" : "zinc"}>
                          {minutes.status.replace("_", " ")}
                        </Badge>
                      </div>

                      {/* Summary Box */}
                      {minutes.summary ? (
                        <div className="rounded-[10px] border-l-4 border-l-[var(--color-primary-dark)] border border-[var(--color-line)] bg-white p-4 text-xs space-y-1.5">
                          <p className="label text-[10px] text-[var(--color-primary-dark)] flex items-center gap-1">
                            <Icon name="sparkles" size={13} />
                            Resumo Executivo da Ata
                          </p>
                          <p className="whitespace-pre-line text-[var(--color-ink)] leading-relaxed">{minutes.summary}</p>
                        </div>
                      ) : null}

                      {/* Content */}
                      {minutes.content ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-semibold text-[var(--color-primary-dark)] hover:underline flex items-center gap-1">
                            <Icon name="eye" size={14} />
                            Visualizar ata na íntegra
                          </summary>
                          <div className="mt-2 rounded-[10px] border border-[var(--color-line)] bg-white p-4 whitespace-pre-line text-[var(--color-ink)] leading-relaxed">
                            {minutes.content}
                          </div>
                        </details>
                      ) : null}

                      {/* Download */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="text-xs text-[var(--color-muted)]">
                          Documento: <strong className="text-[var(--color-ink)]">{minutes.fileName || "ata.pdf"}</strong> · Tamanho: {minutes.fileSizeKb || 320} KB
                          {minutes.publishedAt ? ` · Publicado em ${dateBR(minutes.publishedAt.toISOString().split("T")[0])}` : ""}
                        </div>
                        <a
                          href={`/api/assemblies/${a.id}/minutes/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary btn-sm gap-2"
                        >
                          <Icon name="download" size={14} />
                          Baixar ata oficial (PDF)
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {/* Staff Management Panel — Clean Summaries with Icons */}
                  {canManage ? (
                    <div className="mt-5 pt-3.5 border-t border-[var(--color-line)] flex flex-wrap gap-2">
                      <Panel summary="Gestão de ata e resumo IA" tone="ghost">
                        <div className="space-y-4 text-xs">
                          <form action={generateAISummaryAction} className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3.5 space-y-2">
                            <input type="hidden" name="assemblyId" value={a.id} />
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                                <Icon name="sparkles" size={14} /> Assistente IA para Resumo
                              </span>
                              <button className="btn-dark btn-sm">Gerar sugestão IA</button>
                            </div>
                            {minutes?.aiSuggestedSummary ? (
                              <div className="rounded-lg bg-white p-3 border border-[var(--color-line)]">
                                <p className="font-semibold text-[var(--color-ink)] mb-1">Sugestão gerada:</p>
                                <p className="whitespace-pre-line text-[var(--color-muted)]">{minutes.aiSuggestedSummary}</p>
                              </div>
                            ) : null}
                            <InfoNote tone="amber">
                              A sugestão gerada pela IA deve ser revisada por um administrador e não substitui a ata oficial.
                            </InfoNote>
                          </form>

                          <form action={approveAndPublishMinutesAction} className="space-y-3">
                            <input type="hidden" name="assemblyId" value={a.id} />
                            <label className="block">
                              <span className="label">Resumo Aprovado da Ata</span>
                              <textarea
                                name="summary"
                                rows={4}
                                className="input"
                                defaultValue={minutes?.summary || minutes?.aiSuggestedSummary || ""}
                                placeholder="Insira o resumo com assuntos principais, decisões e valores..."
                                required
                              />
                            </label>
                            <label className="block">
                              <span className="label">Conteúdo Completo da Ata</span>
                              <textarea
                                name="content"
                                rows={6}
                                className="input"
                                defaultValue={minutes?.content || a.minutes || ""}
                                placeholder="Texto integral da ata deliberada..."
                                required
                              />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block">
                                <span className="label">Nome do Arquivo</span>
                                <input name="fileName" className="input" defaultValue={minutes?.fileName || `ata-assembleia-${a.id}.pdf`} />
                              </label>
                              <label className="block">
                                <span className="label">Link/URL do Arquivo</span>
                                <input name="fileUrl" className="input" defaultValue={minutes?.fileUrl || ""} placeholder="https://..." />
                              </label>
                            </div>
                            <button className="btn-primary btn-sm w-full">
                              Aprovar resumo e publicar ata
                            </button>
                          </form>

                          {minutes?.status === "publicada" ? (
                            <form action={updateMinutesVersionAction} className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-warn-soft)] p-3.5 space-y-2">
                              <input type="hidden" name="assemblyId" value={a.id} />
                              <p className="font-bold text-[var(--color-warn)]">Publicar nova versão da ata (Atual v{minutes.currentVersion})</p>
                              <label className="block">
                                <span className="label">Motivo da Alteração *</span>
                                <input name="changeReason" className="input" placeholder="Ex: Correção de valor na pauta 3..." required />
                              </label>
                              <button className="btn-dark btn-sm w-full">Publicar nova versão e notificar moradores</button>
                            </form>
                          ) : null}
                        </div>
                      </Panel>

                      <Panel summary="Notificar moradores" tone="ghost">
                        <form action={notifyAssemblyAction} className="space-y-3 text-xs">
                          <input type="hidden" name="assemblyId" value={a.id} />
                          <label className="block">
                            <span className="label">Evento de Notificação</span>
                            <select name="triggerEvent" className="input">
                              <option value="nova_assembleia">Nova Assembleia (Convocação)</option>
                              <option value="alteracao_data_horario">Alteração de Data ou Horário</option>
                              <option value="alteracao_local">Alteração de Local/Link</option>
                              <option value="lembrete_7d">Lembrete (7 dias antes)</option>
                              <option value="lembrete_1d">Lembrete (1 dia antes)</option>
                              <option value="publicacao_ata">Publicação da Ata</option>
                              <option value="atualizacao_ata">Atualização da Ata</option>
                            </select>
                          </label>
                          <button className="btn-primary btn-sm w-full">Disparar notificações</button>
                        </form>
                      </Panel>

                      <Panel summary="Registro de presença manual" tone="ghost">
                        <form action={adminRecordAttendanceAction} className="space-y-3 text-xs">
                          <input type="hidden" name="assemblyId" value={a.id} />
                          <label className="block">
                            <span className="label">Selecione a Unidade</span>
                            <select name="unitId" className="input" required>
                              <option value="">— Selecionar Unidade —</option>
                              {unitOptions.map((u) => (
                                <option key={u.id} value={u.id}>{u.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="label">Status</span>
                            <select name="status" className="input">
                              <option value="confirmado">Confirmado / Presente</option>
                              <option value="ausente">Ausente</option>
                            </select>
                          </label>
                          <button className="btn-dark btn-sm w-full">Registrar presença manual</button>
                        </form>
                      </Panel>
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Drawer Form Modal */}
      <Drawer
        title={editingAssembly ? "Editar Convocação" : "Nova Convocação de Assembleia"}
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
      >
        <form action={saveAssemblyAction} onSubmit={() => setNewModalOpen(false)} className="space-y-4 text-xs">
          {editingAssembly ? <input type="hidden" name="id" value={editingAssembly.id} /> : null}

          <label className="block">
            <span className="label">Título da Assembleia *</span>
            <input name="title" defaultValue={editingAssembly?.title || ""} className="input" placeholder="Ex: Assembleia Geral Ordinária 2026" required />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Tipo de Assembleia</span>
              <select name="kind" defaultValue={editingAssembly?.kind || "ordinaria"} className="input">
                <option value="ordinaria">Ordinária</option>
                <option value="extraordinaria">Extraordinária</option>
                <option value="outra">Outra</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Formato</span>
              <select name="mode" defaultValue={editingAssembly?.mode || "hibrida"} className="input">
                <option value="hibrida">Híbrida</option>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Data e Hora 1ª Convocação *</span>
              <input type="datetime-local" name="firstCallAt" className="input" required />
            </label>
            <label className="block">
              <span className="label">2ª Convocação</span>
              <input type="datetime-local" name="secondCallAt" className="input" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Horário de Início</span>
              <input type="time" name="startTime" defaultValue={editingAssembly?.startTime || "19:00"} className="input" />
            </label>
            <label className="block">
              <span className="label">Previsão Encerramento</span>
              <input type="time" name="endTime" defaultValue={editingAssembly?.endTime || "21:30"} className="input" />
            </label>
          </div>

          <label className="block">
            <span className="label">Local Presencial</span>
            <input name="location" defaultValue={editingAssembly?.location || ""} className="input" placeholder="Salão de festas principal" />
          </label>

          <label className="block">
            <span className="label">Link Reunião Online (quando houver)</span>
            <input name="onlineLink" defaultValue={editingAssembly?.onlineLink || ""} className="input" placeholder="https://meet.google.com/..." />
          </label>

          <label className="block">
            <span className="label">Descrição Curta</span>
            <textarea name="description" rows={2} defaultValue={editingAssembly?.description || ""} className="input" placeholder="Apresentação das contas e eleição do novo síndico..." />
          </label>

          <label className="block">
            <span className="label">Orientações aos Moradores</span>
            <textarea name="guidelines" rows={2} defaultValue={editingAssembly?.guidelines || ""} className="input" placeholder="Apresentar documento com foto ou procuração com firma reconhecida." />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Escopo Convocado</span>
              <select name="audienceScope" defaultValue={editingAssembly?.audienceScope || "todos"} className="input">
                <option value="todos">Todos do Condomínio</option>
                <option value="bloco">Bloco Específico</option>
                <option value="unidade">Unidade Específica</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Bloco (se aplicável)</span>
              <select name="targetBlockId" defaultValue={editingAssembly?.targetBlockId || ""} className="input">
                <option value="">— Selecionar Bloco —</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="label">Itens de Pauta (um por linha)</span>
            <textarea name="agenda" rows={4} className="input" placeholder="1. Aprovação de contas 2025&#10;2. Previsão orçamentária 2026&#10;3. Obras da fachada" required />
          </label>

          <div className="flex items-center gap-3 pt-3">
            <button type="submit" name="isDraft" value="true" className="btn-ghost flex-1">
              Salvar como Rascunho
            </button>
            <button type="submit" name="isDraft" value="false" className="btn-primary flex-1">
              Salvar e Agendar
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
