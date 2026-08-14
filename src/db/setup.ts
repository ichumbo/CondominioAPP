import "server-only";
import { pool } from "@/db";

const EXPECTED_TABLES = [
  "amenities",
  "announcements",
  "assemblies",
  "assembly_agenda",
  "assembly_attendance",
  "assembly_votes",
  "assets",
  "audit_logs",
  "blocks",
  "budgets",
  "charges",
  "condominiums",
  "contracts",
  "documents",
  "help_articles",
  "import_jobs",
  "lost_items",
  "maintenance_orders",
  "maintenance_plans",
  "memberships",
  "move_requests",
  "notifications",
  "occurrences",
  "parcels",
  "poll_options",
  "poll_votes",
  "polls",
  "reservations",
  "shifts",
  "support_tickets",
  "ticket_comments",
  "tickets",
  "transactions",
  "units",
  "users",
  "vendors",
  "visitors",
  "visits"
];

const SCHEMA_SQL = String.raw`
CREATE SCHEMA IF NOT EXISTS "condominio_app";

CREATE TABLE IF NOT EXISTS "condominio_app"."amenities" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"capacity" integer DEFAULT 20,
	"fee_cents" integer DEFAULT 0,
	"rules" text,
	"open_time" varchar(8) DEFAULT '08:00',
	"close_time" varchar(8) DEFAULT '22:00',
	"requires_approval" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(40) DEFAULT 'geral' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"audience" varchar(20) DEFAULT 'todos' NOT NULL,
	"block_id" integer,
	"pinned" boolean DEFAULT false NOT NULL,
	"show_on_tv" boolean DEFAULT true NOT NULL,
	"author_id" integer,
	"published_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."assemblies" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"kind" varchar(24) DEFAULT 'ordinaria' NOT NULL,
	"mode" varchar(20) DEFAULT 'hibrida' NOT NULL,
	"notice_at" timestamp with time zone DEFAULT now(),
	"first_call_at" timestamp with time zone NOT NULL,
	"second_call_at" timestamp with time zone,
	"location" varchar(200),
	"online_link" varchar(240),
	"quorum_first" integer DEFAULT 50 NOT NULL,
	"quorum_second" integer DEFAULT 25 NOT NULL,
	"status" varchar(24) DEFAULT 'convocada' NOT NULL,
	"minutes" text,
	"recording_url" text,
	"created_by_id" integer
);

CREATE TABLE IF NOT EXISTS "condominio_app"."assembly_agenda" (
	"id" serial PRIMARY KEY NOT NULL,
	"assembly_id" integer NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"voting_type" varchar(20) DEFAULT 'unidade' NOT NULL,
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"result" varchar(40)
);

CREATE TABLE IF NOT EXISTS "condominio_app"."assembly_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"assembly_id" integer NOT NULL,
	"unit_id" integer,
	"user_id" integer,
	"status" varchar(20) DEFAULT 'confirmado' NOT NULL,
	"proxy_for_unit_id" integer,
	"proxy_doc" varchar(200),
	"checkin_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "condominio_app"."assembly_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"assembly_id" integer NOT NULL,
	"agenda_id" integer NOT NULL,
	"unit_id" integer,
	"user_id" integer,
	"choice" varchar(20) NOT NULL,
	"weight" varchar(16) DEFAULT '1.00',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"name" varchar(140) NOT NULL,
	"category" varchar(40) DEFAULT 'equipamento' NOT NULL,
	"location" varchar(120),
	"brand" varchar(80),
	"serial" varchar(80),
	"installed_at" varchar(12),
	"status" varchar(24) DEFAULT 'operacional' NOT NULL,
	"notes" text
);

CREATE TABLE IF NOT EXISTS "condominio_app"."audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer,
	"user_id" integer,
	"user_name" varchar(140),
	"action" varchar(60) NOT NULL,
	"entity" varchar(60) NOT NULL,
	"entity_id" varchar(40),
	"summary" varchar(240),
	"before" jsonb,
	"after" jsonb,
	"ip" varchar(60),
	"user_agent" varchar(240),
	"origin" varchar(40) DEFAULT 'painel',
	"critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"name" varchar(60) NOT NULL,
	"floors" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"year" integer NOT NULL,
	"category" varchar(60) NOT NULL,
	"planned_cents" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"reference" varchar(12) NOT NULL,
	"description" varchar(160) DEFAULT 'Taxa condominial' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"due_date" varchar(12) NOT NULL,
	"paid_at" varchar(12),
	"status" varchar(20) DEFAULT 'aberta' NOT NULL,
	"method" varchar(20)
);

CREATE TABLE IF NOT EXISTS "condominio_app"."condominiums" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"cnpj" varchar(32),
	"address" text,
	"city" varchar(80),
	"state" varchar(8),
	"plan" varchar(24) DEFAULT 'pro' NOT NULL,
	"modules" jsonb DEFAULT '[]'::jsonb,
	"brand_color" varchar(16) DEFAULT '#90B800',
	"public_page" boolean DEFAULT true NOT NULL,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"onboarding_done" boolean DEFAULT false NOT NULL,
	"storage_used_mb" integer DEFAULT 0 NOT NULL,
	"storage_limit_mb" integer DEFAULT 5120 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condominiums_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "condominio_app"."contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"vendor_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"object" text,
	"start_at" varchar(12) NOT NULL,
	"end_at" varchar(12) NOT NULL,
	"notice_days" integer DEFAULT 30 NOT NULL,
	"value_cents" integer DEFAULT 0 NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'mensal' NOT NULL,
	"adjustment_index" varchar(20) DEFAULT 'IGPM',
	"status" varchar(20) DEFAULT 'vigente' NOT NULL,
	"document_url" text
);

CREATE TABLE IF NOT EXISTS "condominio_app"."documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(40) DEFAULT 'geral' NOT NULL,
	"description" text,
	"file_name" varchar(200),
	"file_url" text,
	"size_kb" integer DEFAULT 0,
	"visibility" varchar(20) DEFAULT 'moradores' NOT NULL,
	"version" varchar(12) DEFAULT '1.0',
	"uploaded_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."help_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(60) DEFAULT 'primeiros-passos' NOT NULL,
	"body" text NOT NULL,
	"tags" varchar(200),
	"video_url" varchar(240),
	CONSTRAINT "help_articles_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "condominio_app"."import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"kind" varchar(30) NOT NULL,
	"file_name" varchar(160),
	"total" integer DEFAULT 0 NOT NULL,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."lost_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"photo_url" text,
	"found_location" varchar(140),
	"found_at" varchar(12) NOT NULL,
	"stored_location" varchar(120) DEFAULT 'Portaria',
	"status" varchar(20) DEFAULT 'guardado' NOT NULL,
	"discard_after" varchar(12),
	"claimed_by" varchar(140),
	"claimed_unit_id" integer,
	"claimed_at" timestamp with time zone,
	"registered_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."maintenance_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"asset_id" integer,
	"plan_id" integer,
	"kind" varchar(20) DEFAULT 'preventiva' NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"scheduled_for" varchar(12),
	"completed_at" varchar(12),
	"status" varchar(24) DEFAULT 'programada' NOT NULL,
	"vendor_id" integer,
	"technician" varchar(120),
	"cost_cents" integer DEFAULT 0,
	"report" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."maintenance_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"asset_id" integer,
	"title" varchar(160) NOT NULL,
	"frequency_days" integer DEFAULT 30 NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb,
	"vendor_id" integer,
	"responsible" varchar(120),
	"next_due_at" varchar(12),
	"last_done_at" varchar(12),
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"condo_id" integer NOT NULL,
	"role" varchar(24) DEFAULT 'morador' NOT NULL,
	"unit_id" integer,
	"relation" varchar(24) DEFAULT 'proprietario',
	"status" varchar(20) DEFAULT 'ativo' NOT NULL,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."move_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"requested_by_id" integer,
	"kind" varchar(24) DEFAULT 'mudanca' NOT NULL,
	"scheduled_date" varchar(12) NOT NULL,
	"start_time" varchar(8) DEFAULT '08:00' NOT NULL,
	"end_time" varchar(8) DEFAULT '17:00' NOT NULL,
	"elevator" varchar(40) DEFAULT 'Social',
	"carrier_name" varchar(140),
	"carrier_doc" varchar(40),
	"vehicle_plate" varchar(16),
	"workers" text,
	"description" text,
	"art_url" text,
	"term_accepted" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"reviewed_by_id" integer,
	"review_notes" text,
	"deadline_at" varchar(12),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"body" text,
	"channel" varchar(20) DEFAULT 'app' NOT NULL,
	"link" varchar(200),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"shift_id" integer,
	"code" varchar(20) NOT NULL,
	"visibility" varchar(20) DEFAULT 'publica' NOT NULL,
	"category" varchar(40) DEFAULT 'seguranca' NOT NULL,
	"severity" varchar(20) DEFAULT 'baixa' NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"actions_taken" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_by_id" integer,
	"unit_id" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"ack_by_id" integer,
	"ack_at" timestamp with time zone,
	"locked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."parcels" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"code" varchar(20) NOT NULL,
	"kind" varchar(24) DEFAULT 'encomenda' NOT NULL,
	"carrier" varchar(80),
	"tracking_code" varchar(60),
	"description" text,
	"photo_url" text,
	"shelf" varchar(40),
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"pickup_code" varchar(12) NOT NULL,
	"received_by_id" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"picked_up_at" timestamp with time zone,
	"picked_up_by" varchar(140),
	"picked_up_document" varchar(40),
	"signature" text,
	"notes" text
);

CREATE TABLE IF NOT EXISTS "condominio_app"."poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"label" varchar(160) NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"unit_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"question" varchar(240) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'aberta' NOT NULL,
	"ends_at" timestamp with time zone,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"amenity_id" integer NOT NULL,
	"unit_id" integer,
	"user_id" integer,
	"date" varchar(12) NOT NULL,
	"start_time" varchar(8) NOT NULL,
	"end_time" varchar(8) NOT NULL,
	"guests" integer DEFAULT 0,
	"status" varchar(24) DEFAULT 'pendente' NOT NULL,
	"qr_token" varchar(40),
	"checkin_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"period" varchar(20) DEFAULT 'manha' NOT NULL,
	"status" varchar(20) DEFAULT 'aberto' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"handover_to_id" integer,
	"handover_notes" text,
	"pending_items" text,
	"checklist" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "condominio_app"."support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer,
	"user_id" integer,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(40) DEFAULT 'duvida' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"status" varchar(20) DEFAULT 'aberto' NOT NULL,
	"answer" text,
	"satisfaction" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."ticket_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"code" varchar(20) NOT NULL,
	"unit_id" integer,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(40) DEFAULT 'manutencao' NOT NULL,
	"priority" varchar(20) DEFAULT 'media' NOT NULL,
	"status" varchar(24) DEFAULT 'aberto' NOT NULL,
	"ai_priority" varchar(20),
	"ai_summary" text,
	"opened_by_id" integer,
	"assigned_to_id" integer,
	"due_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"rating" integer,
	"rating_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"kind" varchar(12) DEFAULT 'despesa' NOT NULL,
	"category" varchar(60) DEFAULT 'manutencao' NOT NULL,
	"cost_center" varchar(60) DEFAULT 'administracao',
	"description" varchar(200) NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"due_date" varchar(12) NOT NULL,
	"paid_date" varchar(12),
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"vendor_id" integer,
	"reserve_fund" boolean DEFAULT false NOT NULL,
	"attachment_url" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."units" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"block_id" integer,
	"number" varchar(24) NOT NULL,
	"floor" integer DEFAULT 0,
	"fraction" varchar(16) DEFAULT '1.00',
	"kind" varchar(24) DEFAULT 'apartamento' NOT NULL,
	"status" varchar(24) DEFAULT 'ocupada' NOT NULL,
	"parking_spots" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(140) NOT NULL,
	"email" varchar(160) NOT NULL,
	"password_hash" text NOT NULL,
	"phone" varchar(32),
	"document" varchar(32),
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'ativo' NOT NULL,
	"theme" varchar(12) DEFAULT 'light' NOT NULL,
	"first_access_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "condominio_app"."vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"cnpj" varchar(32),
	"category" varchar(60) DEFAULT 'servicos' NOT NULL,
	"contact_name" varchar(120),
	"phone" varchar(32),
	"email" varchar(140),
	"rating" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text
);

CREATE TABLE IF NOT EXISTS "condominio_app"."visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"document" varchar(40),
	"doc_type" varchar(20) DEFAULT 'RG',
	"phone" varchar(32),
	"photo_url" text,
	"kind" varchar(24) DEFAULT 'visitante' NOT NULL,
	"company" varchar(140),
	"vehicle_plate" varchar(16),
	"recurring" boolean DEFAULT false NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"block_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "condominio_app"."visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"condo_id" integer NOT NULL,
	"visitor_id" integer NOT NULL,
	"unit_id" integer,
	"host_user_id" integer,
	"purpose" varchar(160),
	"status" varchar(24) DEFAULT 'aguardando' NOT NULL,
	"qr_token" varchar(48) NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"authorized_by_id" integer,
	"authorized_at" timestamp with time zone,
	"denied_reason" text,
	"checkin_at" timestamp with time zone,
	"checkin_by_id" integer,
	"checkout_at" timestamp with time zone,
	"checkout_by_id" integer,
	"vehicle_plate" varchar(16),
	"notes" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "memberships_user_condo_idx" ON "condominio_app"."memberships" USING btree ("user_id","condo_id");
`;

let setup: Promise<void> | null = null;

export function ensureDatabase() {
  setup ??= setupDatabase();
  return setup;
}

async function setupDatabase() {
  const { rows } = await pool.query<{ count: number }>(
    `
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'condominio_app'
        and table_name = any($1::text[])
    `,
    [EXPECTED_TABLES],
  );

  if (Number(rows[0]?.count ?? 0) === EXPECTED_TABLES.length) return;

  for (const statement of SCHEMA_SQL.split(";")) {
    const sql = statement.trim();
    if (sql) await pool.query(sql + ";");
  }
}
