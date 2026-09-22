import { ehDeposito } from "../utils/estoque";
export const CARGOS = Object.freeze({
  master: "Master",
  alimentador: "Alimentador",
  nutricionista: "Nutricionista",
  diretor: "Diretor(a)",
  professor: "Professor(a)",
});
// Compatibilidade com contas já cadastradas. A regra do banco mantém a mesma equivalência.
export function cargoAtual(papel) {
  return { admin: "master", gerente: "nutricionista" }[papel] || papel;
}
const permissoes = {
  master: [
    "conteudo",
    "configuracao",
    "usuarios",
    "escolas",
    "merenda",
    "nutricao",
    "atendimentos",
    "alunos",
    "notas",
    "auditoria",
    "recuperacao",
    "parametros",
  ],
  alimentador: ["conteudo", "configuracao", "escolas", "atendimentos"],
  nutricionista: ["merenda", "nutricao"],
  diretor: ["merenda", "atendimentos", "alunos"],
  professor: ["notas"],
};
export function pode(perfil, acao) {
  return (
    !!perfil &&
    perfil.ativo !== false &&
    !!permissoes[cargoAtual(perfil.papel)]?.includes(acao)
  );
}
export function todasEscolas(perfil) {
  return (
    !!perfil &&
    perfil.ativo !== false &&
    ["master", "alimentador", "nutricionista"].includes(
      cargoAtual(perfil.papel),
    )
  );
}
export function escolaPermitida(perfil, id) {
  return (
    !!perfil &&
    perfil.ativo !== false &&
    (ehDeposito(id)
      ? ["master", "nutricionista"].includes(cargoAtual(perfil.papel))
      : todasEscolas(perfil) || (perfil.escolasVinculadas || []).includes(id))
  );
}
export function destinoAdministrativo(valor) {
  return typeof valor === "string" &&
    /^\/administracao(?:\/|\?|$)/.test(valor) &&
    !/[\\\r\n]/.test(valor)
    ? valor
    : "/administracao";
}
