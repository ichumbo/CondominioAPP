import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blocks, memberships, units, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, ROLE_LABEL, type Role } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Stat, TableWrap } from "@/components/ui";
import { dateBR, percent } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { BulkForm } from "@/components/client-bits";
import {
  bulkMembershipAction,
  importResidentsAction,
  inviteResidentAction,
  saveBlockAction,
  saveUnitAction,
} from "@/lib/actions/gestao";

export const dynamic = "force-dynamic";

export default async function MoradoresPage() {
  const { session, condoId } = await requireRole(ALL_STAFF);
  const canEdit = ["superadmin", "sindico"].includes(session.role);

  const people = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: memberships.role,
      relation: memberships.relation,
      status: memberships.status,
      invitedAt: memberships.invitedAt,
      lastLoginAt: users.lastLoginAt,
      firstAccessAt: users.firstAccessAt,
      unit: units.number,
      block: blocks.name,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(units, eq(units.id, memberships.unitId))
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(eq(memberships.condoId, condoId))
    .orderBy(asc(users.name));

  const blockList = await db.select().from(blocks).where(eq(blocks.condoId, condoId)).orderBy(asc(blocks.name));
  const unitRows = await db
    .select({ id: units.id, number: units.number, floor: units.floor, fraction: units.fraction, status: units.status, spots: units.parkingSpots, block: blocks.name })
    .from(units)
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(eq(units.condoId, condoId))
    .orderBy(asc(blocks.name), asc(units.number));
  const unitList = await unitOptions(condoId);

  const invited = people.filter((p) => p.status === "convidado");
  const active = people.filter((p) => p.firstAccessAt);
  const adoption = percent(active.length, people.length);

  return (
    <>
      <PageHeader
        title="Moradores, blocos e unidades"
        subtitle="Cadastro completo, convites, ações em massa e importação validada de planilhas."
        actions={<a href="/api/export/moradores" className="btn-ghost btn-sm" download>⬇ Exportar CSV</a>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pessoas cadastradas" value={people.length} />
        <Stat label="Unidades" value={unitRows.length} hint={`${blockList.length} blocos`} />
        <Stat label="Convites pendentes" value={invited.length} tone="amber" />
        <Stat label="Taxa de primeiro acesso" value={`${adoption}%`} tone={adoption > 70 ? "green" : "amber"} hint={`${active.length} ativos`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Pessoas (${people.length})`}>
            {people.length === 0 ? (
              <EmptyState title="Nenhum morador cadastrado" icon="users" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Unidade</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={`${p.userId}-${p.unit ?? "s"}`}>
                      <td>
                        <span className="font-semibold text-[var(--color-ink)]">{p.name}</span>
                        <span className="block text-xs text-[var(--color-subtle)]">{p.email}{p.phone ? ` · ${p.phone}` : ""}</span>
                      </td>
                      <td className="text-xs">{p.block ?? "—"} {p.unit ?? ""}<span className="block text-[var(--color-subtle)]">{p.relation}</span></td>
                      <td><Badge tone="blue">{ROLE_LABEL[p.role as Role] ?? p.role}</Badge></td>
                      <td>
                        <Badge tone={p.status === "ativo" ? "green" : p.status === "convidado" ? "amber" : "red"}>{p.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {p.lastLoginAt ? dateBR(p.lastLoginAt) : "nunca acessou"}
                        {p.invitedAt && !p.firstAccessAt ? <span className="block text-[var(--color-subtle)]">convidado {dateBR(p.invitedAt)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card title={`Unidades (${unitRows.length})`}>
            <TableWrap>
              <thead>
                <tr>
                  <th>Bloco</th>
                  <th>Unidade</th>
                  <th>Andar</th>
                  <th>Fração ideal</th>
                  <th>Vagas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unitRows.map((u) => (
                  <tr key={u.id}>
                    <td>{u.block ?? "—"}</td>
                    <td className="font-semibold">{u.number}</td>
                    <td>{u.floor}</td>
                    <td>{u.fraction}%</td>
                    <td>{u.spots}</td>
                    <td><Badge tone={u.status === "ocupada" ? "green" : "zinc"}>{u.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </div>

        <div className="space-y-4">
          {canEdit ? (
            <>
              <Card title="Convidar morador">
                <form action={inviteResidentAction} className="space-y-3">
                  <label className="block">
                    <span className="label">Nome</span>
                    <input name="name" className="input" required />
                  </label>
                  <label className="block">
                    <span className="label">E-mail</span>
                    <input type="email" name="email" className="input" required />
                  </label>
                  <label className="block">
                    <span className="label">Telefone</span>
                    <input name="phone" className="input" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="label">Unidade</span>
                      <select name="unitId" className="input">
                        <option value="">—</option>
                        {unitList.map((u) => (
                          <option key={u.id} value={u.id}>{u.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">Perfil</span>
                      <select name="role" className="input">
                        <option value="morador">Morador</option>
                        <option value="conselho">Conselho</option>
                        <option value="porteiro">Portaria</option>
                        <option value="zelador">Zelador</option>
                        <option value="sindico">Síndico</option>
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="label">Relação</span>
                    <select name="relation" className="input">
                      <option value="proprietario">Proprietário</option>
                      <option value="inquilino">Inquilino</option>
                      <option value="residente">Residente</option>
                    </select>
                  </label>
                  <button className="btn-primary w-full">Enviar convite</button>
                </form>
              </Card>

              <Card title="Ações em massa" description="Selecione com checkbox e aplique a operação.">
                <BulkForm
                  action={bulkMembershipAction}
                  ids={people.map((p) => ({ id: p.userId, label: `${p.name} · ${p.block ?? ""} ${p.unit ?? ""}`.trim() }))}
                  labels={{ title: "Selecionar pessoas", submit: "Aplicar" }}
                >
                  <label className="block">
                    <span className="label">Operação</span>
                    <select name="operation" className="input">
                      <option value="reenviar">Reenviar convite</option>
                      <option value="ativar">Ativar usuários</option>
                      <option value="desativar">Desativar usuários</option>
                    </select>
                  </label>
                </BulkForm>
              </Card>

              <Panel summary="📥 Importar moradores (CSV)">
                <form action={importResidentsAction} className="space-y-3">
                  <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-2 font-mono text-[11px] text-[var(--color-muted)]   ">
                    bloco;unidade;nome;email;telefone
                    <br />
                    Bloco A;302;Ana Ribeiro;ana@email.com;(41) 98888-7070
                  </p>
                  <label className="block">
                    <span className="label">Cole as linhas do CSV</span>
                    <textarea name="csv" rows={6} className="input font-mono text-xs" required />
                  </label>
                  <label className="block">
                    <span className="label">Nome do arquivo</span>
                    <input name="fileName" className="input" defaultValue="moradores.csv" />
                  </label>
                  <button className="btn-primary w-full">Validar e importar</button>
                </form>
              </Panel>

              <Panel summary="Novo bloco / unidade">
                <div className="space-y-4">
                  <form action={saveBlockAction} className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Bloco</p>
                    <input name="name" className="input" placeholder="Bloco D" required />
                    <input type="number" name="floors" className="input" placeholder="Andares" defaultValue={8} />
                    <button className="btn-dark btn-sm w-full">Criar bloco</button>
                  </form>
                  <form action={saveUnitAction} className="space-y-2 border-t border-[var(--color-line)] pt-3 ">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Unidade</p>
                    <select name="blockId" className="input">
                      {blockList.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <input name="number" className="input" placeholder="Número (ex.: 501)" required />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" name="floor" className="input" placeholder="Andar" />
                      <input name="fraction" className="input" placeholder="Fração (1.00)" />
                    </div>
                    <button className="btn-dark btn-sm w-full">Criar unidade</button>
                  </form>
                </div>
              </Panel>
            </>
          ) : null}

          <InfoNote>
            A importação valida e-mails, duplicidades e existência da unidade antes de gravar. Erros ficam registrados no
            painel de implantação para correção.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
