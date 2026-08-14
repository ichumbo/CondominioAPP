import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, maintenanceOrders, maintenancePlans, vendors } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Stat, TableWrap } from "@/components/ui";
import { dateBR, daysUntil, isoDate, money } from "@/lib/utils";
import { completeOrderAction, saveAssetAction, saveOrderAction, savePlanAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage() {
  const { condoId } = await requireRole([...ALL_STAFF, "porteiro"]);

  const assetRows = await db.select().from(assets).where(eq(assets.condoId, condoId)).orderBy(asc(assets.name));
  const planRows = await db.select().from(maintenancePlans).where(eq(maintenancePlans.condoId, condoId)).orderBy(asc(maintenancePlans.nextDueAt));
  const orderRows = await db
    .select({
      id: maintenanceOrders.id,
      kind: maintenanceOrders.kind,
      title: maintenanceOrders.title,
      status: maintenanceOrders.status,
      scheduledFor: maintenanceOrders.scheduledFor,
      completedAt: maintenanceOrders.completedAt,
      costCents: maintenanceOrders.costCents,
      technician: maintenanceOrders.technician,
      report: maintenanceOrders.report,
      assetName: assets.name,
      vendorName: vendors.name,
    })
    .from(maintenanceOrders)
    .leftJoin(assets, eq(assets.id, maintenanceOrders.assetId))
    .leftJoin(vendors, eq(vendors.id, maintenanceOrders.vendorId))
    .where(eq(maintenanceOrders.condoId, condoId))
    .orderBy(desc(maintenanceOrders.scheduledFor));
  const vendorRows = await db.select().from(vendors).where(eq(vendors.condoId, condoId)).orderBy(asc(vendors.name));

  const today = isoDate();
  const late = planRows.filter((p) => (p.nextDueAt ?? today) < today);
  const soon = planRows.filter((p) => (p.nextDueAt ?? "") >= today && (daysUntil(p.nextDueAt) ?? 99) <= 15);
  const totalCost = orderRows.filter((o) => o.status === "concluida").reduce((acc, o) => acc + (o.costCents ?? 0), 0);
  const failuresByAsset = orderRows
    .filter((o) => o.kind === "corretiva")
    .reduce<Record<string, number>>((acc, o) => {
      const key = o.assetName ?? "Área comum";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

  return (
    <>
      <PageHeader
        title="Manutenção preventiva e corretiva"
        subtitle="Equipamentos, planos, calendário de vencimentos, checklists, custos e indicadores de falhas recorrentes."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Equipamentos" value={assetRows.length} />
        <Stat label="Planos vencidos" value={late.length} tone="red" hint="ação imediata" />
        <Stat label="Vencem em 15 dias" value={soon.length} tone="amber" />
        <Stat label="Custo concluído" value={money(totalCost)} tone="zinc" hint="ordens finalizadas" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Calendário de manutenções">
            {planRows.length === 0 ? (
              <EmptyState title="Nenhum plano cadastrado" icon="settings" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Plano</th>
                    <th>Equipamento</th>
                    <th>Frequência</th>
                    <th>Próxima</th>
                    <th>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((p) => {
                    const days = daysUntil(p.nextDueAt);
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="font-semibold text-[var(--color-ink)]">{p.title}</span>
                          {p.checklist && p.checklist.length > 0 ? (
                            <span className="block text-xs text-[var(--color-subtle)]">checklist: {p.checklist.join(" · ")}</span>
                          ) : null}
                        </td>
                        <td className="text-xs">{assetRows.find((a) => a.id === p.assetId)?.name ?? "—"}</td>
                        <td className="text-xs">{p.frequencyDays} dias</td>
                        <td className="whitespace-nowrap text-xs">
                          {dateBR(p.nextDueAt)}
                          <Badge tone={days !== null && days < 0 ? "red" : days !== null && days <= 15 ? "amber" : "green"}>
                            {days !== null && days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d`}
                          </Badge>
                        </td>
                        <td className="text-xs">{p.responsible ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card title="Ordens de serviço">
            {orderRows.length === 0 ? (
              <EmptyState title="Nenhuma ordem" icon="🧰" />
            ) : (
              <ul className="space-y-2">
                {orderRows.map((o) => (
                  <li key={o.id} className="rounded-lg border border-[var(--color-line)] p-3 ">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">{o.title}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {o.assetName ?? "área comum"} · {o.vendorName ?? "interno"} · {o.technician ?? "—"} · {money(o.costCents)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={o.kind === "preventiva" ? "blue" : "amber"}>{o.kind}</Badge>
                        <Badge tone={o.status === "concluida" ? "green" : o.status === "em_andamento" ? "amber" : "zinc"}>{o.status}</Badge>
                        <span className="text-xs text-[var(--color-subtle)]">{dateBR(o.scheduledFor)}</span>
                      </div>
                    </div>
                    {o.report ? <p className="mt-1 text-xs text-[var(--color-muted)]">Laudo: {o.report}</p> : null}
                    {o.status !== "concluida" ? (
                      <Panel summary="Concluir ordem" tone="ghost">
                        <form action={completeOrderAction} className="space-y-2">
                          <input type="hidden" name="id" value={o.id} />
                          <textarea name="report" rows={2} className="input" placeholder="Laudo / observações do serviço" />
                          <button className="btn-success btn-sm">Registrar conclusão</button>
                        </form>
                      </Panel>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Indicadores de falhas recorrentes">
            {Object.keys(failuresByAsset).length === 0 ? (
              <EmptyState title="Sem corretivas registradas" icon="chart" />
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(failuresByAsset)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, total]) => (
                    <li key={name} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] px-3 py-2 ">
                      <span className="text-[var(--color-ink)]">{name}</span>
                      <Badge tone={total >= 2 ? "red" : "zinc"}>{total} corretiva(s)</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Nova ordem de serviço">
            <form action={saveOrderAction} className="space-y-3">
              <label className="block">
                <span className="label">Título</span>
                <input name="title" className="input" required />
              </label>
              <label className="block">
                <span className="label">Equipamento</span>
                <select name="assetId" className="input">
                  <option value="">Área comum</option>
                  {assetRows.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Tipo</span>
                  <select name="kind" className="input">
                    <option value="corretiva">Corretiva</option>
                    <option value="preventiva">Preventiva</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Data</span>
                  <input type="date" name="scheduledFor" className="input" defaultValue={today} />
                </label>
              </div>
              <label className="block">
                <span className="label">Fornecedor</span>
                <select name="vendorId" className="input">
                  <option value="">Interno</option>
                  {vendorRows.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Técnico</span>
                  <input name="technician" className="input" />
                </label>
                <label className="block">
                  <span className="label">Custo (R$)</span>
                  <input name="cost" className="input" placeholder="0,00" />
                </label>
              </div>
              <label className="block">
                <span className="label">Descrição</span>
                <textarea name="description" rows={2} className="input" />
              </label>
              <button className="btn-primary w-full">Abrir ordem</button>
            </form>
          </Card>

          <Panel summary="Cadastrar equipamento">
            <form action={saveAssetAction} className="space-y-2">
              <input name="name" className="input" placeholder="Nome do equipamento" required />
              <select name="category" className="input">
                <option value="elevador">Elevador</option>
                <option value="hidraulica">Hidráulica</option>
                <option value="portao">Portão</option>
                <option value="seguranca">Segurança</option>
                <option value="eletrica">Elétrica</option>
                <option value="equipamento">Outro</option>
              </select>
              <input name="location" className="input" placeholder="Local" />
              <input name="brand" className="input" placeholder="Marca" />
              <input name="serial" className="input" placeholder="Nº de série" />
              <button className="btn-dark btn-sm w-full">Salvar equipamento</button>
            </form>
          </Panel>

          <Panel summary="📆 Criar plano preventivo">
            <form action={savePlanAction} className="space-y-2">
              <input name="title" className="input" placeholder="Título do plano" required />
              <select name="assetId" className="input">
                <option value="">Equipamento</option>
                {assetRows.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <input type="number" name="frequencyDays" className="input" placeholder="Frequência (dias)" defaultValue={30} />
              <input type="date" name="nextDueAt" className="input" />
              <select name="vendorId" className="input">
                <option value="">Fornecedor</option>
                {vendorRows.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <input name="responsible" className="input" placeholder="Responsável" />
              <textarea name="checklist" rows={3} className="input" placeholder={"Itens do checklist\num por linha"} />
              <button className="btn-dark btn-sm w-full">Criar plano</button>
            </form>
          </Panel>

          <InfoNote>
            Laudos e certificados podem ser anexados às ordens. Alertas de vencimento aparecem no painel inicial e no
            resumo diário da administração.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
