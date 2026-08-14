import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blocks, memberships, units, users } from "@/db/schema";

export async function unitOptions(condoId: number) {
  const rows = await db
    .select({ id: units.id, number: units.number, block: blocks.name })
    .from(units)
    .leftJoin(blocks, eq(blocks.id, units.blockId))
    .where(eq(units.condoId, condoId))
    .orderBy(asc(blocks.name), asc(units.number));
  return rows.map((r) => ({ id: r.id, label: `${r.block ?? "Sem bloco"} · ${r.number}` }));
}

export async function blockOptions(condoId: number) {
  return db.select({ id: blocks.id, name: blocks.name }).from(blocks).where(eq(blocks.condoId, condoId)).orderBy(asc(blocks.name));
}

export async function peopleOptions(condoId: number, roles?: string[]) {
  const where = roles
    ? and(eq(memberships.condoId, condoId), inArray(memberships.role, roles))
    : eq(memberships.condoId, condoId);
  const rows = await db
    .select({ id: users.id, name: users.name, role: memberships.role, unitId: memberships.unitId })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(where)
    .orderBy(asc(users.name));
  return rows;
}

export function unitLabelMap(list: { id: number; label: string }[]) {
  const map = new Map<number, string>();
  for (const item of list) map.set(item.id, item.label);
  return map;
}
