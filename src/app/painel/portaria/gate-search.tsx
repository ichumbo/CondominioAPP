"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";

type GateVisit = {
  id: number;
  name: string;
  document: string | null;
  unit: string;
  host: string | null;
  status: string;
  kind: string;
  company: string | null;
  plate: string | null;
  purpose: string | null;
  validUntil: string;
  checkinAt: string | null;
  qrToken: string;
};

const TONE: Record<string, string> = {
  dentro: "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]",
  autorizado: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  aguardando: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]  ",
};

export function GateSearch({
  visits,
  moveAction,
}: {
  visits: GateVisit[];
  moveAction: (formData: FormData) => void;
}) {
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState<"todos" | "autorizado" | "dentro" | "aguardando">("todos");

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return visits.filter((v) => {
      const matchTab = tab === "todos" || v.status === tab;
      if (!matchTab) return false;
      if (!q) return true;
      return [v.name, v.document, v.unit, v.host, v.plate, v.company, v.qrToken]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [visits, term, tab]);

  return (
    <section className="card-flat overflow-hidden">
      <header className="border-b border-[#dce9b3] bg-[var(--color-primary-soft)] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-[var(--color-ink)]">
            <Icon name="shield" size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">Controle de acesso</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
              Leia o QR Code do convite ou busque por nome, documento, placa ou unidade.
            </p>
          </div>
        </div>
        <label className="mt-4 flex min-h-12 items-center gap-3 rounded-[8px] border border-[#dce9b3] bg-white px-4 text-sm text-[var(--color-muted)]">
          <Icon name="search" size={16} />
          <input
            autoFocus
            className="w-full bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-subtle)]"
            placeholder="QR Code, nome, documento, placa ou unidade..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["todos", "autorizado", "dentro", "aguardando"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-[8px] border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? "border-[var(--color-primary-hover)] bg-[var(--color-primary)] text-[var(--color-ink)]"
                  : "border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:border-[#dce9b3]"
              }`}
            >
              {t} ({t === "todos" ? visits.length : visits.filter((v) => v.status === t).length})
            </button>
          ))}
        </div>
      </header>

      <ul className="space-y-3 p-4">
        {filtered.length === 0 ? (
          <li className="rounded-[10px] border border-dashed border-[var(--color-line-strong)] px-5 py-8 text-center text-sm text-[var(--color-muted)]">
            Nenhum registro encontrado. Cadastre a visita em <strong>Visitantes</strong>.
          </li>
        ) : null}
        {filtered.map((v) => (
          <li key={v.id} className="surface-hover flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--color-line)] bg-white px-4 py-3.5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
                <Icon name={v.status === "dentro" ? "check" : v.status === "aguardando" ? "clock" : "user-check"} size={16} />
              </span>
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[var(--color-ink)]">{v.name}</p>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${TONE[v.status] ?? "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"}`}>
                  {v.status}
                </span>
                <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-muted)]  ">
                  {v.kind}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {v.unit} {v.host ? `· anfitrião ${v.host}` : ""} {v.document ? `· doc ${v.document}` : ""}
                {v.plate ? ` · placa ${v.plate}` : ""}
              </p>
              <p className="text-xs text-[var(--color-subtle)]">
                {v.purpose ? `${v.purpose} · ` : ""}
                {v.checkinAt ? `entrada ${v.checkinAt}` : `válido até ${v.validUntil}`}
              </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {v.status === "autorizado" ? (
                <form action={moveAction}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="move" value="entrada" />
                  <button className="btn-success btn-sm"><Icon name="check" size={14} />Registrar entrada</button>
                </form>
              ) : null}
              {v.status === "dentro" ? (
                <form action={moveAction}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="move" value="saida" />
                  <button className="btn-dark btn-sm"><Icon name="logout" size={14} />Registrar saída</button>
                </form>
              ) : null}
              {v.status === "aguardando" ? (
                <span className="text-xs font-semibold text-[var(--color-warn)] ">aguardando morador</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
