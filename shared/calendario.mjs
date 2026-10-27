export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export const BASE = {
  dia_letivo: { rotulo: "Dia letivo", cor: "#FFFFFF" },
  indisponivel: { rotulo: "Sem atividade indicada", cor: "#D9D9D9" },
  fim_de_semana: { rotulo: "Fim de semana", cor: "#FFF2CC" },
};
export function datasAno(ano) {
  const a = [];
  for (
    let d = new Date(Date.UTC(ano, 0, 1));
    d.getUTCFullYear() === ano;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    a.push(d.toISOString().slice(0, 10));
  return a;
}
function exigir(ok, msg) {
  if (!ok) throw Error(msg);
}
export function validarCalendario(entrada) {
  const c = JSON.parse(JSON.stringify(entrada));
  exigir(
    Number.isInteger(c.ano) && c.ano >= 2000 && c.ano <= 2100,
    "Ano deve estar entre 2000 e 2100.",
  );
  exigir(
    new TextEncoder().encode(JSON.stringify(c)).length < 300000,
    "Calendário excede 300 KB.",
  );
  const datas = datasAno(c.ano),
    validas = new Set(datas);
  exigir(
    c.categorias &&
      typeof c.categorias === "object" &&
      !Array.isArray(c.categorias),
    "Informe as categorias.",
  );
  const cats = { ...BASE, ...c.categorias };
  for (const [id, v] of Object.entries(cats)) {
    exigir(
      /^[a-z][a-z0-9_]{0,49}$/.test(id) &&
        v &&
        typeof v.rotulo === "string" &&
        v.rotulo.length <= 120 &&
        /^#[\da-f]{6}$/i.test(v.cor),
      "Categoria ou cor inválida.",
    );
  }
  exigir(
    Array.isArray(c.eventos) && c.eventos.length <= 500,
    "Informe até 500 eventos.",
  );
  const ids = new Set(),
    chaves = new Set();
  for (const e of c.eventos) {
    exigir(
      typeof e.id === "string" && /^[\w-]{1,140}$/.test(e.id) && !ids.has(e.id),
      "ID de evento inválido ou duplicado.",
    );
    ids.add(e.id);
    exigir(
      typeof e.titulo === "string" &&
        e.titulo.trim().length > 0 &&
        e.titulo.length <= 250,
      "Título obrigatório (até 250 caracteres).",
    );
    exigir(
      validas.has(e.dataInicio) &&
        validas.has(e.dataFim) &&
        e.dataInicio <= e.dataFim,
      "Intervalo de evento inválido ou fora do ano.",
    );
    exigir(Object.hasOwn(cats, e.tipo), "Categoria do evento desconhecida.");
    exigir(
      (e.observacao ?? "").length <= 5000 && (e.fonte ?? "").length <= 1000,
      "Observação ou fonte muito longa.",
    );
    const chave = [
      e.dataInicio,
      e.dataFim,
      e.tipo,
      e.titulo
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    ].join("|");
    exigir(!chaves.has(chave), "Evento duplicado com outro ID.");
    chaves.add(chave);
    e.ano = c.ano;
    e.cor = cats[e.tipo].cor;
  }
  exigir(
    Array.isArray(c.dias) && c.dias.length === datas.length,
    `O ano exige exatamente ${datas.length} dias.`,
  );
  const vistos = new Set();
  for (const d of c.dias) {
    exigir(
      validas.has(d.data) && !vistos.has(d.data),
      "Dia inválido ou repetido.",
    );
    vistos.add(d.data);
    exigir(
      Object.hasOwn(cats, d.tipoVisual),
      "Classificação diária desconhecida.",
    );
    d.ano = c.ano;
    d.mes = Number(d.data.slice(5, 7));
    d.dia = Number(d.data.slice(8));
    d.cor = cats[d.tipoVisual].cor;
    exigir(
      Array.isArray(d.eventoIds) &&
        new Set(d.eventoIds).size === d.eventoIds.length,
      "Referências de eventos duplicadas.",
    );
    const esperados = c.eventos
      .filter((e) => e.dataInicio <= d.data && e.dataFim >= d.data)
      .map((e) => e.id)
      .sort();
    exigir(
      JSON.stringify([...d.eventoIds].sort()) === JSON.stringify(esperados),
      `Eventos inconsistentes em ${d.data}.`,
    );
  }
  if (c.totalDiasLetivos !== undefined)
    exigir(
      Number.isInteger(c.totalDiasLetivos) &&
        c.totalDiasLetivos >= 0 &&
        c.totalDiasLetivos <= datas.length,
      "Total oficial inválido.",
    );
  c.dias.sort((a, b) => a.data.localeCompare(b.data));
  return c;
}
export function atualizarVinculos(c) {
  return {
    ...c,
    dias: c.dias.map((d) => ({
      ...d,
      eventoIds: c.eventos
        .filter((e) => e.dataInicio <= d.data && e.dataFim >= d.data)
        .map((e) => e.id),
    })),
  };
}
export function novoCalendario(ano) {
  return {
    ano,
    categorias: { ...BASE },
    eventos: [],
    dias: datasAno(ano).map((data) => ({
      data,
      tipoVisual: "indisponivel",
      eventoIds: [],
    })),
    fonte: "Calendário em elaboração",
  };
}
