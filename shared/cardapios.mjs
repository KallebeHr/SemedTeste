// Vínculos por IDs, com leitura do formato individual anterior.
export function idsEscolas(c) {
  return [
    ...new Set(
      Array.isArray(c.escolaIds) ? c.escolaIds : c.escolaId ? [c.escolaId] : [],
    ),
  ];
}
export const chaveFaixa = (c) =>
  [
    c.numero,
    c.etapa || c.gradeCardapio?.etapa || c.categoria || "",
    c.turno || c.gradeCardapio?.turno || "",
  ]
    .map((v) =>
      String(v)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase(),
    )
    .join("|");
export function conflitosCardapio(c, publicados) {
  return publicados.filter(
    (p) =>
      p.id !== c.id &&
      chaveFaixa(p) === chaveFaixa(c) &&
      idsEscolas(p).some((id) => idsEscolas(c).includes(id)),
  );
}
export function filtrarCardapios(lista, escolaId, mes, etapa = "", turno = "") {
  if (!escolaId) return [];
  return lista.filter(
    (c) =>
      c.tipo === "cardapio" &&
      idsEscolas(c).includes(escolaId) &&
      c.numero === mes &&
      (!etapa ||
        (c.etapa || c.gradeCardapio?.etapa || c.categoria) === etapa) &&
      (!turno || (c.turno || c.gradeCardapio?.turno) === turno),
  );
}
export const ESCOLAS_EXEMPLO = [
  "E. M. Vovó Inácia",
  "E. de E. Infantil Maria de Lurdes Viana dos Santos",
];
export function conferirExemplo(escolas) {
  return ESCOLAS_EXEMPLO.map((nome) => ({
    nome,
    registros: escolas.filter((e) => e.nome === nome),
  }));
}
