export const CAMPOS_ESCOLA = {
  nome: [
    "Nome da escola",
    160,
    ["nome", "escola", "unidade", "nome da escola"],
  ],
  inep: ["INEP", 8, ["inep", "codigo inep", "cod inep"]],
  endereco: ["Endereço", 300, ["endereco", "endereco publico"]],
  contato: ["Contato", 200, ["contato", "telefone", "contato publico"]],
  email: [
    "E-mail institucional",
    200,
    ["email", "e mail", "email institucional"],
  ],
  etapas: ["Etapas de ensino", 300, ["etapas", "etapas de ensino"]],
  horario: ["Horário", 200, ["horario", "horario de atendimento"]],
  sobre: ["Apresentação", 3000, ["sobre", "apresentacao"]],
  bairro: [
    "Bairro / localidade",
    200,
    ["bairro", "localidade", "bairro localidade"],
  ],
  zona: ["Zona (urbana/rural)", 20, ["zona", "localizacao"]],
  alunos: [
    "Quantidade de alunos",
    0,
    ["alunos", "quantidade de alunos", "total de alunos"],
  ],
  funcionarios: [
    "Quantidade de funcionários",
    0,
    ["funcionarios", "quantidade de funcionarios", "total de funcionarios"],
  ],
};
export const normalizar = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function lerCSV(texto) {
  texto = texto.replace(/^\uFEFF/, "");
  const primeira = texto.split(/\r?\n/)[0];
  const sep =
    (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length
      ? ";"
      : ",";
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (quoted) {
      if (c === '"' && texto[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed && c.trim())
        throw new Error("CSV inválido após fechamento de aspas.");
      cell += c;
    }
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v).trim()));
}
export function mapearCabecalhos(headers) {
  return Object.fromEntries(
    Object.entries(CAMPOS_ESCOLA).map(([k, [label, , aliases]]) => [
      k,
      headers.findIndex((h) =>
        [...aliases, normalizar(label)].includes(normalizar(h)),
      ),
    ]),
  );
}
export function validarEscola(entrada, parcial = false) {
  const d = {};
  for (const [k, [label, max]] of Object.entries(CAMPOS_ESCOLA)) {
    if (parcial && !(k in entrada)) continue;
    const v = entrada[k];
    if (k === "alunos" || k === "funcionarios") {
      if (v == null || String(v).trim() === "") {
        d[k] = null;
        continue;
      }
      if (!/^\d+$/.test(String(v).trim()) || Number(v) > 100000)
        throw new Error(`${label}: informe um inteiro de 0 a 100.000.`);
      d[k] = Number(v);
      continue;
    }
    d[k] = String(v ?? "").trim();
    if (d[k].length > max)
      throw new Error(`${label}: limite de ${max} caracteres.`);
    if (/^=/.test(d[k])) throw new Error(`${label}: use texto, não fórmulas.`);
  }
  if (!d.nome || d.nome.length < 3)
    throw new Error("Nome da escola: informe pelo menos 3 caracteres.");
  if (d.inep && !/^\d{8}$/.test(d.inep))
    throw new Error("INEP: informe 8 dígitos, preservando zeros à esquerda.");
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    throw new Error("E-mail institucional inválido.");
  if (d.zona) {
    d.zona = normalizar(d.zona);
    if (!["urbana", "rural"].includes(d.zona))
      throw new Error("Zona: use urbana ou rural.");
  }
  return d;
}
export function prepararLinhas(rows, mapa, existentes = []) {
  if (mapa.nome < 0) throw new Error("Associe a coluna Nome da escola.");
  if (rows.length > 500)
    throw new Error("Importe até 500 escolas por arquivo.");
  const seen = new Set();
  return rows.map((row, i) => {
    try {
      const raw = Object.fromEntries(
        Object.entries(mapa)
          .filter(([, n]) => Number(n) >= 0)
          .map(([k, n]) => [k, row[n] ?? ""]),
      );
      const dados = validarEscola(raw, true),
        keys = [
          "nome:" + normalizar(dados.nome),
          ...(dados.inep ? ["inep:" + dados.inep] : []),
        ];
      if (keys.some((k) => seen.has(k)))
        throw new Error("Escola duplicada nesta planilha (nome ou INEP).");
      keys.forEach((k) => seen.add(k));
      const matches = existentes.filter(
        (e) =>
          (dados.inep && e.inep === dados.inep) ||
          normalizar(e.nome) === normalizar(dados.nome),
      );
      if (matches.length > 1)
        throw new Error(
          "Mais de um cadastro corresponde ao nome/INEP. Revise manualmente.",
        );
      const existente = matches[0];
      if (existente?.inep && dados.inep && existente.inep !== dados.inep)
        throw new Error("Este nome já está cadastrado com outro INEP.");
      return { linha: i + 2, dados, existente, erro: "" };
    } catch (e) {
      return {
        linha: i + 2,
        dados: { nome: String(row[mapa.nome] ?? "") },
        erro: e.message,
      };
    }
  });
}
