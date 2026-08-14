"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/lib/actions/session";
import { Icon } from "@/components/icon";

type Demo = { email: string; label: string; desc: string };

export function LoginForm({ demos }: { demos: Demo[] }) {
  const [email, setEmail] = useState(demos[0]?.email ?? "");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [error, formAction, pending] = useActionState(loginAction, null);

  function fillDemo() {
    const demo = demos[0];
    if (!demo) return;
    setEmail(demo.email);
    setPassword("demo1234");
  }

  return (
    <>
      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
            E-mail <span className="text-[var(--color-primary-dark)]">*</span>
          </span>
          <span className="flex min-h-[50px] items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-white px-4 text-[var(--color-muted)] transition-colors focus-within:border-[var(--color-primary-dark)] focus-within:ring-2 focus-within:ring-[var(--color-primary-soft)]">
            <Icon name="mail" size={18} />
            <input
              name="email"
              type="email"
              className="w-full bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-subtle)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
            Senha <span className="text-[var(--color-primary-dark)]">*</span>
          </span>
          <span className="flex min-h-[50px] items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-white px-4 text-[var(--color-muted)] transition-colors focus-within:border-[var(--color-primary-dark)] focus-within:ring-2 focus-within:ring-[var(--color-primary-soft)]">
            <Icon name="lock" size={18} />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              className="w-full bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-subtle)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <Icon name={showPassword ? "lock" : "key"} size={16} />
            </button>
          </span>
        </label>
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-[var(--color-muted)]">
            <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded accent-[var(--color-primary)]" />
            Lembrar de mim
          </label>
          <a href="mailto:suporte@portariamais.com.br?subject=Recuperar%20senha" className="text-sm font-semibold text-[var(--color-primary-dark)] hover:underline">
            Esqueci a senha
          </a>
        </div>
        {error ? (
          <p className="rounded-[8px] border border-[#efc9c9] bg-[var(--color-danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary min-h-[54px] w-full text-base" disabled={pending}>
          {pending ? "Entrando..." : "Entrar na conta"}
          <Icon name="arrow-right" size={18} />
        </button>
      </form>

      <button
        type="button"
        onClick={fillDemo}
        className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-white px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[#dce9b3] hover:bg-[var(--color-primary-soft)]"
      >
        <Icon name="user-check" size={18} className="text-[var(--color-primary-dark)]" />
        Usar demonstração
      </button>

      <p className="mt-3 text-center text-xs text-[var(--color-subtle)]">Senha demo: demo1234</p>
    </>
  );
}
