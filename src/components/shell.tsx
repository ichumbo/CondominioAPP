"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { NavItem } from "@/lib/rbac";

export type ShellNav = { primary: NavItem[]; more: NavItem[] };
export type ShellCondo = { id: number; name: string };

type QuickAction = { href: string; label: string; icon: IconName };

const QUICK_ACTIONS: QuickAction[] = [
  { href: "/painel/reservas", label: "Novo agendamento", icon: "calendar" },
  { href: "/painel/chamados", label: "Novo atendimento", icon: "wrench" },
  { href: "/painel/comunicados", label: "Criar comunicado", icon: "megaphone" },
  { href: "/painel/moradores", label: "Novo cliente", icon: "users" },
  { href: "/painel/visitantes", label: "Registrar visitante", icon: "user-check" },
];

function isActive(pathname: string, href: string) {
  if (href === "/painel") return pathname === "/painel";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItemLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-semibold transition-colors ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      <Icon name={item.icon} size={18} className="shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {collapsed ? (
        <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-[8px] border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-ink)] shadow-[0_8px_24px_rgba(16,17,20,0.08)] group-hover:block">
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

export function Shell({
  nav,
  condos,
  activeCondoId,
  userName,
  roleLabel,
  unitLabel,
  condoName,
  unread,
  switchAction,
  logout,
  children,
}: {
  nav: ShellNav;
  condos: ShellCondo[];
  activeCondoId: number;
  userName: string;
  roleLabel: string;
  unitLabel: string | null;
  condoName: string;
  unread: number;
  switchAction: (formData: FormData) => void;
  logout: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("gc-nav") === "collapsed";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const anyMoreActive = nav.more.some((i) => isActive(pathname, i.href));
  const [moreOpen, setMoreOpen] = useState(anyMoreActive);
  const moreExpanded = moreOpen || anyMoreActive;

  const pageTitle = useMemo(() => {
    const all = [...nav.primary, ...nav.more];
    const match = all.find((i) => isActive(pathname, i.href));
    return match?.label ?? "Painel";
  }, [pathname, nav]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("gc-nav", next ? "collapsed" : "expanded");
    } catch {}
  };

  const mainNav = nav.primary.filter((item) => item.href !== "/painel/configuracoes");
  const configNav = nav.primary.filter((item) => item.href === "/painel/configuracoes");

  const SidebarInner = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`flex min-h-12 items-center gap-3 px-1 ${collapsed ? "justify-center" : ""}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-ink)]">
          P+
        </span>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold leading-tight text-[var(--color-ink)]">Portaria+</p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--color-muted)]">{condoName}</p>
          </div>
        ) : null}
      </div>

      {/* Condo switcher */}
      {!collapsed ? (
        <form action={switchAction} className="mt-5">
          <select
            name="condoId"
            defaultValue={activeCondoId}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="input min-h-12 py-2 text-sm"
            aria-label="Selecionar condomínio"
          >
            {condos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </form>
      ) : null}

      {/* Nav */}
      <nav className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pb-5">
        <div>
          {!collapsed ? <p className="px-3 pb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-subtle)]">Módulos</p> : null}
          <div className="space-y-1">
            {mainNav.map((item) => (
              <NavItemLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
            ))}
          </div>
        </div>

        {nav.more.length > 0 ? (
          <div>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="mb-1.5 flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
              >
                <span className="flex-1 text-left">Funcionalidades</span>
                <Icon name="chevron-down" size={14} className={`transition-transform ${moreExpanded ? "rotate-180" : ""}`} />
              </button>
            ) : (
              <div className="my-2 border-t border-[var(--color-line)]" />
            )}
            <div className={`space-y-1 ${moreExpanded || collapsed ? "block" : "hidden"}`}>
              {nav.more.map((item) => (
                <NavItemLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        ) : null}

        {configNav.length > 0 ? (
          <div>
            {!collapsed ? <p className="px-3 pb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-subtle)]">Administração</p> : null}
            <div className="space-y-1">
              {configNav.map((item) => (
                <NavItemLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div className={`border-t border-[var(--color-line)] pt-4 ${collapsed ? "space-y-2" : "space-y-3"}`}>
        {!collapsed ? (
          <div className="rounded-[8px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3">
            <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-ink)]">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{userName}</p>
              <p className="truncate text-xs text-[var(--color-muted)]">{roleLabel}</p>
            </div>
            </div>
          </div>
        ) : null}
        <form action={logout}>
          <button
            type="submit"
            className={`flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)] ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Sair" : undefined}
          >
            <Icon name="logout" size={16} />
            {!collapsed ? "Sair" : null}
          </button>
        </form>
      </div>

      {/* Collapse toggle (desktop only) */}
      {!mobileOpen ? (
        <button
          type="button"
          onClick={toggleCollapse}
          className={`mt-2 hidden min-h-11 items-center gap-2 rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] lg:flex ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Icon name="panel" size={16} className={collapsed ? "rotate-180" : ""} />
          {!collapsed ? "Recolher menu" : null}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--color-line)] bg-white p-4 transition-[width] duration-200 lg:block ${
          collapsed ? "w-[84px]" : "w-[276px]"
        }`}
      >
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#1d1d24]/25" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[292px] overflow-y-auto border-r border-[var(--color-line)] bg-white p-4">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="mb-2 ml-auto flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)]"
              aria-label="Fechar menu"
            >
              <Icon name="x" size={18} />
            </button>
            {SidebarInner}
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className={`flex min-h-screen flex-col lg:pl-[276px] ${collapsed ? "lg:pl-[84px]" : ""}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-[var(--color-line)] bg-white px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] lg:hidden"
            aria-label="Abrir menu"
          >
            <Icon name="menu" size={20} />
          </button>

          <h2 className="hidden truncate text-lg font-semibold tracking-tight text-[var(--color-ink)] sm:block">{pageTitle}</h2>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Search (decorative global) */}
            <label className="hidden min-h-12 items-center gap-2 rounded-[8px] border border-[var(--color-line)] bg-white px-3.5 text-sm text-[var(--color-muted)] md:flex md:w-64 lg:w-80">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Buscar"
                className="w-full bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
              />
            </label>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--color-muted)] hover:bg-[var(--color-canvas)] md:hidden"
              aria-label="Buscar"
            >
              <Icon name="search" size={18} />
            </button>

            {/* Nova ação */}
            <details className="relative">
              <summary className="btn-primary btn-sm list-none">
                <Icon name="plus" size={16} />
                <span className="hidden sm:inline">Nova ação</span>
                <Icon name="chevron-down" size={14} />
              </summary>
              <div className="menu-surface absolute right-0 z-50 mt-2 w-56">
                {QUICK_ACTIONS.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                  className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                  >
                    <Icon name={a.icon} size={16} className="text-[var(--color-muted)]" />
                    {a.label}
                  </Link>
                ))}
              </div>
            </details>

            {/* Notifications */}
            <Link
              href="/painel/notificacoes"
              className="relative flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)]"
              aria-label="Notificações"
            >
              <Icon name="bell" size={18} />
              {unread > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[10px] font-bold text-[var(--color-ink)]">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>

            {/* Profile */}
            <details className="relative">
              <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-ink)]" aria-label="Perfil">
                {userName.slice(0, 1).toUpperCase()}
              </summary>
              <div className="menu-surface absolute right-0 z-50 mt-2 w-60">
                <div className="border-b border-[var(--color-line)] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{userName}</p>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {roleLabel}
                    {unitLabel ? ` · Unidade ${unitLabel}` : ""}
                  </p>
                </div>
                <Link href="/painel/notificacoes" className="flex min-h-11 items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]">
                  <Icon name="bell" size={16} className="text-[var(--color-muted)]" /> Notificações
                </Link>
                <Link href="/painel/ajuda" className="flex min-h-11 items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]">
                  <Icon name="help" size={16} className="text-[var(--color-muted)]" /> Central de ajuda
                </Link>
                <form action={logout}>
                  <button type="submit" className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-surface-muted)]">
                    <Icon name="logout" size={16} /> Sair
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 py-8 pb-28 sm:px-6 lg:px-10 lg:pb-10">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-[var(--color-line)] bg-white px-2 py-2.5 lg:hidden">
          {[
            nav.primary.find((item) => item.href === "/painel"),
            nav.primary.find((item) => item.href === "/painel/reservas"),
            { href: "/painel/reservas", label: "Novo", icon: "plus" as IconName },
            nav.primary.find((item) => item.href === "/painel/moradores") ?? nav.primary.find((item) => item.href === "/painel/chamados"),
            nav.primary.find((item) => item.href === "/painel/configuracoes") ?? { href: "/painel/ajuda", label: "Perfil", icon: "settings" as IconName },
          ].filter(Boolean).slice(0, 5).map((item) => {
            const navItem = item as QuickAction;
            const active = isActive(pathname, navItem.href) && navItem.label !== "Novo";
            return (
              <Link
                key={`${navItem.href}-${navItem.label}`}
                href={navItem.href}
                className={`flex min-h-13 flex-1 flex-col items-center justify-center gap-1 rounded-[8px] text-[10px] font-semibold ${
                  active ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]" : navItem.label === "Novo" ? "bg-[var(--color-primary)] text-[var(--color-ink)]" : "text-[var(--color-muted)]"
                }`}
              >
                <Icon name={navItem.icon} size={20} />
                {navItem.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
