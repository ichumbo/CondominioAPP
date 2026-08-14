import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { lostItems } from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { ALL_STAFF } from "@/lib/rbac";
import { Badge, Card, EmptyState, InfoNote, PageHeader, Panel, Stat } from "@/components/ui";
import { dateBR, isoDate } from "@/lib/utils";
import { unitOptions } from "@/lib/queries";
import { claimLostItemAction, saveLostItemAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function AchadosPage() {
  const { session, condoId } = await requireCondo();
  const canManage = [...ALL_STAFF, "porteiro"].includes(session.role);

  const rows = await db.select().from(lostItems).where(eq(lostItems.condoId, condoId)).orderBy(desc(lostItems.foundAt));
  const stored = rows.filter((r) => r.status === "guardado");
  const unitList = await unitOptions(condoId);

  return (
    <>
      <PageHeader
        title="Achados e perdidos"
        subtitle="Cadastro do objeto, foto, local, prazo de descarte, divulgação aos moradores e registro de quem retirou."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Itens guardados" value={stored.length} tone="amber" />
        <Stat label="Devolvidos" value={rows.filter((r) => r.status === "devolvido").length} tone="green" />
        <Stat label="Descartados" value={rows.filter((r) => r.status === "descartado").length} tone="zinc" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyState title="Nenhum item registrado" icon="search" />
          ) : (
            rows.map((item) => (
              <article key={item.id} className="card-flat p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">{item.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      Encontrado em {item.foundLocation ?? "—"} · {dateBR(item.foundAt)} · guardado em {item.storedLocation}
                    </p>
                  </div>
                  <Badge tone={item.status === "guardado" ? "amber" : item.status === "devolvido" ? "green" : "zinc"}>
                    {item.status}
                  </Badge>
                </div>
                {item.description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{item.description}</p> : null}
                {item.status === "guardado" && item.discardAfter ? (
                  <p className="mt-1 text-xs text-[var(--color-subtle)]">Descarte previsto após {dateBR(item.discardAfter)}</p>
                ) : null}
                {item.claimedBy ? (
                  <p className="mt-1 text-xs text-[var(--color-success)] ">
                    Retirado por {item.claimedBy} em {dateBR(item.claimedAt)}
                  </p>
                ) : null}
                {canManage && item.status === "guardado" ? (
                  <Panel summary="📤 Registrar retirada / descarte" tone="ghost">
                    <form action={claimLostItemAction} className="space-y-2">
                      <input type="hidden" name="id" value={item.id} />
                      <label className="block">
                        <span className="label">Situação</span>
                        <select name="status" className="input">
                          <option value="devolvido">Devolvido ao morador</option>
                          <option value="descartado">Descartado após prazo</option>
                        </select>
                      </label>
                      <input name="claimedBy" className="input" placeholder="Nome de quem recebeu" />
                      <select name="claimedUnitId" className="input">
                        <option value="">Unidade (opcional)</option>
                        {unitList.map((u) => (
                          <option key={u.id} value={u.id}>{u.label}</option>
                        ))}
                      </select>
                      <button className="btn-success btn-sm w-full">Confirmar</button>
                    </form>
                  </Panel>
                ) : null}
              </article>
            ))
          )}
        </div>

        <div className="space-y-4">
          {canManage ? (
            <Card title="Registrar item encontrado">
              <form action={saveLostItemAction} className="space-y-2">
                <input name="title" className="input" placeholder="Objeto" required />
                <textarea name="description" rows={2} className="input" placeholder="Descrição / características" />
                <input name="foundLocation" className="input" placeholder="Local onde foi encontrado" />
                <input type="date" name="foundAt" className="input" defaultValue={isoDate()} />
                <input name="storedLocation" className="input" placeholder="Onde está guardado" defaultValue="Portaria" />
                <input name="photoUrl" className="input" placeholder="Foto (URL)" />
                <button className="btn-primary w-full">Registrar e divulgar</button>
              </form>
            </Card>
          ) : null}

          <InfoNote>
            Itens ficam disponíveis por 90 dias. Após o prazo definido pelo condomínio, o descarte é registrado com
            responsável, data e hora na trilha de auditoria.
          </InfoNote>
        </div>
      </div>
    </>
  );
}
