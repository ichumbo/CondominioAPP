import "server-only";
import { db } from "@/db";
import { auditLogs, notifications } from "@/db/schema";
import { clientInfo, type Session } from "@/lib/auth";

type AuditInput = {
  session: Session | null;
  condoId: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  critical?: boolean;
  origin?: string;
};

export async function logAudit(input: AuditInput) {
  const info = await clientInfo();
  await db.insert(auditLogs).values({
    condoId: input.condoId,
    userId: input.session?.user.id ?? null,
    userName: input.session?.user.name ?? "sistema",
    action: input.action,
    entity: input.entity,
    entityId: input.entityId != null ? String(input.entityId) : null,
    summary: input.summary?.slice(0, 235),
    before: input.before ?? null,
    after: input.after ?? null,
    ip: info.ip,
    userAgent: info.userAgent,
    origin: input.origin ?? (input.session?.user.isSuperAdmin ? "suporte" : "painel"),
    critical: input.critical ?? false,
  });
}

export async function notify(
  condoId: number,
  userIds: number[],
  title: string,
  body: string,
  link?: string,
  channel: "app" | "email" | "whatsapp" = "app",
) {
  const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length === 0) return;
  await db.insert(notifications).values(
    unique.map((userId) => ({ condoId, userId, title, body, link, channel })),
  );
}
