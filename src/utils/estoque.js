export const DEPOSITO_ID = "deposito-municipal";
export const DEPOSITO_NOME = "Depósito municipal da Educação";
export const ehDeposito = (id) => id === DEPOSITO_ID;
export const numeroEstoque = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
export const moedaEstoque = (n) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export function quantidadeValida(
  valor,
  campo = "Quantidade",
  aceitarZero = true,
) {
  const n = Number(valor);
  if (
    valor === "" ||
    valor == null ||
    !Number.isFinite(n) ||
    n < 0 ||
    n > 1e9 ||
    (!aceitarZero && n < 0.000001) ||
    Math.abs(n - Math.round(n * 1e6) / 1e6) > Number.EPSILON * Math.max(1, n)
  )
    throw new Error(
      `${campo}: informe uma quantidade ${aceitarZero ? "igual ou maior que zero" : "maior que zero"}, com até seis casas decimais e no máximo 1 bilhão.`,
    );
  return n;
}
export function saldoApos(atual, tipo, quantidade) {
  const a = quantidadeValida(atual, "Saldo"),
    q = quantidadeValida(quantidade, "Quantidade", false);
  if (!["entrada", "saida", "perda", "estorno"].includes(tipo))
    throw new Error("Tipo de movimentação inválido.");
  const saldo =
    Math.round((a + (["entrada", "estorno"].includes(tipo) ? q : -q)) * 1e6) /
    1e6;
  if (saldo < 0)
    throw new Error("Saldo insuficiente para a quantidade informada.");
  return quantidadeValida(saldo, "Saldo resultante");
}
export function ajusteConferencia(atual, contado) {
  const a = quantidadeValida(atual, "Saldo"),
    c = quantidadeValida(contado, "Quantidade contada"),
    d = Math.round((c - a) * 1e6) / 1e6;
  if (!d)
    throw new Error(
      "A contagem já corresponde ao saldo. Não é necessário registrar ajuste.",
    );
  return {
    tipo: d > 0 ? "entrada" : "saida",
    quantidade: Math.abs(d),
    quantidadeAnteriorConfirmada: a,
    quantidadeContada: c,
  };
}
export function estadoItem(item, dias = 15, agora = new Date()) {
  if (item.ativo === false) return { id: "arquivado", rotulo: "Arquivado" };
  if (Number(item.quantidadeAtual) <= 0)
    return { id: "zerado", rotulo: "Sem saldo" };
  if (item.validade) {
    const d = item.validade.toDate
      ? item.validade.toDate()
      : new Date(item.validade);
    const fim = new Date(d);
    fim.setHours(23, 59, 59, 999);
    if (Number.isFinite(fim.getTime())) {
      if (fim < agora) return { id: "vencido", rotulo: "Vencido" };
      if (fim - agora <= Math.max(1, Number(dias) || 15) * 86400000)
        return { id: "vencendo", rotulo: "Validade próxima" };
    }
  }
  if (Number(item.quantidadeAtual) <= Number(item.quantidadeMinima))
    return { id: "baixo", rotulo: "Abaixo ou no mínimo" };
  return { id: "regular", rotulo: "Em estoque" };
}
export function resumoEstoque(itens, dias = 15) {
  const a = itens.filter((i) => i.ativo !== false);
  return {
    ativos: a.length,
    zerados: a.filter((i) => Number(i.quantidadeAtual) <= 0).length,
    baixos: a.filter(
      (i) => Number(i.quantidadeAtual) <= Number(i.quantidadeMinima),
    ).length,
    vencidos: a.filter((i) => estadoItem(i, dias).id === "vencido").length,
    valor: a.reduce(
      (s, i) =>
        s + Number(i.quantidadeAtual || 0) * Number(i.precoUnitario || 0),
      0,
    ),
  };
}
