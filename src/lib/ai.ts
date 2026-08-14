/**
 * Assistente interno (heurístico e explicável).
 * A IA apenas SUGERE prioridade, categoria e resumo. Nenhuma decisão crítica
 * (aprovar acesso, excluir registro, enviar comunicado) é executada sem confirmação humana.
 */

const HIGH = ["incendio", "incêndio", "fumaça", "gás", "gas", "vazamento", "curto", "elevador preso", "preso", "invasao", "invasão", "furto", "roubo", "agressao", "agressão", "alagamento", "queda", "energia", "sem luz", "risco"];
const MEDIUM = ["infiltra", "goteira", "barulho", "ruído", "ruido", "portão", "portao", "câmera", "camera", "interfone", "bomba", "vaza", "quebrad", "danific"];
const CATEGORIES: [string, string[]][] = [
  ["seguranca", ["portão", "portao", "câmera", "camera", "invas", "furto", "roubo", "acesso", "alarme"]],
  ["manutencao", ["infiltra", "vazamento", "lâmpada", "lampada", "elevador", "bomba", "hidráulic", "hidraulic", "elétric", "eletric", "pintura"]],
  ["convivencia", ["barulho", "ruído", "ruido", "vizinho", "animal", "pet", "festa", "churrasq"]],
  ["limpeza", ["lixo", "limpeza", "sujeira", "dedetiz"]],
  ["administrativo", ["boleto", "taxa", "documento", "declaraç", "declarac", "chave", "cadastro"]],
];

export function suggestPriority(text: string): "alta" | "media" | "baixa" {
  const t = text.toLowerCase();
  if (HIGH.some((k) => t.includes(k))) return "alta";
  if (MEDIUM.some((k) => t.includes(k))) return "media";
  return "baixa";
}

export function suggestCategory(text: string) {
  const t = text.toLowerCase();
  for (const [category, keys] of CATEGORIES) {
    if (keys.some((k) => t.includes(k))) return category;
  }
  return "geral";
}

export function summarize(text: string, max = 220) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

export function assistNote(priority: string, category: string) {
  const reason =
    priority === "alta"
      ? "termos associados a risco imediato foram identificados"
      : priority === "media"
        ? "termos de falha operacional recorrente foram identificados"
        : "não foram identificados termos de risco";
  return `Sugestão automática: prioridade ${priority} e categoria ${category} — ${reason}. Revise antes de confirmar.`;
}

/** Busca simples em documentos/ocorrências com ranking por termos. */
export function rankByQuery<T extends Record<string, unknown>>(items: T[], fields: (keyof T)[], query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;
  return items
    .map((item) => {
      const haystack = fields.map((f) => String(item[f] ?? "")).join(" ").toLowerCase();
      const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
