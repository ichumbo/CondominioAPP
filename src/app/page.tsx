import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

const MODULES: Array<{ icon: IconName; title: string; desc: string }> = [
  { icon: "shield", title: "Portaria digital", desc: "Painel simplificado do turno, validação de QR Code, entradas e saídas com registro auditado." },
  { icon: "user-check", title: "Visitantes e prestadores", desc: "Convite com validade, autorização do morador, lista de recorrentes e bloqueios de segurança." },
  { icon: "package", title: "Encomendas", desc: "Registro com foto, transportadora, código de retirada e confirmação digital de quem recebeu." },
  { icon: "book", title: "Livro de ocorrências", desc: "Registros públicos, administrativos e sigilosos, com ciência do síndico e histórico imutável." },
  { icon: "refresh", title: "Passagem de turno", desc: "Checklist de conferência, pendências e transferência formal entre porteiros." },
  { icon: "wrench", title: "Chamados", desc: "Triagem assistida, SLA, responsável, histórico e pesquisa de satisfação." },
  { icon: "calendar", title: "Reservas", desc: "Agenda sem conflito, taxas, aprovação e QR Code de check-in." },
  { icon: "scale", title: "Assembleias", desc: "Convocação, pauta, presença, procurações, quórum, votação por fração e ata." },
  { icon: "settings", title: "Manutenção preventiva", desc: "Equipamentos, planos, vencimentos, checklists, custos e falhas recorrentes." },
  { icon: "briefcase", title: "Fornecedores e contratos", desc: "Vigências, reajustes, alertas de renovação e avaliação de serviço." },
  { icon: "wallet", title: "Financeiro", desc: "Receitas, despesas, orçado x realizado, fundo de reserva e inadimplência." },
  { icon: "lock", title: "Auditoria completa", desc: "Quem fez, quando, de onde, valores antes e depois, inclusive acessos do suporte." },
];

const ROADMAP = [
  "Login, multi-condomínio e permissões",
  "Moradores, blocos e unidades",
  "Comunicados e notificações",
  "Chamados",
  "Reservas",
  "Documentos",
  "Enquetes",
  "Portaria, visitantes e encomendas",
  "Manutenções, fornecedores e contratos",
  "Assembleias",
  "Financeiro",
  "IA e integrações",
];

