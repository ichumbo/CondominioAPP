import Link from "next/link";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { blocks, units, users, visitors, visits } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { GATE } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, statusTone, TableWrap } from "@/components/ui";
import { dateTimeBR } from "@/lib/utils";
import { peopleOptions, unitOptions } from "@/lib/queries";
import { createVisitAction, decideVisitAction, gateMoveAction, saveVisitorAction, toggleBlockVisitorAction } from "@/lib/actions/portaria";
import { qrDataUrl } from "@/lib/qr";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

export default async function VisitantesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { session, condoId } = await requireCondo();
  const { status } = await searchParams;
  const isResident = session.role === "morador";
  const isGate = GATE.includes(session.role);

  const scope = isResident && session.unitId ? eq(visits.unitId, session.unitId) : undefined;
  const statusFilter = status && status !== "todos" ? eq(visits.status, status) : undefined;

  const rows = await db
    .select({
      id: visits.id,
      status: visits.status,
      purpose: visits.purpose,
      validFrom: visits.validFrom,
      validUntil: visits.validUntil,
      qrToken: visits.qrToken,
      checkinAt: visits.checkinAt,
      checkoutAt: visits.checkoutAt,
      deniedReason: visits.deniedReason,
      plate: visits.vehiclePlate,
      visitorId: visitors.id,
      name: visitors.name,
      document: visitors.document,
      kind: visitors.kind,
      company: visitors.company,
      blocked: visitors.blocked,
      unit: units.number,
      block: blocks.name,
      host: users.name,
    })
    .from(visits)
    .innerJoin(visitors, eq(visitors.id, visits.visitorId))
    .leftJoin(units, eq(units.id, visits.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .leftJoin(users, eq(users.id, visits.hostUserId))
    .where(and(eq(visits.condoId, condoId), scope, statusFilter))
    .orderBy(desc(visits.createdAt))
    .limit(60);

  const recurring = await db
    .select()
    .from(visitors)
    .where(and(eq(visitors.condoId, condoId), or(eq(visitors.recurring, true), eq(visitors.blocked, true))))
    .orderBy(desc(visitors.blocked), visitors.name);

  const pendingForMe = rows.filter(
    (r) => r.status === "aguardando" && (isResident ? true : ["sindico", "superadmin"].includes(session.role)),
  );

  const unitList = await unitOptions(condoId);
  const hosts = await peopleOptions(condoId, ["morador", "conselho", "sindico"]);

  const highlighted = rows.filter((r) => ["autorizado", "dentro", "aguardando"].includes(r.status)).slice(0, 4);
  const qrCodes = new Map<number, string>();
  for (const visit of highlighted) {
    qrCodes.set(visit.id, await qrDataUrl(visit.qrToken, 132));
  }

  const filters = [
    { key: "todos", label: "Todos" },
    { key: "aguardando", label: "Aguardando" },
    { key: "autorizado", label: "Autorizados" },
    { key: "dentro", label: "No condomínio" },
    { key: "finalizado", label: "Finalizados" },
    { key: "negado", label: "Negados" },
  ];

  return (
    <>
      <PageHeader
        title="Visitantes e prestadores"
        subtitle="Cadastro antecipado, convite com QR Code e validade, autorização do morador, registro de entrada/saída e lista de bloqueio."
        actions={isGate ? <Link href="/painel/portaria" className="btn-dark btn-sm"><Icon name="shield" size={15} />Abrir painel da portaria</Link> : null}
      />

      <div className="mb-4 flex flex-wrap gap-2 no-print">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/painel/visitantes?status=${f.key}`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              (status ?? "todos") === f.key
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
                : "bg-white text-[var(--color-muted)] ring-1 ring-[var(--color-line)] hover:bg-[var(--color-surface-muted)]   "
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {pendingForMe.length > 0 ? (
            <Card title="Autorizações pendentes" description="O morador ou a administração precisa liberar a entrada.">
              <ul className="space-y-2">
                {pendingForMe.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f0dfbc] bg-[var(--color-warn-soft)] px-3 py-2  ">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">{v.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {v.company ? `${v.company} · ` : ""}{v.purpose ?? "sem finalidade informada"} · válido até {dateTimeBR(v.validUntil)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={decideVisitAction}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="decision" value="autorizar" />
                        <button className="btn-success btn-sm">Autorizar</button>
                      </form>
                      <form action={decideVisitAction}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="decision" value="negar" />
                        <button className="btn-danger btn-sm">Negar</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Histórico de visitas" description="Filtrado por unidade quando o acesso é de morador.">
            {rows.length === 0 ? (
              <EmptyState title="Nenhuma visita registrada" icon="user-check" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Visitante</th>
                    <th>Unidade</th>
                    <th>Validade</th>
                    <th>Entrada / saída</th>
                    <th>Status</th>
                    <th className="no-print">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className="font-semibold text-[var(--color-ink)]">{v.name}</span>
                        <span className="block text-xs text-[var(--color-subtle)]">
                          {v.kind}{v.company ? ` · ${v.company}` : ""}{v.document ? ` · ${v.document}` : ""}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {v.block ?? "—"} {v.unit ?? ""}
                        <span className="block text-[var(--color-subtle)]">{v.host ?? "sem anfitrião"}</span>
                      </td>
                      <td className="whitespace-nowrap text-xs">{dateTimeBR(v.validUntil)}</td>
                      <td className="whitespace-nowrap text-xs">
                        {v.checkinAt ? dateTimeBR(v.checkinAt) : "—"}
                        <span className="block text-[var(--color-subtle)]">{v.checkoutAt ? dateTimeBR(v.checkoutAt) : v.deniedReason ?? ""}</span>
                      </td>
                      <td>
                        <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                      </td>
                      <td className="no-print">
                        <div className="flex flex-wrap gap-1.5">
                          {isGate && v.status === "autorizado" ? (
                            <form action={gateMoveAction}>
                              <input type="hidden" name="id" value={v.id} />
                              <input type="hidden" name="move" value="entrada" />
                              <button className="btn-success btn-sm">Entrada</button>
                            </form>
                          ) : null}
                          {isGate && v.status === "dentro" ? (
                            <form action={gateMoveAction}>
                              <input type="hidden" name="id" value={v.id} />
                              <input type="hidden" name="move" value="saida" />
                              <button className="btn-dark btn-sm">Saída</button>
                            </form>
                          ) : null}
                          <Link href={`/v/${v.qrToken}`} className="btn-ghost btn-sm" target="_blank">
                            QR
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          {highlighted.length > 0 ? (
            <Card title="Convites ativos com QR Code" description="Compartilhe o convite; a portaria valida o código na chegada.">
              <div className="grid gap-3 sm:grid-cols-2">
                {highlighted.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] p-3 ">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodes.get(v.id)} alt={`QR Code de ${v.name}`} className="h-24 w-24 rounded-md border border-[var(--color-line)] " />
                    <div className="min-w-0 text-xs">
                      <p className="truncate font-semibold text-[var(--color-ink)]">{v.name}</p>
                      <p className="text-[var(--color-muted)]">{v.block} {v.unit}</p>
                      <p className="text-[var(--color-subtle)]">até {dateTimeBR(v.validUntil)}</p>
                      <Link href={`/v/${v.qrToken}`} target="_blank" className="link">
                        abrir convite
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title="Novo convite de visita">
            <form action={createVisitAction} className="space-y-3">
              <label className="block">
                <span className="label">Visitante já cadastrado</span>
                <select name="visitorId" className="input">
                  <option value="">— novo cadastro —</option>
                  {recurring.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.company ? ` (${v.company})` : ""}{v.blocked ? " · BLOQUEADO" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Nome completo</span>
                <input name="name" className="input" placeholder="Se for novo visitante" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Documento</span>
                  <input name="document" className="input" />
                </label>
                <label className="block">
                  <span className="label">Tipo</span>
                  <select name="kind" className="input">
                    <option value="visitante">Visitante</option>
                    <option value="prestador">Prestador</option>
                    <option value="entrega">Entrega</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Empresa</span>
                  <input name="company" className="input" />
                </label>
                <label className="block">
                  <span className="label">Placa</span>
                  <input name="visitPlate" className="input uppercase" />
                </label>
              </div>
              {!isResident ? (
                <>
                  <label className="block">
                    <span className="label">Unidade</span>
                    <select name="unitId" className="input">
                      <option value="">Selecione</option>
                      {unitList.map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Anfitrião</span>
                    <select name="hostUserId" className="input">
                      <option value="">Selecione</option>
                      {hosts.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Válido de</span>
                  <input type="datetime-local" name="validFrom" className="input" />
                </label>
                <label className="block">
                  <span className="label">Válido até</span>
                  <input type="datetime-local" name="validUntil" className="input" />
                </label>
              </div>
              <label className="block">
                <span className="label">Finalidade</span>
                <input name="purpose" className="input" placeholder="Visita social, serviço, entrega..." />
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <input type="checkbox" name="recurring" className="h-4 w-4" />
                Prestador recorrente (fica na lista de autorizados)
              </label>
              <button className="btn-primary w-full">Gerar convite com QR Code</button>
            </form>
          </Card>

          <Card title="Autorizados e bloqueados" description="Prestadores recorrentes e restrições de segurança.">
            {recurring.length === 0 ? (
              <EmptyState title="Nenhum cadastro recorrente" icon="🔁" />
            ) : (
              <ul className="space-y-2 text-xs">
                {recurring.map((v) => (
                  <li
                    key={v.id}
                    className={`rounded-lg border px-3 py-2 ${
                      v.blocked
                        ? "border-[#efc9c9] bg-[var(--color-danger-soft)] text-[var(--color-danger)]   "
                        : "border-[var(--color-line)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{v.name}</span>
                      {isGate ? (
                        <form action={toggleBlockVisitorAction}>
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="reason" value="Bloqueio registrado pela administração" />
                          <button className={v.blocked ? "btn-success btn-sm" : "btn-danger btn-sm"}>
                            {v.blocked ? "Liberar" : "Bloquear"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <p className="mt-0.5 opacity-80">
                      {v.company ?? v.kind}{v.document ? ` · ${v.document}` : ""}
                    </p>
                    {v.blockReason ? <p className="mt-1 font-medium">{v.blockReason}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {isGate ? (
            <Panel summary="Cadastrar prestador recorrente">
              <form action={saveVisitorAction} className="space-y-3">
                <label className="block">
                  <span className="label">Nome</span>
                  <input name="name" className="input" required />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="label">Documento</span>
                    <input name="document" className="input" />
                  </label>
                  <label className="block">
                    <span className="label">Telefone</span>
                    <input name="phone" className="input" />
                  </label>
                </div>
                <label className="block">
                  <span className="label">Empresa</span>
                  <input name="company" className="input" />
                </label>
                <input type="hidden" name="kind" value="prestador" />
                <input type="hidden" name="recurring" value="on" />
                <label className="block">
                  <span className="label">Observações de segurança</span>
                  <textarea name="notes" rows={2} className="input" />
                </label>
                <button className="btn-primary w-full">Salvar cadastro</button>
              </form>
            </Panel>
          ) : null}

          <InfoNote>
            Foto e documento são coletados conforme a política do condomínio e a LGPD. O morador é avisado automaticamente
            quando a entrada é registrada.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
