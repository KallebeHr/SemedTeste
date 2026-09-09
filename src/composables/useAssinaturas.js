// O nome do arquivo e a coleção legada são mantidos para preservar os registros anteriores.
// Novas confirmações usam nome e CPF: não capturam imagens nem acessam o Storage.
import { collection, doc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";
import { validarIdentificacao } from "../utils/identificacao";

export async function calcularHash(objeto) {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "Abra o sistema por HTTPS ou localhost para confirmar a identificação.",
    );
  const dados = new TextEncoder().encode(JSON.stringify(objeto));
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function useAssinaturas(escolaId) {
  const { exigirUsuario } = useAuth();
  async function prepararIdentificacao(dados, contexto, identificacaoId) {
    const usuario = exigirUsuario(escolaId);
    if (
      !["master", "admin", "nutricionista", "gerente", "diretor"].includes(
        usuario.papel,
      )
    )
      throw new Error("Sua conta não pode confirmar identificações.");
    const pessoa = validarIdentificacao(dados);
    if (
      !contexto?.documentoId ||
      !["vistoria", "movimentacao"].includes(contexto.documentoTipo)
    )
      throw new Error(
        "Não foi possível identificar a operação. Volte aos dados e tente novamente.",
      );
    const referencia = identificacaoId
      ? doc(db, "escolas", escolaId, "assinaturas", identificacaoId)
      : doc(collection(db, "escolas", escolaId, "assinaturas"));
    const documentoDados = contexto.documentoDados ?? {};
    const hashDocumento = await calcularHash(documentoDados);
    if (exigirUsuario(escolaId).uid !== usuario.uid)
      throw new Error("Sua sessão mudou. Entre novamente para continuar.");
    return {
      id: referencia.id,
      referencia,
      payload: {
        ...pessoa,
        metodo: "identificacao_cpf",
        versao: 2,
        cargoDocumento: contexto.cargoDocumento || "",
        documentoTipo: contexto.documentoTipo,
        documentoId: contexto.documentoId,
        hashDocumento,
        criadoPor: usuario.uid,
        dataHora: Timestamp.now(),
      },
    };
  }
  return { prepararIdentificacao, calcularHash };
}
