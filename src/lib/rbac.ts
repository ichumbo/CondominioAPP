import type { Role } from "@/lib/auth";

export type { Role };

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super administrador",
  sindico: "Síndico(a)",
  conselho: "Conselho",
  zelador: "Zelador(a)",
  porteiro: "Portaria",
  morador: "Morador(a)",
};

export const ALL_STAFF: Role[] = ["superadmin", "sindico", "conselho", "zelador"];
export const GATE: Role[] = ["superadmin", "sindico", "porteiro", "zelador"];
export const EVERYONE: Role[] = ["superadmin", "sindico", "conselho", "zelador", "porteiro", "morador"];

import type { IconName } from "@/components/icon";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  roles: Role[];
  primary?: boolean;
};

/* Primary navigation — core destinations, shown with icon + label. */
const PRIMARY_NAV: NavItem[] = [
  { href: "/painel", label: "Início", icon: "grid", roles: EVERYONE, primary: true },
  { href: "/painel/assembleias", label: "Assembleias", icon: "scale", roles: EVERYONE, primary: true },
  { href: "/painel/reservas", label: "Agenda", icon: "calendar", roles: EVERYONE, primary: true },
  { href: "/painel/chamados", label: "Atendimentos", icon: "wrench", roles: EVERYONE, primary: true },
  { href: "/painel/comunicados", label: "Comunicados", icon: "megaphone", roles: EVERYONE, primary: true },
  { href: "/painel/moradores", label: "Clientes", icon: "users", roles: ALL_STAFF, primary: true },
  { href: "/painel/financeiro", label: "Financeiro", icon: "wallet", roles: ["superadmin", "sindico", "conselho"], primary: true },
  { href: "/painel/portaria", label: "Portaria", icon: "shield", roles: GATE, primary: true },
  { href: "/painel/documentos", label: "Documentos", icon: "folder", roles: EVERYONE, primary: true },
  { href: "/painel/relatorios", label: "Relatórios", icon: "chart", roles: ["superadmin", "sindico", "conselho"], primary: true },
  { href: "/painel/configuracoes", label: "Configurações", icon: "settings", roles: ["superadmin", "sindico"], primary: true },
];

/* Secondary navigation — grouped under "Mais". */
const MORE_NAV: NavItem[] = [
  { href: "/painel/visitantes", label: "Visitantes", icon: "user-check", roles: EVERYONE },
  { href: "/painel/encomendas", label: "Encomendas", icon: "package", roles: EVERYONE },
  { href: "/painel/livro", label: "Livro de ocorrências", icon: "book", roles: [...GATE, "conselho"] },
  { href: "/painel/turnos", label: "Passagem de turno", icon: "refresh", roles: GATE },
  { href: "/painel/enquetes", label: "Enquetes", icon: "vote", roles: EVERYONE },
  { href: "/painel/achados", label: "Achados e perdidos", icon: "search", roles: EVERYONE },
  { href: "/painel/mudancas", label: "Mudanças e obras", icon: "truck", roles: EVERYONE },
  { href: "/painel/manutencao", label: "Manutenção", icon: "wrench", roles: [...ALL_STAFF, "porteiro"] },
  { href: "/painel/fornecedores", label: "Fornecedores", icon: "briefcase", roles: ALL_STAFF },
  { href: "/painel/auditoria", label: "Auditoria", icon: "lock", roles: ["superadmin", "sindico", "conselho"] },
  { href: "/painel/implantacao", label: "Implantação", icon: "sparkles", roles: ["superadmin", "sindico"] },
  { href: "/painel/adocao", label: "Painel do SaaS", icon: "trending", roles: ["superadmin"] },
  { href: "/painel/ajuda", label: "Central de ajuda", icon: "help", roles: EVERYONE },
];

export type NavGroup = { primary: NavItem[]; more: NavItem[] };

export function navFor(role: Role): NavGroup {
  return {
    primary: PRIMARY_NAV.filter((i) => i.roles.includes(role)),
    more: MORE_NAV.filter((i) => i.roles.includes(role)),
  };
}

/** Flat list used to resolve the page title in the header. */
export function allNavItems(role: Role): NavItem[] {
  const { primary, more } = navFor(role);
  return [...primary, ...more];
}

/** Mobile bottom-nav subset — the most used destinations. */
export function mobileNavItems(role: Role): NavItem[] {
  const allowed = ["grid", "wrench", "megaphone", "calendar", "shield"];
  return navFor(role).primary.filter((i) => allowed.includes(i.icon));
}

export function can(role: Role, roles: Role[]) {
  return roles.includes(role);
}
