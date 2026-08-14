import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blocks, budgets, charges, transactions, units, vendors } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Progress, Stat, TableWrap } from "@/components/ui";
import { dateBR, isoDate, money, percent } from "@/lib/utils";
import { payTransactionAction, registerChargePaymentAction, saveTransactionAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const { condo, condoId } = await requireRole(["superadmin", "sindico", "conselho"]);
  const currentYear = new Date().getFullYear();

  const txRows = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      category: transactions.category,
      costCenter: transactions.costCenter,
      description: transactions.description,
      amountCents: transactions.amountCents,
      dueDate: transactions.dueDate,
      paidDate: transactions.paidDate,
      status: transactions.status,
      reserveFund: transactions.reserveFund,
      vendorName: vendors.name,
    })
    .from(transactions)
    .leftJoin(vendors, eq(vendors.id, transactions.vendorId))
    .where(eq(transactions.condoId, condoId))
    .orderBy(desc(transactions.dueDate))
    .limit(120);

  const chargeRows = await db
    .select({
      id: charges.id,
      reference: charges.reference,
      amountCents: charges.amountCents,
      dueDate: charges.dueDate,
      status: charges.status,
      unit: units.number,
      block: blocks.name,
    })
    .from(charges)
    .leftJoin(units, eq(units.id, charges.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(eq(charges.condoId, condoId))
    .orderBy(desc(charges.dueDate))
    .limit(200);

  const budgetRows = await db.select().from(budgets).where(eq(budgets.condoId, condoId)).orderBy(asc(budgets.category));
  const vendorRows = await db.select().from(vendors).where(eq(vendors.condoId, condoId)).orderBy(asc(vendors.name));

  const income = txRows.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amountCents, 0);
  const expense = txRows.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amountCents, 0);
  const payable = txRows.filter((t) => t.kind === "despesa" && t.status !== "pago");
  const reserve = txRows.filter((t) => t.reserveFund).reduce((a, t) => a + t.amountCents, 0);
  const overdue = chargeRows.filter((c) => c.status === "vencida");
  const delinquency = percent(overdue.length, chargeRows.length);

  const realizedByCategory = txRows
    .filter((t) => t.kind === "despesa")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amountCents;
      return acc;
    }, {});

  return (
    <>
      <PageHeader
        title="Controle financeiro"
        subtitle={`Receitas, despesas, contas a pagar, orçamento x realizado, fundo de reserva e inadimplência · ${condo.name}`}
        actions={<a href="/api/export/financeiro" download className="btn-ghost btn-sm">⬇ Prestação de contas (CSV)</a>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Receitas (período)" value={money(income)} tone="green" />
        <Stat label="Despesas (período)" value={money(expense)} tone="red" />
        <Stat label="Contas a pagar" value={money(payable.reduce((a, t) => a + t.amountCents, 0))} tone="amber" hint={`${payable.length} títulos`} />
        <Stat label="Fundo de reserva" value={money(reserve)} tone="blue" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Orçamento x realizado" description={`Exercício ${currentYear}`}>
            {budgetRows.length === 0 ? (
              <EmptyState title="Orçamento não cadastrado" icon="chart" />
            ) : (
              <ul className="space-y-3">
                {budgetRows.map((b) => {
                  const realized = realizedByCategory[b.category] ?? 0;
                  const pct = percent(realized, b.plannedCents);
                  return (
                    <li key={b.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize text-[var(--color-ink)]">{b.category}</span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {money(realized)} de {money(b.plannedCents)} ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} tone={pct > 100 ? "bg-[var(--color-danger)]" : pct > 80 ? "bg-[var(--color-warn)]" : "bg-[var(--color-success)]"} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Contas a pagar e lançamentos">
            <TableWrap>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th className="no-print">Ação</th>
                </tr>
              </thead>
              <tbody>
                {txRows.slice(0, 40).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="font-semibold text-[var(--color-ink)]">{t.description}</span>
                      <span className="block text-xs text-[var(--color-subtle)]">
                        {t.kind} · {t.costCenter}{t.vendorName ? ` · ${t.vendorName}` : ""}
                      </span>
                    </td>
                    <td className="text-xs capitalize">{t.category.replace("_", " ")}</td>
                    <td className="whitespace-nowrap text-xs">{dateBR(t.dueDate)}</td>
                    <td className={`whitespace-nowrap text-xs font-semibold ${t.kind === "receita" ? "text-[var(--color-success)]" : "text-[var(--color-ink)]"}`}>
                      {money(t.amountCents)}
                    </td>
                    <td>
                      <Badge tone={t.status === "pago" ? "green" : t.status === "atrasado" ? "red" : "amber"}>{t.status}</Badge>
                    </td>
                    <td className="no-print">
                      {t.status !== "pago" ? (
                        <form action={payTransactionAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="btn-ghost btn-sm">Baixar</button>
                        </form>
                      ) : (
                        <span className="text-xs text-[var(--color-subtle)]">{dateBR(t.paidDate)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <Card title="Inadimplência" description={`${overdue.length} cobranças vencidas · ${delinquency}% da base`}>
            {overdue.length === 0 ? (
              <EmptyState title="Nenhuma cobrança vencida" icon="check" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Referência</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th className="no-print">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.block} {c.unit}</td>
                      <td className="text-xs">{c.reference}</td>
                      <td className="whitespace-nowrap text-xs">{dateBR(c.dueDate)}</td>
                      <td className="whitespace-nowrap text-xs font-semibold text-[var(--color-danger)]">{money(c.amountCents)}</td>
                      <td className="no-print">
                        <form action={registerChargePaymentAction} className="flex gap-1">
                          <input type="hidden" name="id" value={c.id} />
                          <select name="method" className="input py-1 text-xs">
                            <option value="pix">PIX</option>
                            <option value="boleto">Boleto</option>
                            <option value="transferencia">Transferência</option>
                          </select>
                          <button className="btn-success btn-sm">Quitar</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Novo lançamento">
            <form action={saveTransactionAction} className="space-y-2">
              <select name="kind" className="input">
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
              <input name="description" className="input" placeholder="Descrição" required />
              <div className="grid grid-cols-2 gap-2">
                <input name="amount" className="input" placeholder="Valor (R$)" required />
                <input type="date" name="dueDate" className="input" defaultValue={isoDate()} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select name="category" className="input">
                  <option value="manutencao">Manutenção</option>
                  <option value="pessoal">Pessoal</option>
                  <option value="utilidades">Utilidades</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="suprimentos">Suprimentos</option>
                  <option value="taxa_condominial">Taxa condominial</option>
                  <option value="fundo_reserva">Fundo de reserva</option>
                </select>
                <select name="costCenter" className="input">
                  <option value="administracao">Administração</option>
                  <option value="pessoal">Pessoal</option>
                  <option value="areas_comuns">Áreas comuns</option>
                  <option value="obras">Obras</option>
                </select>
              </div>
              <select name="vendorId" className="input">
                <option value="">Fornecedor (opcional)</option>
                {vendorRows.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <input name="attachmentUrl" className="input" placeholder="Nota fiscal / comprovante (URL)" />
              <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <input type="checkbox" name="reserveFund" className="h-4 w-4" /> Compõe o fundo de reserva
              </label>
              <button className="btn-primary w-full">Lançar</button>
            </form>
          </Card>

          <Card title="Resumo para moradores">
            <ul className="space-y-2 text-sm text-[var(--color-muted)]">
              <li className="flex justify-between"><span>Arrecadação</span><strong>{money(income)}</strong></li>
              <li className="flex justify-between"><span>Despesas</span><strong>{money(expense)}</strong></li>
              <li className="flex justify-between"><span>Resultado</span><strong className={income - expense >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>{money(income - expense)}</strong></li>
              <li className="flex justify-between"><span>Inadimplência</span><strong>{delinquency}%</strong></li>
            </ul>
            <Panel summary="Gerar prestação de contas" tone="ghost">
              <p className="text-xs text-[var(--color-muted)]">
                O relatório consolidado é exportado em CSV e pode ser publicado em Documentos para todos os moradores,
                com anexos de notas fiscais e comprovantes.
              </p>
              <a href="/api/export/financeiro" download className="btn-dark btn-sm mt-2">Baixar agora</a>
            </Panel>
          </Card>

          <InfoNote>
            Módulo opcional por plano. Integrações com bancos, boletos e PIX podem ser habilitadas por API sem alterar o
            fluxo operacional já registrado aqui.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
