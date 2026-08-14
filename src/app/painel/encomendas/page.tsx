import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { blocks, parcels, units, users } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { GATE } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Stat, TableWrap } from "@/components/ui";
import { dateTimeBR } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { deliverParcelAction, registerParcelAction } from "@/lib/actions/portaria";
import { qrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export default async function EncomendasPage() {
  const { session, condoId } = await requireCondo();
  const isGate = GATE.includes(session.role);
  const isResident = session.role === "morador";
  const scope = isResident && session.unitId ? eq(parcels.unitId, session.unitId) : undefined;

  const rows = await db
    .select({
      id: parcels.id,
      code: parcels.code,
      kind: parcels.kind,
      carrier: parcels.carrier,
      tracking: parcels.trackingCode,
      description: parcels.description,
      shelf: parcels.shelf,
      status: parcels.status,
      pickupCode: parcels.pickupCode,
      receivedAt: parcels.receivedAt,
      pickedUpAt: parcels.pickedUpAt,
      pickedUpBy: parcels.pickedUpBy,
      signature: parcels.signature,
      unit: units.number,
      block: blocks.name,
      receiver: users.name,
    })
    .from(parcels)
    .leftJoin(units, eq(units.id, parcels.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .leftJoin(users, eq(users.id, parcels.receivedById))
    .where(and(eq(parcels.condoId, condoId), scope))
    .orderBy(desc(parcels.receivedAt))
    .limit(80);

  const pending = rows.filter((r) => r.status === "pendente");
  const staleBefore = new Date();
  staleBefore.setDate(staleBefore.getDate() - 7);
  const pendingWithStatus = pending.map((p) => ({ ...p, isLate: new Date(p.receivedAt) < staleBefore }));
  const late = pendingWithStatus.filter((r) => r.isLate);
  const delivered = rows.filter((r) => r.status === "entregue");

  const [{ id: staleId } = { id: 0 }] = await db
    .select({ id: parcels.id })
    .from(parcels)
    .where(and(eq(parcels.condoId, condoId), eq(parcels.status, "pendente"), lt(parcels.receivedAt, staleBefore)))
    .limit(1);

  const unitList = await unitOptions(condoId);
  const qrMap = new Map<number, string>();
  for (const parcel of pendingWithStatus.slice(0, 6)) {
    qrMap.set(parcel.id, await qrDataUrl(`ENC:${parcel.code}:${parcel.pickupCode}`, 120));
  }

  return (
    <>
      <PageHeader
        title="Encomendas e correspondências"
        subtitle="Registro na portaria, notificação automática ao morador, código/QR de retirada e confirmação digital de quem retirou."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Aguardando retirada" value={pending.length} tone="amber" hint="na portaria" />
        <Stat label="Atrasadas (7+ dias)" value={late.length} tone="red" hint={staleId ? "cobrar retirada" : "nenhuma"} />
        <Stat label="Entregues" value={delivered.length} tone="green" hint="com assinatura" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Encomendas pendentes">
            {pending.length === 0 ? (
              <EmptyState title="Nenhuma encomenda pendente" icon="package" description="Tudo entregue aos moradores." />
            ) : (
              <ul className="space-y-3">
                {pendingWithStatus.map((p) => {
                  return (
                    <li key={p.id} className={`rounded-lg border p-3 ${p.isLate ? "border-[#efc9c9] bg-[var(--color-danger-soft)]  " : "border-[var(--color-line)]"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex gap-3">
                          {qrMap.get(p.id) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qrMap.get(p.id)} alt="QR de retirada" className="h-20 w-20 rounded-md border border-[var(--color-line)] bg-white " />
                          ) : null}
                          <div>
                            <p className="font-semibold text-[var(--color-ink)]">
                              {p.code} · {p.block} {p.unit}
                            </p>
                            <p className="text-xs text-[var(--color-muted)]">
                              {p.carrier ?? "sem transportadora"}{p.tracking ? ` · ${p.tracking}` : ""} · {p.kind}
                            </p>
                            <p className="text-xs text-[var(--color-muted)]">
                              Recebida {dateTimeBR(p.receivedAt)} por {p.receiver ?? "portaria"} · local {p.shelf ?? "portaria"}
                            </p>
                            <p className="mt-1 text-xs">
                              Código de retirada:{" "}
                              <strong className="rounded bg-[var(--color-ink)] px-2 py-0.5 font-mono text-white">
                                {isGate || isResident ? p.pickupCode : "••••••"}
                              </strong>
                              {p.isLate ? <Badge tone="red">atrasada</Badge> : null}
                            </p>
                          </div>
                        </div>
                        {isGate ? (
                          <Panel summary="Registrar retirada" tone="ghost">
                            <form action={deliverParcelAction} className="space-y-2">
                              <input type="hidden" name="id" value={p.id} />
                              <label className="block">
                                <span className="label">Código informado</span>
                                <input name="pickupCode" className="input" placeholder="6 dígitos" />
                              </label>
                              <label className="block">
                                <span className="label">Quem retirou</span>
                                <input name="pickedUpBy" className="input" required />
                              </label>
                              <label className="block">
                                <span className="label">Documento</span>
                                <input name="pickedUpDocument" className="input" />
                              </label>
                              <label className="block">
                                <span className="label">Assinatura digital (nome completo)</span>
                                <input name="signature" className="input" />
                              </label>
                              <button className="btn-success w-full btn-sm">Confirmar entrega</button>
                            </form>
                          </Panel>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Histórico por unidade">
            {rows.length === 0 ? (
              <EmptyState title="Sem histórico" icon="package" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Unidade</th>
                    <th>Recebida</th>
                    <th>Retirada</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.code}</td>
                      <td className="text-xs">{p.block} {p.unit}</td>
                      <td className="whitespace-nowrap text-xs">{dateTimeBR(p.receivedAt)}</td>
                      <td className="text-xs">
                        {p.pickedUpAt ? (
                          <>
                            {dateTimeBR(p.pickedUpAt)}
                            <span className="block text-[var(--color-subtle)]">por {p.pickedUpBy} · assinado: {p.signature}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <Badge tone={p.status === "entregue" ? "green" : "amber"}>{p.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {isGate ? (
            <Card title="Registrar encomenda">
              <form action={registerParcelAction} className="space-y-3">
                <label className="block">
                  <span className="label">Unidade</span>
                  <select name="unitId" className="input" required>
                    <option value="">Selecione</option>
                    {unitList.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="label">Tipo</span>
                    <select name="kind" className="input">
                      <option value="encomenda">Encomenda</option>
                      <option value="correspondencia">Correspondência</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Transportadora</span>
                    <input name="carrier" className="input" />
                  </label>
                </div>
                <label className="block">
                  <span className="label">Rastreio</span>
                  <input name="trackingCode" className="input" />
                </label>
                <label className="block">
                  <span className="label">Descrição</span>
                  <input name="description" className="input" placeholder="Caixa média, envelope..." />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="label">Prateleira</span>
                    <input name="shelf" className="input" />
                  </label>
                  <label className="block">
                    <span className="label">Foto (URL)</span>
                    <input name="photoUrl" className="input" />
                  </label>
                </div>
                <button className="btn-primary w-full">Registrar e notificar</button>
              </form>
            </Card>
          ) : (
            <Card title="Como retirar">
              <ol className="list-decimal space-y-2 pl-4 text-sm text-[var(--color-muted)]">
                <li>Apresente o código de retirada (ou o QR Code) na portaria.</li>
                <li>A portaria confere o documento de quem está retirando.</li>
                <li>A confirmação digital é registrada com data, hora e responsável.</li>
              </ol>
            </Card>
          )}

          <InfoNote tone="amber">
            Encomendas pendentes há mais de 7 dias são sinalizadas como atrasadas e podem gerar cobrança automática de
            retirada no comunicado semanal.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
