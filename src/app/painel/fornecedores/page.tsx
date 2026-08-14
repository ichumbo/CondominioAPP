import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, vendors } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Stat, TableWrap } from "@/components/ui";
import { dateBR, daysUntil, isoDate, money } from "@/lib/utils";
import { rateVendorAction, saveContractAction, saveVendorAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const { condoId } = await requireRole(ALL_STAFF);

  const vendorRows = await db.select().from(vendors).where(eq(vendors.condoId, condoId)).orderBy(asc(vendors.name));
  const contractRows = await db
    .select({
      id: contracts.id,
      title: contracts.title,
      object: contracts.object,
      startAt: contracts.startAt,
      endAt: contracts.endAt,
      valueCents: contracts.valueCents,
      billingCycle: contracts.billingCycle,
      adjustmentIndex: contracts.adjustmentIndex,
      status: contracts.status,
      noticeDays: contracts.noticeDays,
      vendorName: vendors.name,
    })
    .from(contracts)
    .innerJoin(vendors, eq(vendors.id, contracts.vendorId))
    .where(eq(contracts.condoId, condoId))
    .orderBy(asc(contracts.endAt));

  const today = isoDate();
  const expired = contractRows.filter((c) => c.endAt < today);
  const expiring = contractRows.filter((c) => c.endAt >= today && (daysUntil(c.endAt) ?? 999) <= 45);
  const monthly = contractRows
    .filter((c) => c.billingCycle === "mensal" && c.endAt >= today)
    .reduce((acc, c) => acc + c.valueCents, 0);

  return (
    <>
      <PageHeader
        title="Fornecedores e contratos"
        subtitle="Cadastro, contatos, contratos vinculados, alertas de vencimento, reajustes, documentos e avaliação de serviço."
        actions={<a href="/api/export/contratos" download className="btn-ghost btn-sm">⬇ Exportar contratos</a>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fornecedores ativos" value={vendorRows.filter((v) => v.active).length} />
        <Stat label="Contratos vigentes" value={contractRows.length - expired.length} tone="green" />
        <Stat label="Vencem em 45 dias" value={expiring.length} tone="amber" hint="renovação" />
        <Stat label="Custo mensal contratado" value={money(monthly)} tone="zinc" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Contratos">
            {contractRows.length === 0 ? (
              <EmptyState title="Nenhum contrato" icon="briefcase" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th>Fornecedor</th>
                    <th>Vigência</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contractRows.map((c) => {
                    const days = daysUntil(c.endAt) ?? 0;
                    const late = c.endAt < today;
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="font-semibold text-[var(--color-ink)]">{c.title}</span>
                          <span className="block text-xs text-[var(--color-subtle)]">{c.object}</span>
                        </td>
                        <td className="text-xs">{c.vendorName}</td>
                        <td className="whitespace-nowrap text-xs">
                          {dateBR(c.startAt)} → {dateBR(c.endAt)}
                          <span className="block text-[var(--color-subtle)]">aviso prévio {c.noticeDays} dias</span>
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {money(c.valueCents)}
                          <span className="block text-[var(--color-subtle)]">{c.billingCycle} · {c.adjustmentIndex}</span>
                        </td>
                        <td>
                          <Badge tone={late ? "red" : days <= 45 ? "amber" : "green"}>
                            {late ? "vencido" : days <= 45 ? `vence em ${days}d` : "vigente"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card title="Fornecedores">
            {vendorRows.length === 0 ? (
              <EmptyState title="Nenhum fornecedor" icon="briefcase" />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {vendorRows.map((v) => (
                  <li key={v.id} className="rounded-lg border border-[var(--color-line)] p-3 ">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">{v.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">{v.category} · {v.cnpj ?? "sem CNPJ"}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {v.contactName ?? "—"} {v.phone ? `· ${v.phone}` : ""}
                        </p>
                        {v.email ? <p className="text-xs text-[var(--color-subtle)]">{v.email}</p> : null}
                      </div>
                      <span className="text-xs font-semibold text-[var(--color-muted)]">{v.rating ? `Nota ${v.rating}/5` : "Sem nota"}</span>
                    </div>
                    <Panel summary="Avaliar" tone="ghost">
                      <form action={rateVendorAction} className="flex gap-2">
                        <input type="hidden" name="id" value={v.id} />
                        <select name="rating" className="input" defaultValue={String(v.rating ?? 5)}>
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>{n} estrela(s)</option>
                          ))}
                        </select>
                        <button className="btn-dark btn-sm">Salvar</button>
                      </form>
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Novo fornecedor">
            <form action={saveVendorAction} className="space-y-2">
              <input name="name" className="input" placeholder="Razão social" required />
              <input name="cnpj" className="input" placeholder="CNPJ" />
              <select name="category" className="input">
                <option value="servicos">Serviços gerais</option>
                <option value="elevadores">Elevadores</option>
                <option value="hidraulica">Hidráulica</option>
                <option value="portoes">Portões</option>
                <option value="seguranca">Segurança</option>
                <option value="jardinagem">Jardinagem</option>
                <option value="limpeza">Limpeza</option>
              </select>
              <input name="contactName" className="input" placeholder="Responsável" />
              <input name="phone" className="input" placeholder="Telefone" />
              <input name="email" className="input" placeholder="E-mail" />
              <textarea name="notes" rows={2} className="input" placeholder="Observações, certidões..." />
              <button className="btn-primary w-full">Cadastrar</button>
            </form>
          </Card>

          <Card title="Novo contrato">
            <form action={saveContractAction} className="space-y-2">
              <select name="vendorId" className="input" required>
                <option value="">Fornecedor</option>
                {vendorRows.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <input name="title" className="input" placeholder="Título do contrato" required />
              <textarea name="object" rows={2} className="input" placeholder="Objeto do contrato" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="startAt" className="input" defaultValue={today} />
                <input type="date" name="endAt" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="value" className="input" placeholder="Valor (R$)" />
                <input type="number" name="noticeDays" className="input" placeholder="Aviso (dias)" defaultValue={30} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select name="billingCycle" className="input">
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                  <option value="unico">Pagamento único</option>
                </select>
                <select name="adjustmentIndex" className="input">
                  <option value="IGPM">IGP-M</option>
                  <option value="IPCA">IPCA</option>
                  <option value="INPC">INPC</option>
                  <option value="fixo">Sem reajuste</option>
                </select>
              </div>
              <input name="documentUrl" className="input" placeholder="Documento (URL)" />
              <button className="btn-primary w-full">Salvar contrato</button>
            </form>
          </Card>

          <InfoNote tone="amber">
            Contratos vencidos ou próximos do vencimento geram alerta no painel inicial e notificação ao síndico com
            antecedência configurável.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
