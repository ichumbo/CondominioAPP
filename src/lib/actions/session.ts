"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authenticate, destroySession, getSession, setActiveCondo } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/utils";

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = str(formData, "email");
  const password = str(formData, "password");
  if (!email || !password) return "Informe e-mail e senha.";
  const user = await authenticate(email, password);
  if (!user) {
    await logAudit({
      session: null,
      condoId: null,
      action: "login_negado",
      entity: "auth",
      summary: `Tentativa de acesso negada para ${email}`,
      critical: true,
      origin: "login",
    });
    return "Credenciais inválidas. Verifique e tente novamente.";
  }
  const session = await getSession();
  await logAudit({
    session,
    condoId: session?.condo?.id ?? null,
    action: "login",
    entity: "auth",
    entityId: user.id,
    summary: `${user.name} acessou o sistema`,
    origin: "login",
  });
  redirect("/painel");
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await logAudit({
      session,
      condoId: session.condo?.id ?? null,
      action: "logout",
      entity: "auth",
      entityId: session.user.id,
      summary: `${session.user.name} encerrou a sessão`,
    });
  }
  await destroySession();
  redirect("/login");
}

export async function switchCondoAction(formData: FormData) {
  const condoId = Number(formData.get("condoId"));
  if (Number.isFinite(condoId) && condoId > 0) await setActiveCondo(condoId);
  revalidatePath("/painel", "layout");
  redirect("/painel");
}

export async function setThemeAction(theme: string) {
  const session = await getSession();
  if (!session) return;
  await db
    .update(users)
    .set({ theme: theme === "dark" ? "dark" : "light" })
    .where(eq(users.id, session.user.id));
}
