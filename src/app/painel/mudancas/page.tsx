import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blocks, moveRequests, units, users } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Stat, statusTone } from "@/components/ui";
import { dateBR, isoDate } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { createMoveRequestAction, decideMoveRequestAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function MudancasPage() {
  const { session, condoId } = await requireCondo();
  const canDecide = ALL_STAFF.includes(session.role);
  const isResident = session.role === "morador";

  const rows = await db
    .select({
      id: moveRequests.id,
      kind: moveRequests.kind,
      scheduledDate: moveRequests.scheduledDate,
      startTime: moveRequests.startTime,
      endTime: moveRequests.endTime,
      elevator: moveRequests.elevator,
      carrierName: moveRequests.carrierName,
      carrierDoc: moveRequests.carrierDoc,
      vehiclePlate: moveRequests.vehiclePlate,
      workers: moveRequests.workers,
      description: moveRequests.description,
      artUrl: moveRequests.artUrl,
      status: moveRequests.status,
      reviewNotes: moveRequests.reviewNotes,
      deadlineAt: moveRequests.deadlineAt,
      termAccepted: moveRequests.termAccepted,
      requester: users.name,
      unit: units.number,
      block: blocks.name,
      requestedById: moveRequests.requestedById,
    })
    .from(moveRequests)
    .leftJoin(users, eq(users.id, moveRequests.requestedById))
    .leftJoin(units, eq(units.id, moveRequests.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(eq(moveRequests.condoId, condoId))
    .orderBy(desc(moveRequests.scheduledDate));

  const visible = isResident ? rows.filter((r) => r.requestedById === session.user.id) : rows;
  const unitList = await unitOptions(condoId);

  return (
    <>
      <PageHeader
        title="Mudanças, obras e entregas grandes"
        subtitle="Reserva de elevador, janelas de horário, transportadora, termo de responsabilidade, ART/RRT e trabalhadores autorizados."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Solicitações" value={visible.length} />
        <Stat label="Pendentes de aprovação" value={visible.filter((r) => r.status === "pendente").length} tone="amber" />
        <Stat label="Aprovadas" value={visible.filter((r) => r.status === "aprovada").length} tone="green" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {visible.length === 0 ? (
            <EmptyState title="Nenhuma solicitação" icon="🚚" />
          ) : (
            visible.map((r) => (
              <article key={r.id} className="card-flat p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">
                      {r.kind === "obra" ? "Obra na unidade" : r.kind === "entrega_grande" ? "Entrega de grande porte" : "Mudança"} ·{" "}
                      {r.block} {r.unit}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {dateBR(r.scheduledDate)} · {r.startTime}–{r.endTime} · elevador {r.elevator} · solicitado por {r.requester}
                    </p>
                  </div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </div>
                {r.description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{r.description}</p> : null}
                <ul className="mt-2 grid gap-1 text-xs text-[var(--color-muted)] sm:grid-cols-2">
                  {r.carrierName ? <li>Transportadora: {r.carrierName} {r.carrierDoc ? `(${r.carrierDoc})` : ""}</li> : null}
                  {r.vehiclePlate ? <li>Veículo: {r.vehiclePlate}</li> : null}
                  {r.workers ? <li className="sm:col-span-2">Trabalhadores autorizados: {r.workers}</li> : null}
                  {r.artUrl ? <li>ART/RRT: {r.artUrl}</li> : null}
                  {r.deadlineAt ? <li>Prazo da obra: {dateBR(r.deadlineAt)}</li> : null}
                  <li>Termo de responsabilidade: {r.termAccepted ? "aceito" : "pendente"}</li>
                </ul>
                {r.reviewNotes ? <p className="mt-2 text-xs text-[var(--color-muted)]">Parecer: {r.reviewNotes}</p> : null}
                {canDecide && r.status === "pendente" ? (
                  <div className="mt-3 flex flex-wrap gap-2 no-print">
                    <form action={decideMoveRequestAction} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="aprovada" />
                      <input name="reviewNotes" className="input py-1 text-xs" placeholder="Observações" />
                      <button className="btn-success btn-sm">Aprovar</button>
                    </form>
                    <form action={decideMoveRequestAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="rejeitada" />
                      <button className="btn-danger btn-sm">Rejeitar</button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card title="Nova solicitação">
            <form action={createMoveRequestAction} className="space-y-2">
              <select name="kind" className="input">
                <option value="mudanca">Mudança</option>
                <option value="obra">Obra na unidade</option>
                <option value="entrega_grande">Entrega de grande porte</option>
              </select>
              {!isResident ? (
                <select name="unitId" className="input" required>
                  <option value="">Unidade</option>
                  {unitList.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              ) : null}
              <input type="date" name="scheduledDate" className="input" defaultValue={isoDate()} required />
              <div className="grid grid-cols-2 gap-2">
                <input type="time" name="startTime" className="input" defaultValue="08:00" />
                <input type="time" name="endTime" className="input" defaultValue="17:00" />
              </div>
              <select name="elevator" className="input">
                <option value="Serviço">Elevador de serviço</option>
                <option value="Social">Elevador social</option>
                <option value="Não se aplica">Não se aplica</option>
              </select>
              <input name="carrierName" className="input" placeholder="Transportadora / empresa" />
              <div className="grid grid-cols-2 gap-2">
                <input name="carrierDoc" className="input" placeholder="CNPJ/CPF" />
                <input name="vehiclePlate" className="input uppercase" placeholder="Placa" />
              </div>
              <textarea name="workers" rows={2} className="input" placeholder="Trabalhadores autorizados (nome e documento)" />
              <textarea name="description" rows={2} className="input" placeholder="Descrição do serviço" />
              <div className="grid grid-cols-2 gap-2">
                <input name="artUrl" className="input" placeholder="ART/RRT (URL)" />
                <input type="date" name="deadlineAt" className="input" />
              </div>
              <label className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                <input type="checkbox" name="termAccepted" className="mt-0.5 h-4 w-4" required />
                Li e aceito o termo de responsabilidade por danos às áreas comuns e o cumprimento dos horários permitidos.
              </label>
              <button className="btn-primary w-full">Enviar solicitação</button>
            </form>
          </Card>

          <InfoNote tone="amber">
            Mudanças e obras só liberam o acesso na portaria após a aprovação do síndico. Os trabalhadores autorizados
            aparecem automaticamente na lista de acesso do dia.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
