"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" className="btn-ghost btn-sm no-print" onClick={() => window.print()}>
      <Icon name="file" size={15} />
      {label}
    </button>
  );
}

export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          setDone(false);
        }
      }}
    >
      <Icon name={done ? "check" : "qr"} size={15} />
      {done ? "Copiado" : label}
    </button>
  );
}

export function BulkForm({
  action,
  ids,
  children,
  labels,
}: {
  action: (formData: FormData) => void;
  ids: { id: number; label: string }[];
  children?: React.ReactNode;
  labels: { title: string; submit: string };
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const allSelected = selected.length === ids.length && ids.length > 0;

  return (
    <form action={action} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{labels.title}</p>
        <button
          type="button"
          className="btn-link text-xs"
          onClick={() => setSelected(allSelected ? [] : ids.map((i) => i.id))}
        >
          {allSelected ? "Limpar" : "Selecionar todos"}
        </button>
      </div>
      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-[10px] border border-[var(--color-line)] p-2">
        {ids.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--color-canvas)]"
          >
            <input
              type="checkbox"
              name="ids"
              value={item.id}
              checked={selected.includes(item.id)}
              onChange={(e) =>
                setSelected((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)))
              }
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-[var(--color-ink)]">{item.label}</span>
          </label>
        ))}
        {ids.length === 0 ? <p className="px-2 py-3 text-xs text-[var(--color-muted)]">Nenhum registro disponível.</p> : null}
      </div>
      {children}
      <button className="btn-primary btn-sm w-full" disabled={selected.length === 0}>
        {labels.submit} ({selected.length})
      </button>
    </form>
  );
}

export function TabPills({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5 no-print">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={t.href}
          className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors ${
            active === t.key
              ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
              : "border border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
          }`}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}

/** A discreet confirm-before-delete wrapper using native confirm(). */
export function ConfirmButton({
  onConfirm,
  label = "Excluir",
  message = "Tem certeza que deseja excluir este registro?",
  className = "btn-link text-[var(--color-danger)]",
}: {
  onConfirm: () => void;
  label?: string;
  message?: string;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => {
      if (typeof window !== "undefined" && window.confirm(message)) onConfirm();
    }}>
      {label}
    </button>
  );
}
