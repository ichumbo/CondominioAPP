import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assemblies,
  assemblyAgenda,
  assemblyAttendance,
  assemblyMinuteVersions,
  assemblyMinutes,
  assemblyVotes,
  blocks,
  units,
} from "@/db/schema";
import { requireCondo } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { unitOptions } from "@/lib/queries";
import { PrintButton } from "@/components/client-bits";
import { AssembliesClientView } from "@/components/assembly-client";

export const dynamic = "force-dynamic";

export default async function AssembleiasPage() {
  const { session, condoId } = await requireCondo();

  // Buscar assembleias do condomínio
  const allAssemblies = await db
    .select()
    .from(assemblies)
    .where(eq(assemblies.condoId, condoId))
    .orderBy(desc(assemblies.firstCallAt));

  // Escopo de moradores
  const isResident = session.role === "morador";
  let residentBlockId: number | null = null;
  if (isResident && session.unitId) {
    const [u] = await db.select({ blockId: units.blockId }).from(units).where(eq(units.id, session.unitId)).limit(1);
    residentBlockId = u?.blockId ?? null;
  }

  const visibleAssemblies = allAssemblies.filter((a) => {
    if (!isResident) return true;
    if (a.audienceScope === "unidade") return a.targetUnitId === session.unitId;
    if (a.audienceScope === "bloco") return a.targetBlockId === residentBlockId;
    return true;
  });

  const ids = visibleAssemblies.map((r) => r.id);

  const agenda = ids.length
    ? await db
        .select()
        .from(assemblyAgenda)
        .where(inArray(assemblyAgenda.assemblyId, ids))
        .orderBy(asc(assemblyAgenda.position))
    : [];

  const attendance = ids.length
    ? await db.select().from(assemblyAttendance).where(inArray(assemblyAttendance.assemblyId, ids))
    : [];

  const votes = ids.length ? await db.select().from(assemblyVotes).where(inArray(assemblyVotes.assemblyId, ids)) : [];

  const minutesList = ids.length
    ? await db.select().from(assemblyMinutes).where(inArray(assemblyMinutes.assemblyId, ids))
    : [];

  const versions = minutesList.length
    ? await db
        .select()
        .from(assemblyMinuteVersions)
        .where(inArray(assemblyMinuteVersions.minutesId, minutesList.map((m) => m.id)))
        .orderBy(desc(assemblyMinuteVersions.createdAt))
    : [];

  const unitList = await unitOptions(condoId);
  const condoBlocks = await db.select({ id: blocks.id, name: blocks.name }).from(blocks).where(eq(blocks.condoId, condoId));

  return (
    <>
      <PageHeader
        title="Assembleias"
        subtitle="Convocação digital, pautas, confirmações de presença, atas, resumos e controle de versão de documentos de assembleias."
        actions={<PrintButton label="Imprimir relatórios" />}
      />

      <AssembliesClientView
        session={{
          role: session.role,
          user: { id: session.user.id, name: session.user.name },
          unitId: session.unitId ?? null,
        }}
        assemblies={visibleAssemblies}
        agendaItems={agenda}
        attendances={attendance}
        votes={votes}
        minutesList={minutesList}
        minuteVersions={versions}
        unitOptions={unitList}
        blocks={condoBlocks}
      />
    </>
  );
}
