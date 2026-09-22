export const normalizarProduto = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export const chaveProduto = (item) =>
  normalizarProduto(item.nome) + "|" + item.unidade;
export function validarProdutoCatalogo(item) {
  if (
    !item ||
    !/^[a-f0-9]{16}$/.test(item.id) ||
    typeof item.nome !== "string" ||
    !item.nome.trim() ||
    item.nome.length > 160 ||
    typeof item.categoria !== "string" ||
    !item.categoria.trim() ||
    item.categoria.length > 100 ||
    !["kg", "l", "un", "cx", "pct"].includes(item.unidade)
  )
    throw new Error(
      "Produto inválido no catálogo. Confira nome, categoria e unidade.",
    );
  return {
    id: item.id,
    nome: item.nome.trim(),
    categoria: item.categoria.trim(),
    unidade: item.unidade,
  };
}
export function produtoJaCadastrado(produto, itens) {
  return itens.some(
    (i) =>
      i.id === "cat-" + produto.id || chaveProduto(i) === chaveProduto(produto),
  );
}
