// Esquema público v1. Índice 0 = dia 1; datas derivadas do mês, sem fuso local.
export const DIAS_SEMANA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"];
export const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];
export const NOTA_PADRAO =
  "OBS.: CARDÁPIO SUJEITO A MODIFICAÇÕES DE ACORDO COM A DISPONIBILIDADE E A ACEITAÇÃO DOS ALIMENTOS.";
export const MARCAS = "/IMG/cardapio/referencia-marcas.png";
export const RECORTES = {
  semed: [40, 17, 165, 116],
  pnae: [1103, 27, 191, 105],
};
export function mesValido(mes) {
  return typeof mes === "string" && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(mes);
}
export function diasNoMes(mes) {
  if (!mesValido(mes)) return 0;
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}
export function diaUtil(mes, dia) {
  if (dia < 1 || dia > diasNoMes(mes)) return false;
  const n = new Date(
    `${mes}-${String(dia).padStart(2, "0")}T12:00:00Z`,
  ).getUTCDay();
  return n >= 1 && n <= 5;
}
export const diaVazio = () => ({
  situacao: "letivo",
  primeiro: "",
  segundo: "",
  evento: "",
  observacao: "",
});
export function novoCardapio(mes) {
  if (!mesValido(mes))
    throw new Error("Selecione um mês válido entre 2000 e 2099.");
  return {
    versao: 1,
    mes,
    etapa: "ENS.INFANTIL",
    turno: "PARCIAL",
    observacoes: NOTA_PADRAO,
    dias: Array.from({ length: 31 }, diaVazio),
  };
}
export function semanasDoMes(mes) {
  if (!mesValido(mes)) return [];
  const [a, m] = mes.split("-").map(Number),
    result = [];
  for (let d = 1; d <= diasNoMes(mes); d++) {
    const weekday = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (!result.length || weekday === 1)
      result.push({ dias: Array(5).fill(null) });
    result.at(-1).dias[weekday - 1] = d;
  }
  return result.map((s, i) => ({
    ...s,
    indice: i,
    rotulo: s.dias
      .filter(Boolean)
      .map((d) => String(d).padStart(2, "0"))
      .filter((_, i, a) => i === 0 || i === a.length - 1)
      .join("-"),
  }));
}
function str(v, max, rotulo) {
  if (
    typeof v !== "string" ||
    v.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
  )
    throw new Error(
      `${rotulo}: confira o texto e o limite de ${max} caracteres.`,
    );
  return v.trim();
}
export function validarCardapio(g, { mes = g?.mes, publicar = false } = {}) {
  if (
    !g ||
    g.versao !== 1 ||
    !mesValido(g.mes) ||
    g.mes !== mes ||
    !Array.isArray(g.dias) ||
    g.dias.length !== 31
  )
    throw new Error(
      "A grade do cardápio não corresponde ao mês informado. Reabra o editor.",
    );
  const permitidos = ["versao", "mes", "etapa", "turno", "observacoes", "dias"];
  if (Object.keys(g).some((k) => !permitidos.includes(k)))
    throw new Error("Há campos não reconhecidos na grade do cardápio.");
  const result = {
    versao: 1,
    mes,
    etapa: str(g.etapa, 100, "Etapa de ensino"),
    turno: str(g.turno, 60, "Turno"),
    observacoes: str(g.observacoes, 1000, "Observações"),
    dias: [],
  };
  if (!result.etapa || !result.turno)
    throw new Error("Informe a etapa de ensino e o turno.");
  g.dias.forEach((entrada, i) => {
    const partes = typeof entrada === "string" ? entrada.split("\u001f") : null;
    if (partes && partes.length !== 5)
      throw new Error(`Formato inválido no dia ${i + 1}.`);
    const d = partes
      ? {
          situacao: partes[0],
          primeiro: partes[1],
          segundo: partes[2],
          evento: partes[3],
          observacao: partes[4],
        }
      : entrada;
    if (
      !d ||
      Object.keys(d).sort().join() !==
        ["evento", "observacao", "primeiro", "segundo", "situacao"]
          .sort()
          .join() ||
      !["letivo", "feriado", "sem_aula"].includes(d.situacao)
    )
      throw new Error(`Confira a situação do dia ${i + 1}.`);
    const value = {
      situacao: d.situacao,
      primeiro: str(d.primeiro, 300, "Primeiro lanche"),
      segundo: str(d.segundo, 500, "Segundo lanche"),
      evento: str(d.evento, 80, "Feriado ou suspensão"),
      observacao: str(d.observacao, 200, "Observação do dia"),
    };
    if (value.situacao !== "letivo" && (value.primeiro || value.segundo))
      throw new Error(
        `Dia ${i + 1}: feriados e dias sem aula não devem conter lanches.`,
      );
    if (
      publicar &&
      diaUtil(mes, i + 1) &&
      value.situacao === "letivo" &&
      (!value.primeiro || !value.segundo)
    )
      throw new Error(
        `Complete os dois lanches do dia ${String(i + 1).padStart(2, "0")} ou marque o dia como sem aula.`,
      );
    result.dias.push(value);
  });
  return result;
}
export function gradeValida(g, mes = g?.mes) {
  try {
    return validarCardapio(g, { mes });
  } catch {
    return null;
  }
}
export function tituloMes(mes) {
  if (!mesValido(mes)) return "";
  return `CARDÁPIO-${MESES[Number(mes.slice(5)) - 1]}-${mes.slice(0, 4)}`;
}
export function legendaDia(d) {
  return d.evento || (d.situacao === "feriado" ? "FERIADO" : "SEM AULA");
}
export function textoCardapio(grade) {
  const g = validarCardapio(grade),
    out = [`${g.etapa} - ${g.turno}`, tituloMes(g.mes)];
  for (const s of semanasDoMes(g.mes)) {
    out.push(`SEMANA ${s.rotulo}`);
    s.dias.forEach((dia, idx) => {
      if (!dia) return;
      const d = g.dias[dia - 1];
      out.push(
        `${DIAS_SEMANA[idx]} ${String(dia).padStart(2, "0")}/${g.mes.slice(5)}`,
        d.situacao === "letivo"
          ? `1º LANCHE: ${d.primeiro}\n2º LANCHE: ${d.segundo}`
          : legendaDia(d),
      );
      if (d.observacao) out.push(`Observação: ${d.observacao}`);
    });
  }
  if (g.observacoes) out.push(g.observacoes);
  return out.join("\n");
}
export function progressoCardapio(g) {
  const dias = g?.dias?.filter((_, i) => diaUtil(g.mes, i + 1)) || [];
  return {
    total: dias.length,
    completos: dias.filter(
      (d) => d.situacao !== "letivo" || (d.primeiro.trim() && d.segundo.trim()),
    ).length,
  };
}
export function copiarSemana(g, origem, destino) {
  const semanas = semanasDoMes(g.mes),
    clone = JSON.parse(JSON.stringify(g));
  semanas[destino]?.dias.forEach((dia, i) => {
    const de = semanas[origem]?.dias[i];
    if (dia && de)
      clone.dias[dia - 1] = JSON.parse(JSON.stringify(g.dias[de - 1]));
  });
  return clone;
}

// Serialização delimitada: permite validar todos os 31 dias no Firestore sem
// ultrapassar o limite de expressões. Os delimitadores são proibidos nas entradas.
export function serializarCardapio(grade) {
  const g = validarCardapio(grade);
  return {
    ...g,
    dias: g.dias.map((d) =>
      [d.situacao, d.primeiro, d.segundo, d.evento, d.observacao].join(
        "\u001f",
      ),
    ),
  };
}
