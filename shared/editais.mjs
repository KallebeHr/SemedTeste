export const DECLARACAO =
  "Declaro que as informações são verdadeiras, que a prática foi efetivamente realizada e que conheço as regras do regulamento. Responsabilizo-me pela autoria e pela regularidade dos materiais apresentados, inclusive quanto à proteção da imagem e dos dados das crianças.";
export const SEMINARIO =
  "Seminário Municipal de Boas Práticas Pedagógicas na Alfabetização — Pedro II/PI — Edição 2026";
export const CAMPOS = [
  ["escola", "Escola", 1],
  ["titulo", "Título da prática", 1],
  ["categoria", "Categoria", 1],
  ["responsavel", "Responsável pela inscrição e apresentação", 1],
  ["funcao", "Função e turma ou etapa", 1],
  ["telefone", "Telefone", 1],
  ["email", "E-mail", 1],
  ["coautores", "Demais autores", 1, false],
  ["periodo", "Período de execução e público atendido", 1],
  ["diagnostico", "Diagnóstico e objetivos", 2],
  ["acoes", "Ações realizadas e recursos utilizados", 2],
  ["resultados", "Resultados e evidências de aprendizagem", 2],
  ["aplicacao", "Possibilidades de aplicação em outras escolas", 2],
  [
    "premio",
    "Responsável indicado para receber o prêmio, caso a prática seja vencedora.",
    3,
  ],
].map(([id, label, etapa, obrigatorio = true]) => ({
  id,
  label,
  etapa,
  obrigatorio,
  max: etapa === 2 ? 20000 : 2000,
}));
export const TIPOS_ANEXO = {
  relato: "Relato da experiência",
  evidencias: "Evidências de execução",
  representante: "Indicação do representante com ciência dos coautores",
  assinaturas: "Ficha assinada e ciências da gestão/coautores",
};
export function normalizar(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function configuracao(d = {}) {
  const c = {
    ativo: d.ativo === true,
    validado: d.validado === true,
    modelo: d.modelo || "anexo-ii-2026",
    nome: d.nome || SEMINARIO,
    inicio: d.inicio || "",
    fim: d.fim || "",
    categorias: d.categorias || [],
    obrigatorios: d.obrigatorios || [],
    maxArquivos: Number(d.maxArquivos || 10),
    maxMB: Number(d.maxMB || 2),
    privacidade: d.privacidade || "",
    instrucoes: d.instrucoes || "",
    camposExtras: d.camposExtras || [],
  };
  if (!["anexo-ii-2026", "personalizado"].includes(c.modelo))
    throw Error("Modelo inválido.");
  for (const k of ["nome", "privacidade", "instrucoes"])
    if (typeof c[k] !== "string" || c[k].length > 5000)
      throw Error("Texto de configuração inválido.");
  for (const k of ["inicio", "fim"])
    if (
      c[k] &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(c[k]) ||
        !Number.isFinite(Date.parse(c[k])))
    )
      throw Error("Data inválida.");
  if (c.inicio && c.fim && c.fim <= c.inicio)
    throw Error("Encerramento deve ocorrer depois da abertura.");
  if (
    !Number.isInteger(c.maxArquivos) ||
    c.maxArquivos < 1 ||
    c.maxArquivos > 20 ||
    !Number.isFinite(c.maxMB) ||
    c.maxMB < 0.1 ||
    c.maxMB > 2
  )
    throw Error(
      "Use até 20 arquivos, entre 0,1 e 2 MB cada (limite técnico do envio).",
    );
  if (
    !Array.isArray(c.categorias) ||
    c.categorias.length > 100 ||
    c.categorias.some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 200,
    )
  )
    throw Error("Categorias inválidas.");
  if (
    !Array.isArray(c.obrigatorios) ||
    c.obrigatorios.some((v) => !TIPOS_ANEXO[v])
  )
    throw Error("Documentos inválidos.");
  if (
    !Array.isArray(c.camposExtras) ||
    c.camposExtras.length > 15 ||
    c.camposExtras.some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 150,
    )
  )
    throw Error(
      "Use até 15 campos adicionais com títulos de até 150 caracteres.",
    );
  if (c.modelo === "personalizado" && !c.camposExtras.length)
    throw Error("Defina os campos do formulário personalizado.");
  if (c.ativo && (!c.validado || !c.privacidade.trim()))
    throw Error(
      "Valide as regras institucionais e informe o aviso de privacidade antes de abrir inscrições.",
    );
  return c;
}
export function campos(c) {
  return c.modelo === "personalizado"
    ? [
        {
          id: "responsavel",
          label: "Nome do responsável",
          etapa: 1,
          obrigatorio: true,
          max: 2000,
        },
        {
          id: "email",
          label: "E-mail",
          etapa: 1,
          obrigatorio: true,
          max: 2000,
        },
        ...c.camposExtras.map((label, i) => ({
          id: "extra" + i,
          label,
          etapa: 2,
          obrigatorio: true,
          max: 2000,
        })),
      ]
    : CAMPOS;
}
export function abertura(c, agora = Date.now()) {
  if (!c?.ativo) return "As inscrições estão desativadas.";
  if (c.inicio && agora < Date.parse(c.inicio))
    return "As inscrições ainda não abriram.";
  if (c.fim && agora >= Date.parse(c.fim)) return "Inscrições encerradas.";
  return "";
}
export function validarFicha(d, c, arquivos = []) {
  if (!d || typeof d !== "object" || Array.isArray(d))
    throw Error("Ficha inválida.");
  const dados = {};
  for (const f of campos(c)) {
    const v = d[f.id];
    if (
      typeof v !== "string" ||
      v.length > f.max ||
      (f.obrigatorio && !v.trim())
    )
      throw Error("Confira o campo " + f.label + ".");
    dados[f.id] = v.trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email))
    throw Error("Informe um e-mail válido.");
  if (c.modelo === "anexo-ii-2026") {
    if (!/^\d{10,13}$/.test(dados.telefone.replace(/\D/g, "")))
      throw Error("Informe telefone com DDD.");
    if (c.categorias.length && !c.categorias.includes(dados.categoria))
      throw Error("Categoria não prevista neste edital.");
  }
  if (d.aceite !== true) throw Error("É necessário aceitar a declaração.");
  for (const tipo of c.obrigatorios)
    if (
      !(tipo === "representante" && !dados.coautores) &&
      !arquivos.some((a) => a.tipo === tipo && a.estado === "pronto")
    )
      throw Error("Anexe: " + TIPOS_ANEXO[tipo] + ".");
  return { ...dados, aceite: true };
}
