import { randomBytes } from "node:crypto";

export function money(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateBR(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

export function dateTimeBR(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeBR(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function addDays(days: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysUntil(value: string | Date | null | undefined) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function token(size = 12) {
  return randomBytes(size).toString("base64url");
}

export function pickupCode() {
  return Math.floor(100000 + Math.random() * 899999).toString();
}

export function sequence(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

export function str(form: FormData, key: string, fallback = "") {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

export function num(form: FormData, key: string, fallback = 0) {
  const value = Number(String(form.get(key) ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
}

export function cents(form: FormData, key: string) {
  return Math.round(num(form, key) * 100);
}

export function bool(form: FormData, key: string) {
  const value = form.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function maybeDate(form: FormData, key: string): Date | null {
  const value = str(form, key);
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
