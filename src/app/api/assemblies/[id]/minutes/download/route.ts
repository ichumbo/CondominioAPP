import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assemblies, assemblyMinuteDownloads, assemblyMinutes, condominiums, units } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !session.condo) {
    return new NextResponse("Não autorizado - Sessão expirada ou inválida.", { status: 401 });
  }

  const { id } = await params;
  const assemblyId = parseInt(id, 10);
  if (!assemblyId || isNaN(assemblyId)) {
    return new NextResponse("ID de assembleia inválido.", { status: 400 });
  }

  const condoId = session.condo.id;

  const [assembly] = await db
    .select()
    .from(assemblies)
    .where(and(eq(assemblies.id, assemblyId), eq(assemblies.condoId, condoId)))
    .limit(1);

  if (!assembly) {
    return new NextResponse("Assembleia não encontrada.", { status: 404 });
  }

  const isStaff = ["superadmin", "sindico", "conselho", "zelador"].includes(session.role);

  // Verificação de escopo para morador
  if (!isStaff && session.role === "morador") {
    if (assembly.audienceScope === "bloco" && assembly.targetBlockId && session.unitId) {
      const [unit] = await db.select({ blockId: units.blockId }).from(units).where(eq(units.id, session.unitId)).limit(1);
      if (unit?.blockId !== assembly.targetBlockId) {
        return new NextResponse("Sem permissão para acessar esta ata.", { status: 403 });
      }
    } else if (assembly.audienceScope === "unidade" && assembly.targetUnitId) {
      if (session.unitId !== assembly.targetUnitId) {
        return new NextResponse("Sem permissão para acessar esta ata.", { status: 403 });
      }
    }
  }

  const [minutes] = await db
    .select()
    .from(assemblyMinutes)
    .where(eq(assemblyMinutes.assemblyId, assemblyId))
    .limit(1);

  if (!minutes) {
    return new NextResponse("Ata ainda não cadastrada.", { status: 404 });
  }

  // Morador não pode baixar ata em rascunho ou revisão
  if (!isStaff && minutes.status !== "publicada") {
    return new NextResponse("A ata ainda está em revisão pela administração e não foi publicada.", { status: 403 });
  }

  // Formatar nome do arquivo
  const [condo] = await db.select({ name: condominiums.name }).from(condominiums).where(eq(condominiums.id, condoId)).limit(1);
  const condoSlug = (condo?.name || "condominio").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dateStr = new Date(assembly.firstCallAt).toISOString().split("T")[0];
  const safeFilename = minutes.fileName || `ata-assembleia-${condoSlug}-${dateStr}.pdf`;

  // Registrar audit trail do download
  await db.insert(assemblyMinuteDownloads).values({
    assemblyId,
    minutesId: minutes.id,
    version: minutes.currentVersion || "1.0",
    userId: session.user.id,
    unitId: session.unitId ?? null,
  });

  await logAudit({
    session,
    condoId,
    action: "baixar_ata",
    entity: "ata_assembleia",
    entityId: assemblyId,
    summary: `Baixou ata v${minutes.currentVersion || "1.0"} de "${assembly.title}"`,
  });

  // Gerar conteúdo textual/PDF da ata
  const textBody = minutes.content || minutes.summary || `ATA DE ASSEMBLEIA CONDOMINIAL\n\nCondomínio: ${condo?.name || "Condomínio"}\nTítulo: ${assembly.title}\nData: ${dateStr}\nVersão: ${minutes.currentVersion || "1.0"}\nStatus: ${minutes.status}\n\nRESUMO DAS DELIBERAÇÕES:\n${minutes.summary || "Sem resumo anexado."}\n\nATA COMPLETA:\n${minutes.content || "Sem conteúdo textual adicional."}`;

  return new NextResponse(textBody, {
    status: 200,
    headers: {
      "Content-Type": minutes.fileFormat === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
