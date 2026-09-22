const PERGUNTAS = [
  "A escola recebe regularmente produtos da Agricultura Familiar?",
  "Os produtos chegam à escola em boas condições?",
  "Existe alguém responsável pelo recebimento e conferência dos produtos?",
  "Os produtos são devidamente utilizados nas preparações?",
  "A quantidade fornecida supre a necessidade da escola?",
  "São armazenados em local adequado?",
  "Recebeu orientações sobre o armazenamento?",
  "Apresentam boas condições de higiene?",
  "Presença de alimentos em condições inadequadas para o consumo?",
];
function avaliar(respostas) {
  const pendentes = PERGUNTAS.map((_, i) => i).filter(
    (i) => !["sim", "nao"].includes(respostas?.[i]?.resposta),
  );
  const atencao = PERGUNTAS.map((_, i) => i).filter(
    (i) => respostas?.[i]?.resposta === (i === 8 ? "sim" : "nao"),
  );
  return {
    pendentes,
    atencao,
    resultado: pendentes.length
      ? "incompleta"
      : atencao.length
        ? "com_pendencias"
        : "sem_pendencias",
  };
}
function cpfValido(v) {
  if (typeof v !== "string" || !/^\d{11}$/.test(v) || /^(\d)\1{10}$/.test(v))
    return false;
  for (let t = 9; t <= 10; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += +v[i] * (t + 1 - i);
    const r = soma % 11;
    if (+v[t] !== (r < 2 ? 0 : 11 - r)) return false;
  }
  return true;
}
function nomeValido(v) {
  return (
    typeof v === "string" &&
    v.length <= 160 &&
    /^[\p{L}\p{M}.’'-]*\p{L}[\p{L}\p{M}.’'-]*( [\p{L}\p{M}.’'-]*\p{L}[\p{L}\p{M}.’'-]*)+$/u.test(
      v,
    )
  );
}
function texto(v, max, obrigatorio = false) {
  if (typeof v !== "string" || v.length > max || (obrigatorio && !v.trim()))
    throw new Error("Confira os campos obrigatórios e o tamanho dos textos.");
  return v.trim();
}
function dataValida(v) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v || "") &&
    Number.isFinite(Date.parse(v + "T12:00:00Z")) &&
    new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v
  );
}
function validarVisita(d, hoje = new Date().toISOString().slice(0, 10)) {
  if (!d || d.revisado !== true)
    throw new Error("Confirme a revisão dos dados antes de salvar.");
  if (
    !dataValida(d.dataVisita) ||
    d.dataVisita > hoje ||
    d.dataVisita < "2000-01-01"
  )
    throw new Error("Informe uma data válida, sem ser futura.");
  if (!Array.isArray(d.respostas) || d.respostas.length !== 9)
    throw new Error("Responda as nove perguntas do protocolo.");
  const respostas = d.respostas.map((r) => ({
    resposta: r?.resposta,
    observacao: texto(r?.observacao, 2000),
  }));
  const avaliacao = avaliar(respostas);
  if (avaliacao.pendentes.length)
    throw new Error("Responda as nove perguntas com Sim ou Não.");
  const planoDeAcao = texto(d.planoDeAcao, 5000, !!avaliacao.atencao.length);
  for (const p of [d.responsavel, d.acompanhante])
    if (!nomeValido(p?.nome) || !cpfValido(p?.cpf))
      throw new Error("Confira nome completo e CPF das duas pessoas.");
  if (d.responsavel.cpf === d.acompanhante.cpf)
    throw new Error("Informe duas pessoas com CPFs diferentes.");
  const resumo = (p) => ({
    nome: p.nome,
    cpfMascarado: "***." + p.cpf.slice(3, 6) + "." + p.cpf.slice(6, 9) + "-**",
  });
  if (
    !Array.isArray(d.documentos) ||
    d.documentos.length > 10 ||
    new Set(d.documentos).size !== d.documentos.length ||
    d.documentos.some((id) => !/^[0-9a-f-]{36}$/.test(id))
  )
    throw new Error("Anexe até dez arquivos válidos.");
  return {
    versaoProtocolo: 1,
    dataVisita: d.dataVisita,
    lanche: texto(d.lanche, 500, true),
    respostas,
    planoDeAcao,
    responsavel: resumo(d.responsavel),
    acompanhante: resumo(d.acompanhante),
    documentos: d.documentos,
    resultado: avaliacao.resultado,
    pontosAtencao: avaliacao.atencao.map((i) => i + 1),
    revisado: true,
  };
}
// OCR produz sugestões, nunca uma confirmação. Campos vazios ou ambíguos permanecem vazios.
function extrairProtocolo(textoOCR) {
  const t = String(textoOCR || "").replace(/\r/g, "");
  const limpo = (v) =>
    String(v || "")
      .replace(/[_|]+/g, "")
      .trim();
  const escola = limpo(t.match(/ESCOLA\s*:\s*([^\n]*)/i)?.[1]);
  const lanche = limpo(t.match(/LANCHE\s+DO\s+DIA\s*:\s*([^\n]*)/i)?.[1]);
  const data = t.match(
    /DATA\s*:\s*(\d{2})\s*[/.-]\s*(\d{2})\s*[/.-]\s*(\d{4})/i,
  );
  const candidata = data ? `${data[3]}-${data[2]}-${data[1]}` : "";
  const respostas = PERGUNTAS.map((_, i) => {
    const re = new RegExp(
      "(?:^|\\n)\\s*" +
        (i + 1) +
        "[.)]\\s*([\\s\\S]*?)(?=\\n\\s*" +
        (i + 2) +
        "[.)]|$)",
      "i",
    );
    const bloco = t.match(re)?.[1] || "";
    const sim = /[([]\s*[xX✓✔]\s*[)\]]\s*SIM\b/i.test(bloco),
      nao = /[([]\s*[xX✓✔]\s*[)\]]\s*N[ÃA]O\b/i.test(bloco);
    return {
      resposta: sim !== nao ? (sim ? "sim" : "nao") : "",
      observacao: limpo(bloco.match(/OBS\s*:\s*([^\n]*)/i)?.[1]),
    };
  });
  return {
    escola,
    lanche,
    dataVisita: dataValida(candidata) ? candidata : "",
    respostas,
  };
}
export {
  PERGUNTAS,
  avaliar,
  cpfValido,
  nomeValido,
  validarVisita,
  extrairProtocolo,
};
