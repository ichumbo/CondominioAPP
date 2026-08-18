import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const appSchema = pgSchema("condominio_app");

/* ---------------------------------------------------------------- CORE --- */

export const condominiums = appSchema.table("condominiums", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  cnpj: varchar("cnpj", { length: 32 }),
  address: text("address"),
  city: varchar("city", { length: 80 }),
  state: varchar("state", { length: 8 }),
  plan: varchar("plan", { length: 24 }).notNull().default("pro"),
  modules: jsonb("modules").$type<string[]>().default([]),
  brandColor: varchar("brand_color", { length: 16 }).default("#90B800"),
  publicPage: boolean("public_page").notNull().default(true),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
  storageUsedMb: integer("storage_used_mb").notNull().default(0),
  storageLimitMb: integer("storage_limit_mb").notNull().default(5120),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blocks = appSchema.table("blocks", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  floors: integer("floors").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const units = appSchema.table("units", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  blockId: integer("block_id"),
  number: varchar("number", { length: 24 }).notNull(),
  floor: integer("floor").default(0),
  fraction: varchar("fraction", { length: 16 }).default("1.00"),
  kind: varchar("kind", { length: 24 }).notNull().default("apartamento"),
  status: varchar("status", { length: 24 }).notNull().default("ocupada"),
  parkingSpots: integer("parking_spots").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = appSchema.table("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: varchar("phone", { length: 32 }),
  document: varchar("document", { length: 32 }),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default("ativo"),
  theme: varchar("theme", { length: 12 }).notNull().default("light"),
  firstAccessAt: timestamp("first_access_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = appSchema.table(
  "memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    condoId: integer("condo_id").notNull(),
    role: varchar("role", { length: 24 }).notNull().default("morador"),
    unitId: integer("unit_id"),
    relation: varchar("relation", { length: 24 }).default("proprietario"),
    status: varchar("status", { length: 20 }).notNull().default("ativo"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_user_condo_idx").on(t.userId, t.condoId)],
);

/* ------------------------------------------------------- COMUNICAÇÃO ---- */

export const announcements = appSchema.table("announcements", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 40 }).notNull().default("geral"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  audience: varchar("audience", { length: 20 }).notNull().default("todos"),
  blockId: integer("block_id"),
  pinned: boolean("pinned").notNull().default(false),
  showOnTv: boolean("show_on_tv").notNull().default(true),
  authorId: integer("author_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = appSchema.table("notifications", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  userId: integer("user_id").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body"),
  channel: varchar("channel", { length: 20 }).notNull().default("app"),
  link: varchar("link", { length: 200 }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------ CHAMADOS -- */

export const tickets = appSchema.table("tickets", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  unitId: integer("unit_id"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 40 }).notNull().default("manutencao"),
  priority: varchar("priority", { length: 20 }).notNull().default("media"),
  status: varchar("status", { length: 24 }).notNull().default("aberto"),
  aiPriority: varchar("ai_priority", { length: 20 }),
  aiSummary: text("ai_summary"),
  openedById: integer("opened_by_id"),
  assignedToId: integer("assigned_to_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  rating: integer("rating"),
  ratingComment: text("rating_comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketComments = appSchema.table("ticket_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  userId: integer("user_id"),
  body: text("body").notNull(),
  internal: boolean("internal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------ RESERVAS -- */

export const amenities = appSchema.table("amenities", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  capacity: integer("capacity").default(20),
  feeCents: integer("fee_cents").default(0),
  rules: text("rules"),
  openTime: varchar("open_time", { length: 8 }).default("08:00"),
  closeTime: varchar("close_time", { length: 8 }).default("22:00"),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  active: boolean("active").notNull().default(true),
});

export const reservations = appSchema.table("reservations", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  amenityId: integer("amenity_id").notNull(),
  unitId: integer("unit_id"),
  userId: integer("user_id"),
  date: varchar("date", { length: 12 }).notNull(),
  startTime: varchar("start_time", { length: 8 }).notNull(),
  endTime: varchar("end_time", { length: 8 }).notNull(),
  guests: integer("guests").default(0),
  status: varchar("status", { length: 24 }).notNull().default("pendente"),
  qrToken: varchar("qr_token", { length: 40 }),
  checkinAt: timestamp("checkin_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------- DOCUMENTOS -- */

export const documents = appSchema.table("documents", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 40 }).notNull().default("geral"),
  description: text("description"),
  fileName: varchar("file_name", { length: 200 }),
  fileUrl: text("file_url"),
  sizeKb: integer("size_kb").default(0),
  visibility: varchar("visibility", { length: 20 }).notNull().default("moradores"),
  version: varchar("version", { length: 12 }).default("1.0"),
  uploadedById: integer("uploaded_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------ ENQUETES -- */

export const polls = appSchema.table("polls", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  question: varchar("question", { length: 240 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("aberta"),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pollOptions = appSchema.table("poll_options", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
});

export const pollVotes = appSchema.table("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull(),
  optionId: integer("option_id").notNull(),
  userId: integer("user_id").notNull(),
  unitId: integer("unit_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------- PORTARIA - */

export const visitors = appSchema.table("visitors", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  document: varchar("document", { length: 40 }),
  docType: varchar("doc_type", { length: 20 }).default("RG"),
  phone: varchar("phone", { length: 32 }),
  photoUrl: text("photo_url"),
  kind: varchar("kind", { length: 24 }).notNull().default("visitante"),
  company: varchar("company", { length: 140 }),
  vehiclePlate: varchar("vehicle_plate", { length: 16 }),
  recurring: boolean("recurring").notNull().default(false),
  blocked: boolean("blocked").notNull().default(false),
  blockReason: text("block_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visits = appSchema.table("visits", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  visitorId: integer("visitor_id").notNull(),
  unitId: integer("unit_id"),
  hostUserId: integer("host_user_id"),
  purpose: varchar("purpose", { length: 160 }),
  status: varchar("status", { length: 24 }).notNull().default("aguardando"),
  qrToken: varchar("qr_token", { length: 48 }).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  authorizedById: integer("authorized_by_id"),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  deniedReason: text("denied_reason"),
  checkinAt: timestamp("checkin_at", { withTimezone: true }),
  checkinById: integer("checkin_by_id"),
  checkoutAt: timestamp("checkout_at", { withTimezone: true }),
  checkoutById: integer("checkout_by_id"),
  vehiclePlate: varchar("vehicle_plate", { length: 16 }),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const parcels = appSchema.table("parcels", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  unitId: integer("unit_id").notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  kind: varchar("kind", { length: 24 }).notNull().default("encomenda"),
  carrier: varchar("carrier", { length: 80 }),
  trackingCode: varchar("tracking_code", { length: 60 }),
  description: text("description"),
  photoUrl: text("photo_url"),
  shelf: varchar("shelf", { length: 40 }),
  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  pickupCode: varchar("pickup_code", { length: 12 }).notNull(),
  receivedById: integer("received_by_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  pickedUpBy: varchar("picked_up_by", { length: 140 }),
  pickedUpDocument: varchar("picked_up_document", { length: 40 }),
  signature: text("signature"),
  notes: text("notes"),
});

export const shifts = appSchema.table("shifts", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  userId: integer("user_id").notNull(),
  period: varchar("period", { length: 20 }).notNull().default("manha"),
  status: varchar("status", { length: 20 }).notNull().default("aberto"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  handoverToId: integer("handover_to_id"),
  handoverNotes: text("handover_notes"),
  pendingItems: text("pending_items"),
  checklist: jsonb("checklist").$type<Record<string, boolean>>().default({}),
});

export const occurrences = appSchema.table("occurrences", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  shiftId: integer("shift_id"),
  code: varchar("code", { length: 20 }).notNull(),
  visibility: varchar("visibility", { length: 20 }).notNull().default("publica"),
  category: varchar("category", { length: 40 }).notNull().default("seguranca"),
  severity: varchar("severity", { length: 20 }).notNull().default("baixa"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  actionsTaken: text("actions_taken"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  reportedById: integer("reported_by_id"),
  unitId: integer("unit_id"),
  attachments: jsonb("attachments").$type<string[]>().default([]),
  ackById: integer("ack_by_id"),
  ackAt: timestamp("ack_at", { withTimezone: true }),
  locked: boolean("locked").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------- MANUTENÇÃO -- */

export const assets = appSchema.table("assets", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  name: varchar("name", { length: 140 }).notNull(),
  category: varchar("category", { length: 40 }).notNull().default("equipamento"),
  location: varchar("location", { length: 120 }),
  brand: varchar("brand", { length: 80 }),
  serial: varchar("serial", { length: 80 }),
  installedAt: varchar("installed_at", { length: 12 }),
  status: varchar("status", { length: 24 }).notNull().default("operacional"),
  notes: text("notes"),
});

export const maintenancePlans = appSchema.table("maintenance_plans", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  assetId: integer("asset_id"),
  title: varchar("title", { length: 160 }).notNull(),
  frequencyDays: integer("frequency_days").notNull().default(30),
  checklist: jsonb("checklist").$type<string[]>().default([]),
  vendorId: integer("vendor_id"),
  responsible: varchar("responsible", { length: 120 }),
  nextDueAt: varchar("next_due_at", { length: 12 }),
  lastDoneAt: varchar("last_done_at", { length: 12 }),
  active: boolean("active").notNull().default(true),
});

export const maintenanceOrders = appSchema.table("maintenance_orders", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  assetId: integer("asset_id"),
  planId: integer("plan_id"),
  kind: varchar("kind", { length: 20 }).notNull().default("preventiva"),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description"),
  scheduledFor: varchar("scheduled_for", { length: 12 }),
  completedAt: varchar("completed_at", { length: 12 }),
  status: varchar("status", { length: 24 }).notNull().default("programada"),
  vendorId: integer("vendor_id"),
  technician: varchar("technician", { length: 120 }),
  costCents: integer("cost_cents").default(0),
  report: text("report"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------- FORNECEDORES E CONTRATOS --- */

export const vendors = appSchema.table("vendors", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  cnpj: varchar("cnpj", { length: 32 }),
  category: varchar("category", { length: 60 }).notNull().default("servicos"),
  contactName: varchar("contact_name", { length: 120 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 140 }),
  rating: integer("rating").default(0),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
});

export const contracts = appSchema.table("contracts", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  object: text("object"),
  startAt: varchar("start_at", { length: 12 }).notNull(),
  endAt: varchar("end_at", { length: 12 }).notNull(),
  noticeDays: integer("notice_days").notNull().default(30),
  valueCents: integer("value_cents").notNull().default(0),
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("mensal"),
  adjustmentIndex: varchar("adjustment_index", { length: 20 }).default("IGPM"),
  status: varchar("status", { length: 20 }).notNull().default("vigente"),
  documentUrl: text("document_url"),
});

/* --------------------------------------------------------- ASSEMBLEIAS -- */

export const assemblies = appSchema.table("assemblies", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  kind: varchar("kind", { length: 24 }).notNull().default("ordinaria"),
  mode: varchar("mode", { length: 20 }).notNull().default("hibrida"),
  noticeAt: timestamp("notice_at", { withTimezone: true }).defaultNow(),
  firstCallAt: timestamp("first_call_at", { withTimezone: true }).notNull(),
  secondCallAt: timestamp("second_call_at", { withTimezone: true }),
  location: varchar("location", { length: 200 }),
  onlineLink: varchar("online_link", { length: 240 }),
  quorumFirst: integer("quorum_first").notNull().default(50),
  quorumSecond: integer("quorum_second").notNull().default(25),
  status: varchar("status", { length: 24 }).notNull().default("agendada"),
  minutes: text("minutes"),
  recordingUrl: text("recording_url"),
  createdById: integer("created_by_id"),
  description: text("description"),
  startTime: varchar("start_time", { length: 8 }),
  endTime: varchar("end_time", { length: 8 }),
  guidelines: text("guidelines"),
  audienceScope: varchar("audience_scope", { length: 20 }).notNull().default("todos"),
  targetBlockId: integer("target_block_id"),
  targetUnitId: integer("target_unit_id"),
  responsibleId: integer("responsible_id"),
  responsibleName: varchar("responsible_name", { length: 140 }),
  confirmationDeadline: timestamp("confirmation_deadline", { withTimezone: true }),
  remindersConfig: jsonb("reminders_config").$type<string[]>().default(["7d", "3d", "1d", "0d"]),
  attachments: jsonb("attachments").$type<{ name: string; url: string; sizeKb?: number; uploadedAt?: string }[]>().default([]),
  noticeDocumentUrl: text("notice_document_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assemblyAgenda = appSchema.table("assembly_agenda", {
  id: serial("id").primaryKey(),
  assemblyId: integer("assembly_id").notNull(),
  position: integer("position").notNull().default(1),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  votingType: varchar("voting_type", { length: 20 }).notNull().default("unidade"),
  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  result: varchar("result", { length: 40 }),
  attachments: jsonb("attachments").$type<{ name: string; url: string }[]>().default([]),
  presenter: varchar("presenter", { length: 140 }),
  discussionResult: text("discussion_result"),
  decision: text("decision"),
  notes: text("notes"),
  requiresVoting: boolean("requires_voting").notNull().default(true),
  votingResult: text("voting_result"),
});

export const assemblyAttendance = appSchema.table("assembly_attendance", {
  id: serial("id").primaryKey(),
  assemblyId: integer("assembly_id").notNull(),
  unitId: integer("unit_id"),
  userId: integer("user_id"),
  status: varchar("status", { length: 20 }).notNull().default("confirmado"),
  proxyForUnitId: integer("proxy_for_unit_id"),
  proxyDoc: varchar("proxy_doc", { length: 200 }),
  proxyName: varchar("proxy_name", { length: 140 }),
  proxyCpf: varchar("proxy_cpf", { length: 32 }),
  history: jsonb("history").$type<{ timestamp: string; action: string; userName?: string; note?: string }[]>().default([]),
  checkinAt: timestamp("checkin_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assemblyVotes = appSchema.table("assembly_votes", {
  id: serial("id").primaryKey(),
  assemblyId: integer("assembly_id").notNull(),
  agendaId: integer("agenda_id").notNull(),
  unitId: integer("unit_id"),
  userId: integer("user_id"),
  choice: varchar("choice", { length: 20 }).notNull(),
  weight: varchar("weight", { length: 16 }).default("1.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assemblyMinutes = appSchema.table("assembly_minutes", {
  id: serial("id").primaryKey(),
  assemblyId: integer("assembly_id").notNull().unique(),
  condoId: integer("condo_id").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("rascunho"),
  currentVersion: varchar("current_version", { length: 12 }).notNull().default("1.0"),
  fileUrl: text("file_url"),
  fileName: varchar("file_name", { length: 200 }),
  fileSizeKb: integer("file_size_kb").default(0),
  fileFormat: varchar("file_format", { length: 20 }).default("pdf"),
  content: text("content"),
  summary: text("summary"),
  aiSuggestedSummary: text("ai_suggested_summary"),
  summaryStatus: varchar("summary_status", { length: 20 }).notNull().default("rascunho"),
  summaryApprovedById: integer("summary_approved_by_id"),
  summaryApprovedAt: timestamp("summary_approved_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedById: integer("published_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assemblyMinuteVersions = appSchema.table("assembly_minute_versions", {
  id: serial("id").primaryKey(),
  minutesId: integer("minutes_id").notNull(),
  assemblyId: integer("assembly_id").notNull(),
  version: varchar("version", { length: 12 }).notNull(),
  fileUrl: text("file_url"),
  fileName: varchar("file_name", { length: 200 }),
  fileSizeKb: integer("file_size_kb").default(0),
  content: text("content"),
  summary: text("summary"),
  changeReason: text("change_reason"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assemblyNotificationLogs = appSchema.table("assembly_notification_logs", {
  id: serial("id").primaryKey(),
  assemblyId: integer("assembly_id").notNull(),
  condoId: integer("condo_id").notNull(),
  triggerEvent: varchar("trigger_event", { length: 40 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull().default("app"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  recipientsCount: integer("recipients_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  readCount: integer("read_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  failureDetails: text("failure_details"),
  createdById: integer("created_by_id"),
});

export const assemblyMinuteDownloads = appSchema.table("assembly_minute_downloads", {
  id: serial("id").primaryKey(),
  assemblyId: integer("assembly_id").notNull(),
  minutesId: integer("minutes_id").notNull(),
  version: varchar("version", { length: 12 }).notNull(),
  userId: integer("user_id").notNull(),
  unitId: integer("unit_id"),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------------------------------------- FINANCEIRO - */

export const transactions = appSchema.table("transactions", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  kind: varchar("kind", { length: 12 }).notNull().default("despesa"),
  category: varchar("category", { length: 60 }).notNull().default("manutencao"),
  costCenter: varchar("cost_center", { length: 60 }).default("administracao"),
  description: varchar("description", { length: 200 }).notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  dueDate: varchar("due_date", { length: 12 }).notNull(),
  paidDate: varchar("paid_date", { length: 12 }),
  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  vendorId: integer("vendor_id"),
  reserveFund: boolean("reserve_fund").notNull().default(false),
  attachmentUrl: text("attachment_url"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgets = appSchema.table("budgets", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  year: integer("year").notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  plannedCents: integer("planned_cents").notNull().default(0),
});

export const charges = appSchema.table("charges", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  unitId: integer("unit_id").notNull(),
  reference: varchar("reference", { length: 12 }).notNull(),
  description: varchar("description", { length: 160 }).notNull().default("Taxa condominial"),
  amountCents: integer("amount_cents").notNull().default(0),
  dueDate: varchar("due_date", { length: 12 }).notNull(),
  paidAt: varchar("paid_at", { length: 12 }),
  status: varchar("status", { length: 20 }).notNull().default("aberta"),
  method: varchar("method", { length: 20 }),
});

/* ----------------------------------------------- ACHADOS / MUDANÇAS ----- */

export const lostItems = appSchema.table("lost_items", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  foundLocation: varchar("found_location", { length: 140 }),
  foundAt: varchar("found_at", { length: 12 }).notNull(),
  storedLocation: varchar("stored_location", { length: 120 }).default("Portaria"),
  status: varchar("status", { length: 20 }).notNull().default("guardado"),
  discardAfter: varchar("discard_after", { length: 12 }),
  claimedBy: varchar("claimed_by", { length: 140 }),
  claimedUnitId: integer("claimed_unit_id"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  registeredById: integer("registered_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moveRequests = appSchema.table("move_requests", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  unitId: integer("unit_id").notNull(),
  requestedById: integer("requested_by_id"),
  kind: varchar("kind", { length: 24 }).notNull().default("mudanca"),
  scheduledDate: varchar("scheduled_date", { length: 12 }).notNull(),
  startTime: varchar("start_time", { length: 8 }).notNull().default("08:00"),
  endTime: varchar("end_time", { length: 8 }).notNull().default("17:00"),
  elevator: varchar("elevator", { length: 40 }).default("Social"),
  carrierName: varchar("carrier_name", { length: 140 }),
  carrierDoc: varchar("carrier_doc", { length: 40 }),
  vehiclePlate: varchar("vehicle_plate", { length: 16 }),
  workers: text("workers"),
  description: text("description"),
  artUrl: text("art_url"),
  termAccepted: boolean("term_accepted").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default("pendente"),
  reviewedById: integer("reviewed_by_id"),
  reviewNotes: text("review_notes"),
  deadlineAt: varchar("deadline_at", { length: 12 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------------------------- SUPORTE / AUDITORIA ---- */

export const supportTickets = appSchema.table("support_tickets", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id"),
  userId: integer("user_id"),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 40 }).notNull().default("duvida"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  status: varchar("status", { length: 20 }).notNull().default("aberto"),
  answer: text("answer"),
  satisfaction: integer("satisfaction"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const helpArticles = appSchema.table("help_articles", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 60 }).notNull().default("primeiros-passos"),
  body: text("body").notNull(),
  tags: varchar("tags", { length: 200 }),
  videoUrl: varchar("video_url", { length: 240 }),
});

export const auditLogs = appSchema.table("audit_logs", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id"),
  userId: integer("user_id"),
  userName: varchar("user_name", { length: 140 }),
  action: varchar("action", { length: 60 }).notNull(),
  entity: varchar("entity", { length: 60 }).notNull(),
  entityId: varchar("entity_id", { length: 40 }),
  summary: varchar("summary", { length: 240 }),
  before: jsonb("before").$type<Record<string, unknown> | null>(),
  after: jsonb("after").$type<Record<string, unknown> | null>(),
  ip: varchar("ip", { length: 60 }),
  userAgent: varchar("user_agent", { length: 240 }),
  origin: varchar("origin", { length: 40 }).default("painel"),
  critical: boolean("critical").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importJobs = appSchema.table("import_jobs", {
  id: serial("id").primaryKey(),
  condoId: integer("condo_id").notNull(),
  kind: varchar("kind", { length: 30 }).notNull(),
  fileName: varchar("file_name", { length: 160 }),
  total: integer("total").notNull().default(0),
  succeeded: integer("succeeded").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  errors: jsonb("errors").$type<string[]>().default([]),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
