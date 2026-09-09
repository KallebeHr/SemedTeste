import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "../firebase";
import { useAuth } from "../composables/useAuth";

// O histórico descreve o estado efetivo confirmado pelo servidor. As regras
// exigem a contrapartida e conferem os dois estados, não apenas esta função.
const indireto = (caminho) =>
  /^escolas\/[^/]+\/assinaturas\/[^/]+$/.test(caminho) ||
  /^limitesAtendimento\/[^/]+$/.test(caminho);
export async function chaveExclusao(caminho, antes) {
  if (antes._auditoria) return "del-" + antes._auditoria;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(caminho),
  );
  return (
    "del-" +
    Array.from(new Uint8Array(hash), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("")
  );
}
function autor() {
  const atual = auth.currentUser;
  if (!atual) throw new Error("Entre novamente antes de salvar.");
  const perfil = useAuth().usuario.value;
  return {
    usuarioId: atual.uid,
    usuarioNome:
      perfil?.uid === atual.uid
        ? perfil.nome
        : atual.displayName || atual.email || "",
    papelUsuario: perfil?.uid === atual.uid ? perfil.papel : "cidadao",
  };
}
export function runTransactionAuditada(db, executar, options) {
  const usuario = autor();
  return runTransaction(
    db,
    async (tx) => {
      const leituras = new Map(),
        escritas = new Map();
      let verificar = () => {};
      const segura = {
        definirVerificacao: (fn) => {
          verificar = fn;
        },
        get: async (r) => {
          verificar();
          if (!leituras.has(r.path)) leituras.set(r.path, await tx.get(r));
          return leituras.get(r.path);
        },
        set: (r, dados, opcoes) => registrar("set", r, dados, opcoes),
        update: (r, dados) => registrar("update", r, dados),
        delete: (r) => registrar("delete", r),
      };
      function registrar(tipo, referencia, dados, opcoes) {
        if (escritas.has(referencia.path))
          throw new Error(
            "O mesmo registro foi alterado duas vezes na operação.",
          );
        if (/^auditoria(?:Portal|Registros)?\//.test(referencia.path))
          throw new Error("O histórico é produzido pela transação auditada.");
        escritas.set(referencia.path, { tipo, referencia, dados, opcoes });
      }
      const manutencao = await segura.get(doc(db, "operacao", "estado"));
      if (manutencao.exists() && manutencao.data().bloqueado)
        throw new Error(
          "O sistema está em manutenção para backup ou recuperação. Aguarde a liberação antes de salvar.",
        );
      const resultado = await executar(segura);
      if (escritas.size > 8)
        throw new Error("Divida esta operação em grupos menores.");
      const prontas = [];
      for (const [caminho, w] of escritas) {
        if (indireto(caminho)) {
          prontas.push({ ...w, indireto: true });
          continue;
        }
        const snap = await segura.get(w.referencia);
        verificar();
        const antes = snap.exists() ? snap.data() : null;
        if (w.tipo === "delete" && !antes) continue;
        if (w.tipo === "update" && !antes)
          throw new Error("O registro não existe mais. Atualize a página.");
        const auditRef =
          w.tipo === "delete"
            ? doc(db, "auditoriaRegistros", await chaveExclusao(caminho, antes))
            : doc(collection(db, "auditoriaRegistros"));
        const depois =
          w.tipo === "delete"
            ? null
            : {
                ...(w.tipo === "update" || w.opcoes?.merge ? antes || {} : {}),
                ...w.dados,
                _auditoria: auditRef.id,
                _registradoEm: serverTimestamp(),
              };
        const partes = caminho.split("/");
        const escolaId = ["escolas", "escolasPublicas"].includes(partes[0])
          ? partes[1]
          : null;
        prontas.push({
          ...w,
          depois,
          auditRef,
          evento: {
            versaoEsquema: 1,
            caminho,
            alvo: w.referencia,
            colecao: partes.at(-2),
            documentoId: partes.at(-1),
            escolaId,
            dominio:
              /^escolas\/[^/]+\/(estoque|movimentacoes|vistorias|cardapios|fornecedores)\//.test(
                caminho,
              )
                ? "alimentacao"
                : "portal",
            acao:
              depois === null ? "delete" : antes === null ? "create" : "update",
            ...usuario,
            dadosAntes: antes,
            dadosDepois: depois,
            timestamp: serverTimestamp(),
          },
        });
      }
      if (auth.currentUser?.uid !== usuario.usuarioId)
        throw new Error("A sessão mudou. Entre novamente.");
      // Todas as leituras precedem a primeira escrita, inclusive as do histórico.
      verificar();
      for (const w of prontas) {
        verificar();
        if (w.indireto) {
          if (w.tipo === "delete") tx.delete(w.referencia);
          else if (w.tipo === "update") tx.update(w.referencia, w.dados);
          else if (w.opcoes) tx.set(w.referencia, w.dados, w.opcoes);
          else tx.set(w.referencia, w.dados);
        } else {
          if (w.depois === null) tx.delete(w.referencia);
          else tx.set(w.referencia, w.depois);
          tx.set(w.auditRef, w.evento);
        }
      }
      return resultado;
    },
    options,
  );
}
export function writeBatchAuditado(db) {
  const passos = [];
  return {
    set: (...args) => passos.push(["set", args]),
    update: (...args) => passos.push(["update", args]),
    delete: (...args) => passos.push(["delete", args]),
    commit: () =>
      runTransactionAuditada(db, (tx) => {
        for (const [fn, args] of passos) tx[fn](...args);
      }),
  };
}
