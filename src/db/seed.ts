import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabase } from "@/db/setup";
import {
  amenities,
  announcements,
  assemblies,
  assemblyAgenda,
  assemblyAttendance,
  assemblyVotes,
  assets,
  auditLogs,
  blocks,
  budgets,
  charges,
  condominiums,
  contracts,
  documents,
  helpArticles,
  importJobs,
  lostItems,
  maintenanceOrders,
  maintenancePlans,
  memberships,
  moveRequests,
  notifications,
  occurrences,
  parcels,
  pollOptions,
  pollVotes,
  polls,
  reservations,
  shifts,
  supportTickets,
  ticketComments,
  tickets,
  transactions,
  units,
  users,
  vendors,
  visitors,
  visits,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { isoDate, pickupCode, sequence, token } from "@/lib/utils";

let seeding: Promise<void> | null = null;

function at(daysOffset: number, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function day(offset: number) {
  return isoDate(at(offset));
}

export async function ensureSeed() {
  if (seeding) return seeding;
  seeding = (async () => {
    try {
      await ensureDatabase();
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(condominiums);
      if (Number(row?.n ?? 0) > 0) return;
      await seed();
    } catch (error) {
      seeding = null;
      console.warn("seed skipped:", error);
    }
  })();
  return seeding;
}

async function seed() {
  const pass = hashPassword("demo1234");

  const [condoA, condoB] = await db
    .insert(condominiums)
    .values([
      {
        name: "Residencial Parque das Águas",
        slug: "parque-das-aguas",
        cnpj: "12.345.678/0001-90",
        address: "Av. das Nações, 1200",
        city: "Curitiba",
        state: "PR",
        plan: "enterprise",
        modules: ["portaria", "financeiro", "assembleias", "manutencao"],
        onboardingStep: 9,
        onboardingDone: true,
        storageUsedMb: 1840,
      },
      {
        name: "Edifício Vista Marina",
        slug: "vista-marina",
        cnpj: "98.765.432/0001-10",
        address: "Rua Beira Mar, 45",
        city: "Florianópolis",
        state: "SC",
        plan: "pro",
        modules: ["portaria", "assembleias"],
        onboardingStep: 4,
        onboardingDone: false,
        storageUsedMb: 240,
      },
    ])
    .returning();

  const blockRows = await db
    .insert(blocks)
    .values([
      { condoId: condoA.id, name: "Bloco A", floors: 8 },
      { condoId: condoA.id, name: "Bloco B", floors: 8 },
      { condoId: condoA.id, name: "Bloco C", floors: 4 },
      { condoId: condoB.id, name: "Torre Única", floors: 12 },
    ])
    .returning();

  const unitValues: (typeof units.$inferInsert)[] = [];
  for (const block of blockRows) {
    const perFloor = block.condoId === condoA.id ? 4 : 2;
    const floors = block.condoId === condoA.id ? 4 : 6;
    for (let f = 1; f <= floors; f++) {
      for (let u = 1; u <= perFloor; u++) {
        unitValues.push({
          condoId: block.condoId,
          blockId: block.id,
          number: `${f}0${u}`,
          floor: f,
          fraction: (0.9 + u * 0.05).toFixed(2),
          kind: "apartamento",
          status: f === 4 && u === 4 ? "vaga" : "ocupada",
          parkingSpots: u % 2 === 0 ? 2 : 1,
        });
      }
    }
  }
  const unitRows = await db.insert(units).values(unitValues).returning();
  const unitsA = unitRows.filter((u) => u.condoId === condoA.id);
  const A302 = unitsA.find((u) => u.number === "302" && u.blockId === blockRows[0].id) ?? unitsA[0];
  const A201 = unitsA.find((u) => u.number === "201" && u.blockId === blockRows[0].id) ?? unitsA[1];
  const B101 = unitsA.find((u) => u.blockId === blockRows[1].id) ?? unitsA[2];

  const userRows = await db
    .insert(users)
    .values([
      { name: "Rafael Monteiro", email: "admin@portariamais.com.br", passwordHash: pass, isSuperAdmin: true, phone: "(41) 99999-0001", lastLoginAt: at(-1, 8) },
      { name: "Marina Duarte", email: "sindico@portariamais.com.br", passwordHash: pass, phone: "(41) 99888-1122", document: "882.331.220-11", lastLoginAt: at(0, 7), firstAccessAt: at(-120) },
      { name: "Carlos Nogueira", email: "portaria@portariamais.com.br", passwordHash: pass, phone: "(41) 99777-3344", lastLoginAt: at(0, 6), firstAccessAt: at(-90) },
      { name: "Rita Bezerra", email: "portaria2@portariamais.com.br", passwordHash: pass, phone: "(41) 99777-5566", lastLoginAt: at(-1, 22), firstAccessAt: at(-88) },
      { name: "Jonas Alencar", email: "zelador@portariamais.com.br", passwordHash: pass, phone: "(41) 99666-1010", lastLoginAt: at(-2, 10), firstAccessAt: at(-70) },
      { name: "Helena Prado", email: "conselho@portariamais.com.br", passwordHash: pass, phone: "(41) 99555-2020", lastLoginAt: at(-3, 19), firstAccessAt: at(-65) },
      { name: "Ana Ribeiro", email: "morador@portariamais.com.br", passwordHash: pass, phone: "(41) 98888-7070", document: "455.221.980-04", lastLoginAt: at(0, 8), firstAccessAt: at(-60) },
      { name: "Bruno Tavares", email: "bruno@portariamais.com.br", passwordHash: pass, phone: "(41) 98777-6060", lastLoginAt: at(-5, 20), firstAccessAt: at(-40) },
      { name: "Clara Souza", email: "clara@portariamais.com.br", passwordHash: pass, phone: "(41) 98666-5050", status: "convidado" },
      { name: "Diego Martins", email: "diego@portariamais.com.br", passwordHash: pass, phone: "(41) 98555-4040", status: "convidado" },
      { name: "Eduarda Lima", email: "eduarda@portariamais.com.br", passwordHash: pass, lastLoginAt: at(-12, 15), firstAccessAt: at(-30) },
      { name: "Sérgio Bastos", email: "sindico.marina@portariamais.com.br", passwordHash: pass, phone: "(48) 99444-3030", lastLoginAt: at(-4, 11), firstAccessAt: at(-20) },
    ])
    .returning();

  const [admin, sindica, porteiro1, porteiro2, zelador, conselheira, moradorA, moradorB, convidada, convidado2, moradoraE, sindicoB] = userRows;

  await db.insert(memberships).values([
    { userId: sindica.id, condoId: condoA.id, role: "sindico", acceptedAt: at(-120) },
    { userId: porteiro1.id, condoId: condoA.id, role: "porteiro", acceptedAt: at(-90) },
    { userId: porteiro2.id, condoId: condoA.id, role: "porteiro", acceptedAt: at(-88) },
    { userId: zelador.id, condoId: condoA.id, role: "zelador", acceptedAt: at(-70) },
    { userId: conselheira.id, condoId: condoA.id, role: "conselho", unitId: unitsA[5].id, acceptedAt: at(-65) },
    { userId: moradorA.id, condoId: condoA.id, role: "morador", unitId: A302.id, relation: "proprietario", acceptedAt: at(-60) },
    { userId: moradorB.id, condoId: condoA.id, role: "morador", unitId: B101.id, relation: "inquilino", acceptedAt: at(-40) },
    { userId: convidada.id, condoId: condoA.id, role: "morador", unitId: A201.id, status: "convidado", invitedAt: at(-6) },
    { userId: convidado2.id, condoId: condoA.id, role: "morador", unitId: unitsA[7].id, status: "convidado", invitedAt: at(-2) },
    { userId: moradoraE.id, condoId: condoA.id, role: "morador", unitId: unitsA[9].id, acceptedAt: at(-30) },
    { userId: admin.id, condoId: condoA.id, role: "superadmin", acceptedAt: at(-200) },
    { userId: sindicoB.id, condoId: condoB.id, role: "sindico", acceptedAt: at(-20) },
    { userId: sindica.id, condoId: condoB.id, role: "conselho", acceptedAt: at(-18) },
  ]);

  /* ------------------------------------------------------------ portaria */
  const visitorRows = await db
    .insert(visitors)
    .values([
      { condoId: condoA.id, name: "Paulo Henrique Dias", document: "021.334.556-70", phone: "(41) 98111-2233", kind: "visitante" },
      { condoId: condoA.id, name: "Fernanda Rocha", document: "882.114.223-01", phone: "(41) 98122-4455", kind: "visitante" },
      { condoId: condoA.id, name: "Marcelo Prestes", document: "551.220.334-88", kind: "prestador", company: "Clean Vidros Ltda", recurring: true, vehiclePlate: "AZR-4H12" },
      { condoId: condoA.id, name: "Luciana Prado", document: "334.220.115-90", kind: "prestador", company: "Pet Care Curitiba", recurring: true },
      { condoId: condoA.id, name: "João Vitor Alves", document: "110.554.332-19", kind: "entrega", company: "Rapidex Log" },
      { condoId: condoA.id, name: "Roberto Camargo", document: "998.221.334-55", kind: "visitante", blocked: true, blockReason: "Desacato à equipe de portaria em 12/03. Entrada apenas com autorização do síndico." },
      { condoId: condoA.id, name: "Simone Faria", document: "445.998.221-33", kind: "prestador", company: "Diarista autônoma", recurring: true },
      { condoId: condoA.id, name: "Equipe Elevatec", document: "22.334.556/0001-77", docType: "CNPJ", kind: "prestador", company: "Elevatec Manutenção", recurring: true, vehiclePlate: "QPD-2C34" },
    ])
    .returning();

  await db.insert(visits).values([
    {
      condoId: condoA.id, visitorId: visitorRows[0].id, unitId: A302.id, hostUserId: moradorA.id, purpose: "Visita familiar",
      status: "dentro", qrToken: token(), validFrom: at(0, 8), validUntil: at(0, 23), authorizedById: moradorA.id, authorizedAt: at(0, 8),
      checkinAt: at(0, 14), checkinById: porteiro1.id, createdById: moradorA.id,
    },
    {
      condoId: condoA.id, visitorId: visitorRows[1].id, unitId: A302.id, hostUserId: moradorA.id, purpose: "Jantar",
      status: "autorizado", qrToken: token(), validFrom: at(0, 12), validUntil: at(1, 2), authorizedById: moradorA.id, authorizedAt: at(0, 9), createdById: moradorA.id,
    },
    {
      condoId: condoA.id, visitorId: visitorRows[2].id, unitId: B101.id, hostUserId: moradorB.id, purpose: "Limpeza de vidros",
      status: "aguardando", qrToken: token(), validFrom: at(0, 7), validUntil: at(2, 18), createdById: porteiro1.id,
    },
    {
      condoId: condoA.id, visitorId: visitorRows[3].id, unitId: A302.id, hostUserId: moradorA.id, purpose: "Passeio com o pet",
      status: "autorizado", qrToken: token(), validFrom: at(0, 6), validUntil: at(7, 20), authorizedById: moradorA.id, authorizedAt: at(-1, 20), createdById: moradorA.id,
    },
    {
      condoId: condoA.id, visitorId: visitorRows[4].id, unitId: B101.id, hostUserId: moradorB.id, purpose: "Entrega de móvel",
      status: "finalizado", qrToken: token(), validFrom: at(-1, 8), validUntil: at(-1, 18), authorizedById: moradorB.id, authorizedAt: at(-1, 8),
      checkinAt: at(-1, 10), checkinById: porteiro2.id, checkoutAt: at(-1, 11, 30), checkoutById: porteiro2.id, createdById: porteiro2.id,
    },
    {
      condoId: condoA.id, visitorId: visitorRows[6].id, unitId: A201.id, purpose: "Serviço doméstico semanal",
      status: "finalizado", qrToken: token(), validFrom: at(-2, 7), validUntil: at(-2, 18), authorizedById: sindica.id, authorizedAt: at(-2, 7),
      checkinAt: at(-2, 8), checkinById: porteiro1.id, checkoutAt: at(-2, 17), checkoutById: porteiro1.id, createdById: porteiro1.id,
    },
    {
      condoId: condoA.id, visitorId: visitorRows[5].id, unitId: A302.id, purpose: "Visita não anunciada",
      status: "negado", qrToken: token(), validFrom: at(-3, 19), validUntil: at(-3, 22), deniedReason: "Visitante consta na lista de bloqueio.", createdById: porteiro2.id,
    },
    {
      condoId: condoA.id, visitorId: visitorRows[7].id, purpose: "Manutenção preventiva dos elevadores",
      status: "dentro", qrToken: token(), validFrom: at(0, 7), validUntil: at(0, 19), authorizedById: sindica.id, authorizedAt: at(-1, 16),
      checkinAt: at(0, 8, 10), checkinById: porteiro1.id, createdById: sindica.id, vehiclePlate: "QPD-2C34",
    },
  ]);

  await db.insert(parcels).values([
    { condoId: condoA.id, unitId: A302.id, code: sequence("ENC", 1), carrier: "Correios", trackingCode: "BR992134556BR", description: "Caixa média", shelf: "Prateleira A2", pickupCode: pickupCode(), receivedById: porteiro1.id, receivedAt: at(0, 10) },
    { condoId: condoA.id, unitId: A302.id, code: sequence("ENC", 2), kind: "correspondencia", carrier: "Correios", description: "Correspondência bancária", shelf: "Escaninho 302", pickupCode: pickupCode(), receivedById: porteiro1.id, receivedAt: at(-1, 11) },
    { condoId: condoA.id, unitId: B101.id, code: sequence("ENC", 3), carrier: "Mercado Livre", trackingCode: "ML-778213", description: "Pacote grande - eletrodoméstico", shelf: "Depósito", pickupCode: pickupCode(), receivedById: porteiro2.id, receivedAt: at(-4, 15) },
    { condoId: condoA.id, unitId: A201.id, code: sequence("ENC", 4), carrier: "Shopee", description: "Envelope acolchoado", shelf: "Prateleira B1", pickupCode: pickupCode(), receivedById: porteiro1.id, receivedAt: at(-9, 9) },
    { condoId: condoA.id, unitId: unitsA[5].id, code: sequence("ENC", 5), carrier: "Amazon", description: "Livros", shelf: "Prateleira A1", pickupCode: pickupCode(), status: "entregue", receivedById: porteiro2.id, receivedAt: at(-6, 14), pickedUpAt: at(-5, 19), pickedUpBy: "Helena Prado", pickedUpDocument: "334.221.110-98", signature: "Helena Prado" },
    { condoId: condoA.id, unitId: B101.id, code: sequence("ENC", 6), kind: "delivery", carrier: "iFood", description: "Pedido de comida", pickupCode: pickupCode(), status: "entregue", receivedById: porteiro1.id, receivedAt: at(-1, 20), pickedUpAt: at(-1, 20, 12), pickedUpBy: "Bruno Tavares", signature: "Bruno Tavares" },
    { condoId: condoA.id, unitId: unitsA[9].id, code: sequence("ENC", 7), carrier: "Jadlog", description: "Caixa pequena", shelf: "Prateleira C3", pickupCode: pickupCode(), receivedById: porteiro2.id, receivedAt: at(-13, 16) },
  ]);

  const shiftRows = await db
    .insert(shifts)
    .values([
      { condoId: condoA.id, userId: porteiro2.id, period: "noite", status: "encerrado", startedAt: at(-1, 22), endedAt: at(0, 6), handoverToId: porteiro1.id, handoverNotes: "Portão social com ruído no motor. Chaves do salão conferidas. Ronda 03h sem intercorrências.", pendingItems: "Aguardando retirada de 3 encomendas antigas.", checklist: { radios: true, chaves: true, cameras: true, extintores: false, interfone: true } },
      { condoId: condoA.id, userId: porteiro1.id, period: "manha", status: "aberto", startedAt: at(0, 6), checklist: { radios: true, chaves: true, cameras: true, extintores: true, interfone: true } },
      { condoId: condoA.id, userId: porteiro1.id, period: "tarde", status: "encerrado", startedAt: at(-2, 14), endedAt: at(-2, 22), handoverToId: porteiro2.id, handoverNotes: "Obra do 402 encerrada às 17h. Elevador de serviço liberado.", checklist: { radios: true, chaves: true, cameras: true, extintores: true, interfone: true } },
    ])
    .returning();

  await db.insert(occurrences).values([
    { condoId: condoA.id, shiftId: shiftRows[1].id, code: sequence("OC", 1), visibility: "publica", category: "seguranca", severity: "media", title: "Portão social sem fechamento automático", description: "Portão social permaneceu aberto por 40 segundos após a passagem de veículos.", actionsTaken: "Acionado zelador e aberto chamado para a Portec. Portaria manteve controle manual.", occurredAt: at(0, 7, 40), reportedById: porteiro1.id },
    { condoId: condoA.id, shiftId: shiftRows[0].id, code: sequence("OC", 2), visibility: "publica", category: "barulho", severity: "baixa", title: "Ruído excessivo no salão de festas", description: "Som acima do permitido após as 22h durante evento particular.", actionsTaken: "Contato com o responsável pela reserva; som reduzido às 22h20.", occurredAt: at(-1, 22, 10), reportedById: porteiro2.id, unitId: A201.id, ackById: sindica.id, ackAt: at(0, 9) },
    { condoId: condoA.id, shiftId: shiftRows[0].id, code: sequence("OC", 3), visibility: "sigilosa", category: "seguranca", severity: "alta", title: "Tentativa de acesso por pessoa não autorizada", description: "Indivíduo tentou acessar a garagem acompanhando veículo de morador (carona de portão).", actionsTaken: "Acesso negado, imagens preservadas e boletim interno emitido. Registro compartilhado apenas com síndica e conselho.", occurredAt: at(-1, 23, 20), reportedById: porteiro2.id, ackById: sindica.id, ackAt: at(0, 8, 30) },
    { condoId: condoA.id, shiftId: shiftRows[2].id, code: sequence("OC", 4), visibility: "administrativa", category: "manutencao", severity: "media", title: "Vazamento na tubulação do subsolo", description: "Identificado vazamento próximo à bomba de recalque 2.", actionsTaken: "Registro fechado parcialmente e empresa Hidrotec acionada.", occurredAt: at(-2, 16), reportedById: porteiro1.id },
    { condoId: condoA.id, code: sequence("OC", 5), visibility: "publica", category: "convivencia", severity: "baixa", title: "Animal sem guia na área comum", description: "Cão de médio porte circulando sem guia no hall.", actionsTaken: "Morador orientado quanto ao regimento interno.", occurredAt: at(-4, 18, 15), reportedById: porteiro2.id, unitId: B101.id },
  ]);

  /* ------------------------------------------------------------- geral */
  const amenityRows = await db
    .insert(amenities)
    .values([
      { condoId: condoA.id, name: "Salão de festas", capacity: 60, feeCents: 15000, rules: "Uso até 23h. Limpeza obrigatória.", requiresApproval: true },
      { condoId: condoA.id, name: "Churrasqueira Gourmet", capacity: 20, feeCents: 8000, rules: "Carvão por conta do morador.", requiresApproval: true },
      { condoId: condoA.id, name: "Quadra poliesportiva", capacity: 20, feeCents: 0, requiresApproval: false, openTime: "07:00", closeTime: "22:00" },
      { condoId: condoA.id, name: "Coworking", capacity: 8, feeCents: 0, requiresApproval: false, openTime: "06:00", closeTime: "23:00" },
      { condoId: condoB.id, name: "Salão de festas", capacity: 40, feeCents: 12000 },
    ])
    .returning();

  await db.insert(reservations).values([
    { condoId: condoA.id, amenityId: amenityRows[0].id, unitId: A302.id, userId: moradorA.id, date: day(6), startTime: "16:00", endTime: "23:00", guests: 35, status: "aprovada", qrToken: token(8) },
    { condoId: condoA.id, amenityId: amenityRows[1].id, unitId: B101.id, userId: moradorB.id, date: day(2), startTime: "12:00", endTime: "17:00", guests: 12, status: "pendente", qrToken: token(8) },
    { condoId: condoA.id, amenityId: amenityRows[2].id, unitId: A201.id, userId: conselheira.id, date: day(0), startTime: "19:00", endTime: "20:00", guests: 6, status: "aprovada", qrToken: token(8) },
    { condoId: condoA.id, amenityId: amenityRows[3].id, unitId: A302.id, userId: moradorA.id, date: day(1), startTime: "09:00", endTime: "12:00", status: "aprovada", qrToken: token(8) },
    { condoId: condoA.id, amenityId: amenityRows[0].id, unitId: unitsA[9].id, userId: moradoraE.id, date: day(-10), startTime: "18:00", endTime: "23:00", guests: 40, status: "concluida", qrToken: token(8), checkinAt: at(-10, 18) },
  ]);

  await db.insert(announcements).values([
    { condoId: condoA.id, title: "Manutenção preventiva dos elevadores", body: "Nesta quinta-feira, das 8h às 12h, o elevador social do Bloco A ficará indisponível para manutenção preventiva da Elevatec. Utilize o elevador de serviço.", category: "manutencao", priority: "alta", authorId: sindica.id, pinned: true, publishedAt: at(-1, 9) },
    { condoId: condoA.id, title: "Nova rotina de retirada de encomendas", body: "As encomendas passam a ser retiradas mediante código enviado no aplicativo. A portaria registrará a assinatura digital de quem retirar.", category: "portaria", priority: "normal", authorId: sindica.id, publishedAt: at(-3, 10) },
    { condoId: condoA.id, title: "Assembleia Geral Ordinária 2026", body: "Convocação publicada com pauta, quórum e instruções para participação híbrida. Documentos disponíveis na área de assembleias.", category: "assembleia", priority: "alta", authorId: sindica.id, publishedAt: at(-5, 14) },
    { condoId: condoA.id, title: "Dedetização das áreas comuns", body: "Serviço realizado no sábado, das 7h às 11h. Mantenha portas e janelas fechadas nesse período.", category: "geral", priority: "normal", authorId: zelador.id, publishedAt: at(-8, 8) },
  ]);

  const ticketRows = await db
    .insert(tickets)
    .values([
      { condoId: condoA.id, code: sequence("CH", 1), unitId: A302.id, title: "Infiltração no teto do banheiro", description: "Mancha de umidade aumentando na laje do banheiro social.", category: "manutencao", priority: "alta", status: "em_andamento", aiPriority: "alta", aiSummary: "Possível vazamento na prumada; sugerida inspeção hidráulica prioritária.", openedById: moradorA.id, assignedToId: zelador.id, dueAt: at(2, 18) },
      { condoId: condoA.id, code: sequence("CH", 2), unitId: B101.id, title: "Lâmpada queimada na garagem", description: "Vaga 42 sem iluminação há três dias.", category: "manutencao", priority: "baixa", status: "aberto", aiPriority: "baixa", aiSummary: "Troca simples de lâmpada; sem risco imediato.", openedById: moradorB.id, dueAt: at(4, 18) },
      { condoId: condoA.id, code: sequence("CH", 3), title: "Portão da garagem com ruído", description: "Motor apresenta ruído forte ao abrir.", category: "seguranca", priority: "alta", status: "aberto", aiPriority: "alta", aiSummary: "Risco de falha do portão; recomenda-se chamado técnico.", openedById: porteiro1.id, dueAt: at(1, 12) },
      { condoId: condoA.id, code: sequence("CH", 4), unitId: A201.id, title: "Barulho recorrente após 23h", description: "Reclamação de ruído vindo do apartamento vizinho.", category: "convivencia", priority: "media", status: "concluido", openedById: conselheira.id, assignedToId: sindica.id, closedAt: at(-6, 17), rating: 5, ratingComment: "Rápida mediação da síndica." },
      { condoId: condoA.id, code: sequence("CH", 5), unitId: A302.id, title: "Solicitação de segunda via da chave do salão", description: "Necessário para o evento do dia 20.", category: "administrativo", priority: "media", status: "aguardando_morador", openedById: moradorA.id, assignedToId: sindica.id, dueAt: at(3, 18) },
    ])
    .returning();

  await db.insert(ticketComments).values([
    { ticketId: ticketRows[0].id, userId: zelador.id, body: "Inspeção realizada. Vazamento vem da prumada do 402. Empresa Hidrotec agendada para quinta." },
    { ticketId: ticketRows[0].id, userId: moradorA.id, body: "Obrigada! Estarei em casa a partir das 14h." },
    { ticketId: ticketRows[0].id, userId: sindica.id, body: "Custo aprovado no orçamento de manutenção corretiva.", internal: true },
    { ticketId: ticketRows[3].id, userId: sindica.id, body: "Mediação realizada com as duas partes. Acordo registrado em ata interna." },
  ]);

  await db.insert(documents).values([
    { condoId: condoA.id, title: "Convenção do condomínio", category: "juridico", description: "Documento registrado em cartório.", fileName: "convencao.pdf", sizeKb: 2400, visibility: "moradores", uploadedById: sindica.id },
    { condoId: condoA.id, title: "Regimento interno 2026", category: "juridico", fileName: "regimento-2026.pdf", sizeKb: 900, visibility: "moradores", version: "3.1", uploadedById: sindica.id },
    { condoId: condoA.id, title: "Prestação de contas - mês anterior", category: "financeiro", fileName: "prestacao-contas.pdf", sizeKb: 640, visibility: "moradores", uploadedById: sindica.id },
    { condoId: condoA.id, title: "Laudo de inspeção predial", category: "tecnico", fileName: "laudo-predial.pdf", sizeKb: 5100, visibility: "administrativo", uploadedById: zelador.id },
    { condoId: condoA.id, title: "Ata da última assembleia", category: "assembleia", fileName: "ata-age.pdf", sizeKb: 380, visibility: "moradores", uploadedById: sindica.id },
    { condoId: condoA.id, title: "Contrato de portaria", category: "contrato", fileName: "contrato-portaria.pdf", sizeKb: 720, visibility: "administrativo", uploadedById: sindica.id },
  ]);

  const [poll1, poll2] = await db
    .insert(polls)
    .values([
      { condoId: condoA.id, question: "Qual horário prefere para a manutenção da piscina?", description: "Consulta não deliberativa para organizar a agenda.", status: "aberta", endsAt: at(5, 20), createdById: sindica.id },
      { condoId: condoA.id, question: "Devemos instalar tomadas para carros elétricos na garagem?", description: "Consulta prévia à assembleia.", status: "encerrada", endsAt: at(-2, 20), createdById: sindica.id },
    ])
    .returning();

  const optionRows = await db
    .insert(pollOptions)
    .values([
      { pollId: poll1.id, label: "Segunda a sexta, pela manhã" },
      { pollId: poll1.id, label: "Segunda a sexta, à tarde" },
      { pollId: poll1.id, label: "Aos sábados" },
      { pollId: poll2.id, label: "Sim, com rateio entre interessados" },
      { pollId: poll2.id, label: "Sim, custeado pelo fundo de reserva" },
      { pollId: poll2.id, label: "Não instalar por enquanto" },
    ])
    .returning();

  await db.insert(pollVotes).values([
    { pollId: poll1.id, optionId: optionRows[0].id, userId: moradorA.id, unitId: A302.id },
    { pollId: poll1.id, optionId: optionRows[2].id, userId: moradorB.id, unitId: B101.id },
    { pollId: poll1.id, optionId: optionRows[0].id, userId: conselheira.id, unitId: unitsA[5].id },
    { pollId: poll2.id, optionId: optionRows[3].id, userId: moradorA.id, unitId: A302.id },
    { pollId: poll2.id, optionId: optionRows[5].id, userId: moradorB.id, unitId: B101.id },
    { pollId: poll2.id, optionId: optionRows[3].id, userId: moradoraE.id, unitId: unitsA[9].id },
  ]);

  /* -------------------------------------------------- manutenção/vendors */
  const vendorRows = await db
    .insert(vendors)
    .values([
      { condoId: condoA.id, name: "Elevatec Manutenção", cnpj: "22.334.556/0001-77", category: "elevadores", contactName: "Sandro Melo", phone: "(41) 3333-1122", email: "contato@elevatec.com.br", rating: 5 },
      { condoId: condoA.id, name: "Hidrotec Serviços", cnpj: "33.221.998/0001-45", category: "hidraulica", contactName: "Márcia Reis", phone: "(41) 3222-8899", email: "atendimento@hidrotec.com.br", rating: 4 },
      { condoId: condoA.id, name: "Portec Automatizadores", cnpj: "44.110.223/0001-12", category: "portoes", contactName: "Everton Luz", phone: "(41) 3555-4433", rating: 3 },
      { condoId: condoA.id, name: "SegFire Extintores", cnpj: "55.998.112/0001-31", category: "seguranca", contactName: "Paula Nunes", phone: "(41) 3666-7788", rating: 5 },
      { condoId: condoA.id, name: "Verde Vivo Jardinagem", cnpj: "66.223.114/0001-08", category: "jardinagem", contactName: "Ricardo Gomes", phone: "(41) 3777-2211", rating: 4 },
    ])
    .returning();

  await db.insert(contracts).values([
    { condoId: condoA.id, vendorId: vendorRows[0].id, title: "Manutenção mensal de elevadores", object: "Duas visitas mensais e atendimento emergencial 24h.", startAt: day(-330), endAt: day(35), valueCents: 189000, adjustmentIndex: "IGPM" },
    { condoId: condoA.id, vendorId: vendorRows[3].id, title: "Recarga e inspeção de extintores", object: "Inspeção anual e recarga conforme NBR.", startAt: day(-200), endAt: day(20), valueCents: 420000, billingCycle: "anual", adjustmentIndex: "IPCA" },
    { condoId: condoA.id, vendorId: vendorRows[4].id, title: "Jardinagem quinzenal", object: "Poda, adubação e limpeza das áreas verdes.", startAt: day(-150), endAt: day(215), valueCents: 96000 },
    { condoId: condoA.id, vendorId: vendorRows[2].id, title: "Manutenção de portões automáticos", object: "Preventiva trimestral com peças inclusas.", startAt: day(-400), endAt: day(-10), valueCents: 78000, status: "vencido" },
  ]);

  const assetRows = await db
    .insert(assets)
    .values([
      { condoId: condoA.id, name: "Elevador social - Bloco A", category: "elevador", location: "Bloco A", brand: "Atlas", serial: "ELV-A-2019", installedAt: day(-2200) },
      { condoId: condoA.id, name: "Elevador de serviço - Bloco A", category: "elevador", location: "Bloco A", brand: "Atlas", serial: "ELV-B-2019", installedAt: day(-2200), status: "atencao" },
      { condoId: condoA.id, name: "Bomba de recalque 2", category: "hidraulica", location: "Subsolo", brand: "Schneider", serial: "BR-002", installedAt: day(-1400) },
      { condoId: condoA.id, name: "Portão social automatizado", category: "portao", location: "Entrada principal", brand: "Portec", serial: "PT-901", status: "manutencao" },
      { condoId: condoA.id, name: "Extintores - pavimentos", category: "seguranca", location: "Todos os blocos", brand: "SegFire" },
      { condoId: condoA.id, name: "CFTV - 32 câmeras", category: "seguranca", location: "Perímetro", brand: "Intelbras", serial: "CFTV-32" },
    ])
    .returning();

  await db.insert(maintenancePlans).values([
    { condoId: condoA.id, assetId: assetRows[0].id, title: "Preventiva mensal do elevador social", frequencyDays: 30, vendorId: vendorRows[0].id, responsible: "Elevatec", nextDueAt: day(3), lastDoneAt: day(-27), checklist: ["Cabos e polias", "Freios de emergência", "Nivelamento", "Interfone da cabine"] },
    { condoId: condoA.id, assetId: assetRows[2].id, title: "Inspeção das bombas de recalque", frequencyDays: 60, vendorId: vendorRows[1].id, responsible: "Hidrotec", nextDueAt: day(-2), lastDoneAt: day(-62), checklist: ["Pressão", "Vedações", "Quadro elétrico"] },
    { condoId: condoA.id, assetId: assetRows[4].id, title: "Inspeção de extintores", frequencyDays: 180, vendorId: vendorRows[3].id, responsible: "SegFire", nextDueAt: day(12), lastDoneAt: day(-168), checklist: ["Pressão", "Lacre", "Validade", "Sinalização"] },
    { condoId: condoA.id, assetId: assetRows[3].id, title: "Preventiva do portão automatizado", frequencyDays: 90, vendorId: vendorRows[2].id, responsible: "Portec", nextDueAt: day(-6), lastDoneAt: day(-96), checklist: ["Motor", "Sensores", "Cremalheira"] },
    { condoId: condoA.id, assetId: assetRows[5].id, title: "Limpeza e conferência das câmeras", frequencyDays: 45, responsible: "Zelador", nextDueAt: day(9), lastDoneAt: day(-36), checklist: ["Foco", "Gravação 30 dias", "Nobreak"] },
  ]);

  await db.insert(maintenanceOrders).values([
    { condoId: condoA.id, assetId: assetRows[0].id, kind: "preventiva", title: "Preventiva mensal elevador social", scheduledFor: day(3), status: "programada", vendorId: vendorRows[0].id, technician: "Sandro Melo", costCents: 189000 },
    { condoId: condoA.id, assetId: assetRows[3].id, kind: "corretiva", title: "Troca do motor do portão social", description: "Motor apresenta ruído e falha intermitente.", scheduledFor: day(1), status: "em_andamento", vendorId: vendorRows[2].id, technician: "Everton Luz", costCents: 265000 },
    { condoId: condoA.id, assetId: assetRows[2].id, kind: "corretiva", title: "Reparo de vazamento na bomba 2", scheduledFor: day(-2), completedAt: day(-1), status: "concluida", vendorId: vendorRows[1].id, technician: "Márcia Reis", costCents: 82000, report: "Substituída vedação e reapertados flanges." },
    { condoId: condoA.id, assetId: assetRows[1].id, kind: "corretiva", title: "Nivelamento do elevador de serviço", scheduledFor: day(-20), completedAt: day(-19), status: "concluida", vendorId: vendorRows[0].id, costCents: 45000, report: "Ajuste eletrônico realizado." },
    { condoId: condoA.id, assetId: assetRows[4].id, kind: "preventiva", title: "Inspeção semestral de extintores", scheduledFor: day(12), status: "programada", vendorId: vendorRows[3].id, costCents: 420000 },
  ]);

  /* ---------------------------------------------------------- assembleia */
  const [assembly] = await db
    .insert(assemblies)
    .values([
      { condoId: condoA.id, title: "Assembleia Geral Ordinária 2026", kind: "ordinaria", mode: "hibrida", noticeAt: at(-15, 9), firstCallAt: at(4, 19), secondCallAt: at(4, 19, 30), location: "Salão de festas", onlineLink: "https://meet.exemplo/age-2026", quorumFirst: 50, quorumSecond: 25, status: "convocada", createdById: sindica.id },
      { condoId: condoA.id, title: "AGE - Aprovação da obra da fachada", kind: "extraordinaria", mode: "presencial", noticeAt: at(-90, 9), firstCallAt: at(-60, 19), location: "Salão de festas", status: "encerrada", minutes: "Aprovada por 68% das frações a execução da obra de recuperação da fachada, com pagamento em 6 parcelas.", recordingUrl: "https://video.exemplo/age-fachada", createdById: sindica.id },
    ])
    .returning();

  const agendaRows = await db
    .insert(assemblyAgenda)
    .values([
      { assemblyId: assembly.id, position: 1, title: "Prestação de contas do exercício anterior", description: "Análise e votação das contas apresentadas pela síndica.", votingType: "unidade" },
      { assemblyId: assembly.id, position: 2, title: "Previsão orçamentária e taxa condominial", description: "Aprovação do orçamento anual e reajuste da taxa.", votingType: "fracao" },
      { assemblyId: assembly.id, position: 3, title: "Contratação de portaria remota noturna", description: "Proposta de projeto piloto por 6 meses.", votingType: "fracao" },
    ])
    .returning();

  await db.insert(assemblyAttendance).values([
    { assemblyId: assembly.id, unitId: A302.id, userId: moradorA.id, status: "confirmado" },
    { assemblyId: assembly.id, unitId: B101.id, userId: moradorB.id, status: "confirmado" },
    { assemblyId: assembly.id, unitId: unitsA[5].id, userId: conselheira.id, status: "confirmado", proxyForUnitId: unitsA[7].id, proxyDoc: "Procuração digitalizada - unidade 402" },
  ]);

  await db.insert(assemblyVotes).values([
    { assemblyId: assembly.id, agendaId: agendaRows[0].id, unitId: A302.id, userId: moradorA.id, choice: "sim", weight: "1.05" },
    { assemblyId: assembly.id, agendaId: agendaRows[0].id, unitId: B101.id, userId: moradorB.id, choice: "sim", weight: "0.95" },
    { assemblyId: assembly.id, agendaId: agendaRows[0].id, unitId: unitsA[5].id, userId: conselheira.id, choice: "abstencao", weight: "1.00" },
  ]);

  /* ----------------------------------------------------------- financeiro */
  const expenseCats = [
    ["Folha de pagamento", "pessoal", 1840000],
    ["Energia elétrica áreas comuns", "utilidades", 412000],
    ["Água e esgoto", "utilidades", 386000],
    ["Contrato de elevadores", "manutencao", 189000],
    ["Jardinagem", "manutencao", 96000],
    ["Material de limpeza", "suprimentos", 78000],
    ["Seguro predial", "administrativo", 145000],
    ["Taxa de administração", "administrativo", 210000],
  ] as const;

  const txValues: (typeof transactions.$inferInsert)[] = [];
  for (let m = 0; m < 3; m++) {
    for (const [description, category, amount] of expenseCats) {
      txValues.push({
        condoId: condoA.id,
        kind: "despesa",
        category,
        costCenter: category === "pessoal" ? "pessoal" : "administracao",
        description,
        amountCents: amount + m * 1500,
        dueDate: day(-m * 30 - 5),
        paidDate: m === 0 ? null : day(-m * 30 - 4),
        status: m === 0 ? "pendente" : "pago",
        createdById: sindica.id,
      });
    }
    txValues.push({
      condoId: condoA.id,
      kind: "receita",
      category: "taxa_condominial",
      description: "Arrecadação de taxas condominiais",
      amountCents: 4120000,
      dueDate: day(-m * 30 - 10),
      paidDate: day(-m * 30 - 10),
      status: "pago",
      createdById: sindica.id,
    });
    txValues.push({
      condoId: condoA.id,
      kind: "receita",
      category: "fundo_reserva",
      description: "Aporte no fundo de reserva",
      amountCents: 412000,
      dueDate: day(-m * 30 - 10),
      paidDate: day(-m * 30 - 10),
      status: "pago",
      reserveFund: true,
      createdById: sindica.id,
    });
  }
  txValues.push({ condoId: condoA.id, kind: "despesa", category: "manutencao", description: "Troca do motor do portão social", amountCents: 265000, dueDate: day(8), status: "pendente", vendorId: vendorRows[2].id, createdById: sindica.id });
  txValues.push({ condoId: condoA.id, kind: "despesa", category: "manutencao", description: "Reparo hidráulico bomba 2", amountCents: 82000, dueDate: day(-3), status: "atrasado", vendorId: vendorRows[1].id, createdById: sindica.id });
  await db.insert(transactions).values(txValues);

  await db.insert(budgets).values([
    { condoId: condoA.id, year: new Date().getFullYear(), category: "pessoal", plannedCents: 22000000 },
    { condoId: condoA.id, year: new Date().getFullYear(), category: "utilidades", plannedCents: 9600000 },
    { condoId: condoA.id, year: new Date().getFullYear(), category: "manutencao", plannedCents: 6000000 },
    { condoId: condoA.id, year: new Date().getFullYear(), category: "administrativo", plannedCents: 4200000 },
    { condoId: condoA.id, year: new Date().getFullYear(), category: "suprimentos", plannedCents: 1200000 },
  ]);

  const chargeValues: (typeof charges.$inferInsert)[] = [];
  unitsA.forEach((unit, index) => {
    for (let m = 0; m < 2; m++) {
      const overdue = index % 7 === 0 && m === 0;
      chargeValues.push({
        condoId: condoA.id,
        unitId: unit.id,
        reference: day(-m * 30).slice(0, 7),
        amountCents: 78000 + index * 350,
        dueDate: day(-m * 30 + 5),
        paidAt: overdue ? null : day(-m * 30 + 3),
        status: overdue ? "vencida" : "paga",
        method: overdue ? null : "pix",
      });
    }
  });
  await db.insert(charges).values(chargeValues);

  /* --------------------------------------------- achados / mudanças / etc */
  await db.insert(lostItems).values([
    { condoId: condoA.id, title: "Chaveiro com 3 chaves e controle", description: "Chaveiro de couro marrom.", foundLocation: "Hall do Bloco B", foundAt: day(-3), status: "guardado", discardAfter: day(87), registeredById: porteiro1.id },
    { condoId: condoA.id, title: "Óculos de sol infantil", foundLocation: "Playground", foundAt: day(-11), status: "guardado", discardAfter: day(79), registeredById: porteiro2.id },
    { condoId: condoA.id, title: "Guarda-chuva azul", foundLocation: "Portaria", foundAt: day(-25), status: "devolvido", claimedBy: "Ana Ribeiro", claimedUnitId: A302.id, claimedAt: at(-20, 19), registeredById: porteiro1.id },
    { condoId: condoA.id, title: "Garrafa térmica", foundLocation: "Quadra", foundAt: day(-120), status: "descartado", discardAfter: day(-30), registeredById: porteiro2.id },
  ]);

  await db.insert(moveRequests).values([
    { condoId: condoA.id, unitId: B101.id, requestedById: moradorB.id, kind: "mudanca", scheduledDate: day(3), startTime: "08:00", endTime: "12:00", elevator: "Serviço", carrierName: "Mudanças Rápidas ME", carrierDoc: "12.998.334/0001-22", vehiclePlate: "MUD-2A33", termAccepted: true, status: "aprovada", reviewedById: sindica.id },
    { condoId: condoA.id, unitId: A302.id, requestedById: moradorA.id, kind: "obra", scheduledDate: day(10), startTime: "09:00", endTime: "17:00", description: "Reforma de banheiro com troca de louças e revestimento.", artUrl: "art-123456.pdf", workers: "José Silva (RG 8.221.334), Marcos Lima (RG 9.112.443)", termAccepted: true, status: "pendente", deadlineAt: day(40) },
    { condoId: condoA.id, unitId: A201.id, requestedById: conselheira.id, kind: "entrega_grande", scheduledDate: day(-6), startTime: "14:00", endTime: "16:00", elevator: "Serviço", carrierName: "Móveis Bento", termAccepted: true, status: "concluida", reviewedById: sindica.id },
  ]);

  await db.insert(supportTickets).values([
    { condoId: condoA.id, userId: sindica.id, subject: "Como importar moradores em massa?", body: "Preciso atualizar a lista de moradores do Bloco C.", category: "duvida", status: "respondido", answer: "Use Implantação > Importar moradores. Baixe o modelo de planilha, preencha e valide antes de confirmar.", satisfaction: 5 },
    { condoId: condoA.id, userId: porteiro1.id, subject: "Leitor de QR Code não abre no tablet", body: "Ao tocar em validar, a câmera não inicia.", category: "incidente", priority: "alta", status: "em_atendimento" },
    { condoId: condoB.id, userId: sindicoB.id, subject: "Solicito treinamento da equipe de portaria", body: "Gostaríamos de agendar treinamento remoto.", category: "treinamento", status: "aberto" },
  ]);

  await db.insert(helpArticles).values([
    { slug: "primeiro-acesso", title: "Primeiro acesso e configuração da conta", category: "primeiros-passos", body: "Ao receber o convite, defina sua senha, confirme seus dados e escolha o condomínio ativo no topo da barra lateral. Moradores visualizam apenas a própria unidade.", tags: "login,conta,convite" },
    { slug: "registrar-visitante", title: "Como registrar e autorizar um visitante", category: "portaria", body: "O morador cria o convite em Visitantes, define validade e compartilha o QR Code. Na chegada, a portaria valida o código, confirma documento e registra a entrada. O morador recebe um aviso automático.", tags: "visitante,qrcode,portaria", videoUrl: "https://video.exemplo/visitantes" },
    { slug: "registrar-encomenda", title: "Registro e retirada de encomendas", category: "portaria", body: "A portaria registra a encomenda com transportadora, prateleira e foto opcional. O morador recebe o código de retirada. Na entrega, informe o código, o nome e o documento de quem retirou para gerar a confirmação digital.", tags: "encomenda,retirada" },
    { slug: "livro-ocorrencias", title: "Livro de ocorrências e passagem de turno", category: "portaria", body: "Cada turno registra ocorrências públicas, administrativas ou sigilosas. O registro não pode ser apagado: correções geram nova versão auditada. Ao encerrar o turno, informe pendências e o porteiro que assume.", tags: "ocorrencia,turno,auditoria" },
    { slug: "assembleia-hibrida", title: "Como conduzir uma assembleia híbrida", category: "assembleias", body: "Publique a convocação com pauta e quóruns, colete confirmações e procurações, faça o check-in das unidades e registre a votação por unidade ou fração ideal. Ao final, gere a ata e anexe a gravação.", tags: "assembleia,quorum,ata" },
    { slug: "importar-moradores", title: "Importação de moradores em massa", category: "implantacao", body: "Baixe o modelo CSV, preencha bloco, unidade, nome, e-mail e telefone. O sistema valida duplicidades e formatos antes de confirmar, e registra erros para correção.", tags: "importacao,csv,implantacao" },
  ]);

  await db.insert(importJobs).values([
    { condoId: condoA.id, kind: "moradores", fileName: "moradores-bloco-c.csv", total: 48, succeeded: 46, failed: 2, errors: ["Linha 12: e-mail inválido", "Linha 33: unidade C-999 inexistente"], createdById: sindica.id },
    { condoId: condoB.id, kind: "unidades", fileName: "unidades-torre.csv", total: 72, succeeded: 72, failed: 0, errors: [], createdById: sindicoB.id },
  ]);

  await db.insert(notifications).values([
    { condoId: condoA.id, userId: moradorA.id, title: "Visitante autorizado entrou", body: "Paulo Henrique Dias entrou às 14h e está no condomínio.", link: "/painel/visitantes" },
    { condoId: condoA.id, userId: moradorA.id, title: "Encomenda disponível", body: "Encomenda dos Correios registrada na portaria. Código de retirada disponível.", link: "/painel/encomendas" },
    { condoId: condoA.id, userId: sindica.id, title: "Contrato próximo do vencimento", body: "Manutenção mensal de elevadores vence em 35 dias.", link: "/painel/fornecedores" },
    { condoId: condoA.id, userId: sindica.id, title: "Ocorrência sigilosa registrada", body: "Tentativa de acesso não autorizado registrada pela portaria.", link: "/painel/livro" },
  ]);

  await db.insert(auditLogs).values([
    { condoId: condoA.id, userId: sindica.id, userName: "Marina Duarte", action: "publicar", entity: "comunicado", entityId: "1", summary: "Publicou comunicado sobre manutenção dos elevadores", origin: "painel", ip: "189.22.10.4" },
    { condoId: condoA.id, userId: porteiro1.id, userName: "Carlos Nogueira", action: "checkin", entity: "visita", entityId: "1", summary: "Registrou entrada de Paulo Henrique Dias", origin: "portaria", ip: "10.0.0.22" },
    { condoId: condoA.id, userId: porteiro2.id, userName: "Rita Bezerra", action: "criar", entity: "ocorrencia", entityId: "3", summary: "Registrou ocorrência sigilosa de tentativa de acesso", origin: "portaria", critical: true, ip: "10.0.0.23" },
    { condoId: condoA.id, userId: admin.id, userName: "Rafael Monteiro", action: "acesso_suporte", entity: "condominio", entityId: String(condoA.id), summary: "Acesso de suporte para diagnóstico de importação", origin: "suporte", critical: true, ip: "200.155.3.90" },
  ]);
}
