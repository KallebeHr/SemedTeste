// A mesma normalização é aplicada pelas regras antes de aceitar o ID da nota.
export function componenteCanonico(valor) {
  return String(valor)
    .trim()
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[áàãâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòõôö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
export async function chaveNota(componente, ano, bimestre, professorUid) {
  const canonico = componenteCanonico(componente);
  if (!canonico || !Number.isInteger(ano) || !Number.isInteger(bimestre))
    throw new Error("Confira componente e período.");
  const bytes = new TextEncoder().encode(
    `${canonico}|${ano}|${bimestre}|${professorUid}`,
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