const PLANS = [
  { name: "Básico", price: "R$ 289", per: "/mês", items: ["Até 60 unidades", "Portaria, comunicados e chamados", "Documentos e enquetes", "Suporte por e-mail"] },
  { name: "Pro", price: "R$ 549", per: "/mês", featured: true, items: ["Até 200 unidades", "Tudo do Básico + assembleias", "Manutenção, fornecedores e contratos", "Mural para TV e PWA"] },
  { name: "Enterprise", price: "sob consulta", per: "", items: ["Unidades ilimitadas", "Financeiro completo e rateios", "White label para administradoras", "API, webhooks e SLA dedicado"] },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-ink)]">P+</span>
            Portaria+
          </span>
          <nav className="hidden gap-6 text-sm font-medium text-[var(--color-muted)] md:flex">
            <a href="#modulos" className="hover:text-[var(--color-primary)]">Módulos</a>
            <Link href="/agendar" className="hover:text-[var(--color-primary-dark)]">Agendar</Link>
            <a href="#planos" className="hover:text-[var(--color-primary)]">Planos</a>
            <a href="#implantacao" className="hover:text-[var(--color-primary)]">Implantação</a>
          </nav>
          <Link href="/login" className="btn-primary btn-sm">Entrar</Link>
        </div>
      </header>

      <section className="border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2">
          <div>
            <span className="chip border-[var(--color-line)] bg-white text-[var(--color-muted)]">
              Operação diária do condomínio
            </span>
            <h1 className="mt-5 max-w-2xl text-[42px] font-semibold leading-tight tracking-tight sm:text-[56px]">
              Portaria+ para agenda e gestão condominial.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-muted)]">
              Agenda de espaços, confirmações, visitantes com QR Code, encomendas com assinatura digital e atendimentos
              em uma operação leve para equipe e moradores.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary">Acessar demonstração</Link>
              <Link href="/agendar" className="btn-dark">Agendar online</Link>
              <a href="#portaria" className="btn-ghost">Ver agenda</a>
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-4 text-sm">
              {[
                ["100%", "Registros auditados"],
                ["6", "Perfis de acesso"],
                ["15+", "Módulos prontos"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-[8px] border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-4">
                  <dd className="text-2xl font-semibold">{value}</dd>
                  <dt className="mt-1 text-xs text-[var(--color-muted)]">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.pexels.com/photos/35877516/pexels-photo-35877516.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
            alt="Fachada de condomínio residencial moderno"
            className="h-80 w-full rounded-[8px] border border-[var(--color-line)] object-cover shadow-[0_10px_24px_rgba(16,17,20,0.06)]"
          />
        </div>
      </section>

      <section id="portaria" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-[28px] font-semibold tracking-tight">A experiência da portaria em primeiro lugar</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
          Visitantes, encomendas, ocorrências e turnos ficam em um fluxo único para a rotina real da equipe.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { title: "Chegada do visitante", steps: ["Morador cria convite com validade", "QR Code enviado ao visitante", "Portaria valida documento", "Entrada registrada e morador avisado"] },
            { title: "Chegada da encomenda", steps: ["Portaria registra com foto", "Morador recebe código", "Entrega confirmada com documento", "Assinatura digital arquivada"] },
            { title: "Troca de turno", steps: ["Checklist de itens críticos", "Ocorrências registradas", "Pendências transferidas", "Tudo com trilha de auditoria"] },
          ].map((flow) => (
            <div key={flow.title} className="card-flat p-6">
              <h3 className="font-semibold">{flow.title}</h3>
              <ol className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
                {flow.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[var(--color-primary-soft)] text-[11px] font-semibold text-[var(--color-primary-dark)]">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section id="modulos" className="border-y border-[var(--color-line)] bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-[28px] font-semibold tracking-tight">Módulos disponíveis</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.title} className="card-flat p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
                  <Icon name={m.icon} size={18} />
                </span>
                <h3 className="mt-3 font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="implantacao" className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[28px] font-semibold tracking-tight">Implantação guiada em 9 etapas</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Assistente com modelos de planilha, validação antes da importação e publicação controlada.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[var(--color-muted)]">
              {["Backups automáticos", "Ambientes separados", "Monitoramento de erros", "Política de retenção", "PWA instalável"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Icon name="check" size={15} className="text-[var(--color-success)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card-flat p-6">
            <h3 className="font-semibold">Ordem de entrega priorizada</h3>
            <ol className="mt-4 space-y-1.5 text-sm text-[var(--color-muted)]">
              {ROADMAP.map((item, index) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-[var(--color-surface-muted)] text-[11px] font-semibold text-[var(--color-ink)]">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="planos" className="border-t border-[var(--color-line)] bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-[28px] font-semibold tracking-tight">Planos</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">O módulo financeiro é opcional por plano, pois aumenta a complexidade da operação.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[8px] border bg-white p-6 ${
                  plan.featured ? "border-[var(--color-primary)]" : "border-[var(--color-line)]"
                }`}
              >
                {plan.featured ? (
                  <span className="chip mb-3 border-[#dce9b3] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">mais contratado</span>
                ) : null}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1 text-3xl font-semibold">
                  {plan.price}
                  <span className="text-sm font-normal text-[var(--color-muted)]">{plan.per}</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-[var(--color-muted)]">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Icon name="check" size={15} className="text-[var(--color-success)]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="btn-primary mt-5 w-full">Começar agora</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--color-line)] bg-white py-10 text-center text-sm text-[var(--color-muted)]">
        <p>Portaria+ · Plataforma de gestão condominial · Ambiente de demonstração</p>
        <div className="mt-3 flex justify-center gap-4 text-xs">
          <Link href="/login" className="link">Entrar</Link>
          <Link href="/status" className="link">Status</Link>
          <Link href="/mural" className="link">Mural da recepção</Link>
        </div>
      </footer>
    </div>
  );
}
