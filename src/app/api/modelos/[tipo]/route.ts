export const dynamic = "force-dynamic";

const TEMPLATES: Record<string, string> = {
  unidades: [
    "bloco;unidade;andar;fracao;vagas",
    "Bloco A;101;1;0,95;1",
    "Bloco A;102;1;1,05;2",
    "Bloco B;201;2;1,00;1",
  ].join("\n"),
  moradores: [
    "bloco;unidade;nome;email;telefone",
    "Bloco A;302;Ana Ribeiro;ana@email.com;(41) 98888-7070",
    "Bloco B;101;Bruno Tavares;bruno@email.com;(41) 98777-6060",
  ].join("\n"),
};

export async function GET(_request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const content = TEMPLATES[tipo];
  if (!content) return new Response("Modelo não encontrado", { status: 404 });
  return new Response(`\ufeff${content}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="modelo-${tipo}.csv"`,
    },
  });
}
