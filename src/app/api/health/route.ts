import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      service: "portaria-mais",
      database: "up",
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, database: "down" }, { status: 500 });
  }
}
