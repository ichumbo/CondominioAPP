import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, isIconName, type IconName } from "@/components/icon";

/* Minimalist page title block. One optional primary action area. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-5 border-b border-[var(--color-line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-[var(--color-ink)] sm:text-[34px]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-4xl text-[15px] leading-7 text-[var(--color-muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
  accent,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <section className={`card-flat ${accent ? "border-l-4 border-l-[var(--color-primary)]" : ""} ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h2>
            {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={title ? "border-t border-[var(--color-line)] p-6" : "p-6"}>{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  zinc: "border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
  neutral: "border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
  primary: "border-[#E9D5FF] bg-[#FAF5FF] text-[#6D28D9]",
  purple: "border-[#E9D5FF] bg-[#FAF5FF] text-[#6D28D9]",
  blue: "border-[#D1E9FF] bg-[#EFF8FF] text-[#175CD3]",
  green: "border-[#cdebd9] bg-[var(--color-success-soft)] text-[var(--color-success)]",
  amber: "border-[#f0dfbc] bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  red: "border-[#f2caca] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES | string }) {
  return <span className={`chip ${TONES[tone] ?? TONES.neutral}`}>{children}</span>;
}

export function statusTone(status: string) {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (["autorizado", "aprovada", "aprovado", "entregue", "concluida", "concluido", "pago", "paga", "ativo", "vigente", "operacional", "retirado", "finalizado", "fechado", "devolvido", "presente"].includes(s))
    return "green";
  if (["pendente", "aguardando", "programada", "aberta", "aberto", "convocada", "em andamento", "guardado", "em análise", "convidado"].includes(s)) return "amber";
  if (["negado", "bloqueado", "vencido", "vencida", "atrasado", "cancelado", "rejeitada", "rejeitado", "inativo", "falha", "descartado"].includes(s)) return "red";
  if (["dentro", "em visita"].includes(s)) return "primary";
  return "neutral";
}

export function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

/* Dashboard indicator — green summary card used at the top of data screens. */
export function StatCard({
  label,
  value,
  icon,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="surface-hover flex h-full min-h-[84px] items-start gap-3 rounded-[10px] border border-[var(--color-primary-hover)] bg-[var(--color-primary)] p-3 text-[var(--color-ink)] shadow-[0_1px_2px_rgba(16,17,20,0.04)] sm:min-h-[94px] sm:p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-white/80 text-[var(--color-primary-dark)] sm:h-9 sm:w-9">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink)]">{label}</p>
        <p className="mt-1 text-[23px] font-semibold tabular-nums tracking-tight text-[var(--color-ink)] sm:text-[26px]">{value}</p>
        {hint ? <p className="mt-0.5 text-[12px] font-medium leading-5 text-[var(--color-ink)] sm:text-[13px]">{hint}</p> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/* Kept for backward compatibility with existing pages — renders a clean stat. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
  href?: string;
}) {
  const body = (
    <div className="surface-hover h-full min-h-[82px] rounded-[10px] border border-[var(--color-primary-hover)] bg-[var(--color-primary)] p-3 text-[var(--color-ink)] shadow-[0_1px_2px_rgba(16,17,20,0.04)] sm:min-h-[92px] sm:p-4">
      <div className="mb-2 h-1 w-7 rounded-full bg-[var(--color-primary-dark)] sm:mb-3 sm:w-8" />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink)]">{label}</p>
      <p className="mt-1 text-[23px] font-semibold tabular-nums tracking-tight text-[var(--color-ink)] sm:text-[26px]">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] font-medium leading-5 text-[var(--color-ink)] sm:text-[13px]">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[var(--color-muted)]">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({
  title,
  description,
  icon = "inbox",
  action,
}: {
  title: string;
  description?: string;
  icon?: IconName | string;
  action?: ReactNode;
}) {
  const known = typeof icon === "string" && isIconName(icon);
  return (
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--color-line-strong)] bg-white px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
        <Icon name={known ? (icon as IconName) : "inbox"} size={20} />
      </span>
      <p className="mt-4 text-base font-semibold text-[var(--color-ink)]">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-6 text-[var(--color-muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--color-line)]">
      <table className="table">{children}</table>
    </div>
  );
}

/* Collapsible section. Renders as a subtle link, content in a card. */
export function Panel({
  summary,
  children,
  tone = "ghost",
  open = false,
}: {
  summary: string;
  children: ReactNode;
  tone?: "primary" | "ghost" | "dark";
  open?: boolean;
}) {
  const primary = tone === "primary" || tone === "dark";
  const summaryCls = tone === "dark" ? "btn-dark" : primary ? "btn-primary" : "btn-ghost";
  const cleanSummary = summary.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return (
    <details className="group no-print" open={open}>
      <summary
        className={`list-none select-none ${summaryCls} w-full justify-between`}
      >
        <span className="flex items-center gap-2">
          <Icon name="plus" size={15} className="transition-transform group-open:rotate-45" />
          {cleanSummary}
        </span>
      </summary>
      <div className="panel-surface mt-3 p-5">{children}</div>
    </details>
  );
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
      <div className={`h-full ${tone ?? "bg-[var(--color-primary)]"}`} style={{ width: `${v}%` }} />
    </div>
  );
}

/* Subtle inline note. Neutral by default; warn/danger only when needed. */
export function InfoNote({
  children,
  tone = "neutral",
  icon = "sparkles",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "danger" | "amber" | "blue";
  icon?: IconName;
}) {
  const isWarn = tone === "warn" || tone === "amber";
  const isDanger = tone === "danger";
  const cls = isWarn
    ? "border-[#f0d8a8] bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
    : isDanger
      ? "border-[#efc9c9] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
      : "border-[var(--color-line)] bg-white text-[var(--color-muted)]";
  return (
    <div className={`flex items-start gap-3 rounded-[8px] border px-4 py-3.5 text-sm leading-relaxed ${cls}`}>
      <Icon name={icon} size={15} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/* Activity row used in the dashboard timeline. */
export function ActivityRow({
  icon,
  iconTone = "primary",
  title,
  meta,
  right,
}: {
  icon: IconName;
  iconTone?: "primary" | "green" | "amber" | "red" | "neutral";
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
}) {
  const toneCls = {
    primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]",
    green: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    amber: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
    red: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    neutral: "bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
  }[iconTone];
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ${toneCls}`}>
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">{title}</p>
        {meta ? <p className="truncate text-xs text-[var(--color-muted)]">{meta}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Drawer({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer-panel">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4 mb-6">
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-ink)]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

