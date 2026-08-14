import type { ReactNode } from "react";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { navFor, ROLE_LABEL } from "@/lib/rbac";
import { Shell } from "@/components/shell";
import { logoutAction, switchCondoAction } from "@/lib/actions/session";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  const session = await requireSession();
  const condoId = session.condo?.id ?? 0;

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));

  const nav = navFor(session.role);
  const activeMembership = session.memberships.find((m) => m.condoId === condoId);

  return (
    <Shell
      nav={nav}
      condos={session.memberships.map((m) => ({ id: m.condoId, name: m.condoName }))}
      activeCondoId={condoId}
      userName={session.user.name}
      roleLabel={ROLE_LABEL[session.role]}
      unitLabel={activeMembership?.unitLabel ?? null}
      condoName={session.condo?.name ?? "Condomínio"}
      unread={Number(count ?? 0)}
      switchAction={switchCondoAction}
      logout={logoutAction}
    >
      {children}
    </Shell>
  );
}
