import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { condominiums, memberships, units, users } from "@/db/schema";

const SECRET = process.env.SESSION_SECRET ?? "gestao-condominio-dev-secret";
const SESSION_COOKIE = "gc_session";
const CONDO_COOKIE = "gc_condo";
const MAX_AGE = 60 * 60 * 24 * 30;

export type Role = "superadmin" | "sindico" | "conselho" | "zelador" | "porteiro" | "morador";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const target = Buffer.from(hash, "hex");
  if (candidate.length !== target.length) return false;
  return timingSafeEqual(candidate, target);
}

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("hex").slice(0, 32);
}

export async function createSession(userId: number) {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}.${expires}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(CONDO_COOKIE);
}

export async function setActiveCondo(condoId: number) {
  const jar = await cookies();
  jar.set(CONDO_COOKIE, String(condoId), { path: "/", maxAge: MAX_AGE, sameSite: "lax" });
}

function readUserId(raw: string | undefined) {
  if (!raw) return null;
  const [id, expires, signature] = raw.split(".");
  if (!id || !expires || !signature) return null;
  if (sign(`${id}.${expires}`) !== signature) return null;
  if (Number(expires) < Date.now()) return null;
  return Number(id);
}

export type Membership = {
  id: number;
  condoId: number;
  condoName: string;
  condoSlug: string;
  plan: string;
  role: Role;
  unitId: number | null;
  unitLabel: string | null;
  status: string;
};

export type Session = {
  user: typeof users.$inferSelect;
  memberships: Membership[];
  condo: typeof condominiums.$inferSelect | null;
  role: Role;
  unitId: number | null;
};

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const userId = readUserId(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status === "bloqueado") return null;

  const rows = await db
    .select({
      id: memberships.id,
      condoId: memberships.condoId,
      role: memberships.role,
      unitId: memberships.unitId,
      status: memberships.status,
      condoName: condominiums.name,
      condoSlug: condominiums.slug,
      plan: condominiums.plan,
      unitNumber: units.number,
    })
    .from(memberships)
    .innerJoin(condominiums, eq(condominiums.id, memberships.condoId))
    .leftJoin(units, eq(units.id, memberships.unitId))
    .where(eq(memberships.userId, userId));

  let list: Membership[] = rows.map((r) => ({
    id: r.id,
    condoId: r.condoId,
    condoName: r.condoName,
    condoSlug: r.condoSlug,
    plan: r.plan,
    role: r.role as Role,
    unitId: r.unitId,
    unitLabel: r.unitNumber,
    status: r.status,
  }));

  if (user.isSuperAdmin) {
    const allCondos = await db.select().from(condominiums);
    const existing = new Set(list.map((m) => m.condoId));
    list = [
      ...list,
      ...allCondos
        .filter((c) => !existing.has(c.id))
        .map((c) => ({
          id: -c.id,
          condoId: c.id,
          condoName: c.name,
          condoSlug: c.slug,
          plan: c.plan,
          role: "superadmin" as Role,
          unitId: null,
          unitLabel: null,
          status: "ativo",
        })),
    ];
  }

  const cookieCondo = Number(jar.get(CONDO_COOKIE)?.value ?? 0);
  const active = list.find((m) => m.condoId === cookieCondo) ?? list[0] ?? null;
  let condo: typeof condominiums.$inferSelect | null = null;
  if (active) {
    const [c] = await db.select().from(condominiums).where(eq(condominiums.id, active.condoId)).limit(1);
    condo = c ?? null;
  }

  return {
    user,
    memberships: list,
    condo,
    role: user.isSuperAdmin ? "superadmin" : ((active?.role ?? "morador") as Role),
    unitId: active?.unitId ?? null,
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireCondo() {
  const session = await requireSession();
  if (!session.condo) redirect("/login?erro=sem-condominio");
  return { session, condo: session.condo, condoId: session.condo.id };
}

export async function requireRole(roles: Role[]) {
  const ctx = await requireCondo();
  if (!roles.includes(ctx.session.role)) redirect("/painel?erro=sem-permissao");
  return ctx;
}

export async function authenticate(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  if (user.status === "bloqueado") return null;
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), firstAccessAt: user.firstAccessAt ?? new Date() })
    .where(eq(users.id, user.id));
  await createSession(user.id);
  const [firstMembership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.status, "ativo")))
    .limit(1);
  if (firstMembership) await setActiveCondo(firstMembership.condoId);
  else {
    const [anyCondo] = await db.select().from(condominiums).limit(1);
    if (anyCondo) await setActiveCondo(anyCondo.id);
  }
  return user;
}

export async function clientInfo() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1",
    userAgent: (h.get("user-agent") ?? "desconhecido").slice(0, 230),
  };
}
