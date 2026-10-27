import { DEPOSITO_ID, DEPOSITO_NOME, ehDeposito } from "../utils/estoque";
import { runTransactionAuditada } from "../portal/auditoria";
import { writeBatchAuditado as writeBatch } from "../portal/auditoria";
import { ref } from "vue";
import { normalizar, idPorNome } from "../../shared/importacao-escolas.mjs";
import {
  collection,
  getDocsFromServer,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  documentId,
} from "firebase/firestore";
import { db } from "../firebase";

import { useAuth } from "./useAuth";

function mensagemErroConsulta(falha) {
  const codigo = String(falha?.code || "").replace(/^firestore\//, "");
  const mensagens = {
    "permission-denied":
      "O Firebase negou a leitura de escolas. Confira as regras do Firestore e o papel do seu usuário.",
    "failed-precondition":
      "A consulta não pôde ser concluída. Confira os índices do Firestore; o detalhe está no Console do navegador.",
    unavailable:
      "Não foi possível conectar ao Firebase. Verifique a conexão e tente novamente.",
    unauthenticated:
      "Sua sessão não foi reconhecida. Saia do painel e entre novamente.",
    "resource-exhausted":
      "O Firebase atingiu um limite de uso. Confira a cota do projeto.",
  };
  const mensagem =
    mensagens[codigo] ||
    "Não foi possível carregar as escolas. Consulte o detalhe no Console do navegador.";
  return codigo ? `${mensagem} (${codigo})` : mensagem;
}

export function useEscolas({ incluirDeposito = false } = {}) {
  const escolas = ref([]);
  const carregando = ref(false);
  const erro = ref("");
  const { usuario, ehGestao, exigirUsuario } = useAuth();
  let cancelar = [];
  let geracao = 0;

  function parar() {
    geracao += 1;
    cancelar.forEach((fn) => fn());
    cancelar = [];
    escolas.value = [];
    carregando.value = false;
  }

  function escutarEscolas() {
    parar();
    erro.value = "";
    if (!usuario.value) return;
    const consultas = [];
    if (ehGestao.value) {
      // Ordenação local: esta listagem usa apenas o índice simples de ativo.
      consultas.push(
        query(collection(db, "escolas"), where("ativo", "==", true)),
      );
    } else {
      const ids = [...new Set(usuario.value.escolasVinculadas)].filter(
        (id) => !ehDeposito(id),
      );
      for (let i = 0; i < ids.length; i += 10) {
        consultas.push(
          query(
            collection(db, "escolas"),
            where("ativo", "==", true),
            where(documentId(), "in", ids.slice(i, i + 10)),
          ),
        );
      }
    }
    if (!consultas.length) return;
    carregando.value = true;
    const atual = geracao;
    const resultados = new Map();
    const terminadas = new Set();
    cancelar = consultas.map((q, indice) =>
      onSnapshot(
        q,
        (snap) => {
          if (atual !== geracao) return;
          resultados.set(
            indice,
            snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          );
          terminadas.add(indice);
          escolas.value = [...resultados.values()]
            .flat()
            .filter(
              (e) => !ehDeposito(e.id) || (incluirDeposito && ehGestao.value),
            )
            .sort((a, b) =>
              String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
            );
          carregando.value = terminadas.size !== consultas.length;
        },
        (falha) => {
          if (atual !== geracao) return;
          console.error("Consulta de escolas falhou:", falha);
          terminadas.add(indice);
          resultados.delete(indice);
          escolas.value = [...resultados.values()]
            .flat()
            .filter(
              (e) => !ehDeposito(e.id) || (incluirDeposito && ehGestao.value),
            )
            .sort((a, b) =>
              String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
            );
          erro.value = mensagemErroConsulta(falha);
          carregando.value = terminadas.size !== consultas.length;
        },
      ),
    );
  }

  async function ativarDeposito() {
    exigirUsuario(null, true);
    const refDoc = doc(db, "escolas", DEPOSITO_ID);
    await runTransactionAuditada(db, async (tx) => {
      const snap = await tx.get(refDoc);
      if (snap.exists()) {
        if (snap.data().tipoUnidade !== "deposito")
          throw new Error(
            "O identificador do depósito já está em uso por outro cadastro. Contate o suporte.",
          );
        if (!snap.data().ativo) tx.update(refDoc, { ativo: true });
      } else
        tx.set(refDoc, {
          nome: DEPOSITO_NOME,
          tipoUnidade: "deposito",
          ativo: true,
          criadoEm: serverTimestamp(),
        });
    });
    return DEPOSITO_ID;
  }
  async function criarEscola(dados) {
    exigirUsuario(null, true);
    if (!dados.nome?.trim()) throw new Error("Informe o nome da escola.");
    const lista = await getDocsFromServer(collection(db, "escolas"));
    const iguais = lista.docs.filter(
      (s) => normalizar(s.data().nome) === normalizar(dados.nome),
    );
    if (iguais.length > 1)
      throw Error(
        "Mais de um cadastro corresponde a este nome. Solicite conferência ao Master.",
      );
    if (iguais.length) {
      if (iguais[0].data().ativo === false || iguais[0].data().arquivada)
        throw Error(
          "A escola já existe e está inativa. Solicite reativação ao Master.",
        );
      return iguais[0].id;
    }
    const refDoc = doc(db, "escolas", await idPorNome(dados.nome));
    await runTransactionAuditada(db, async (tx) => {
      const atual = await tx.get(refDoc);
      if (!atual.exists())
        tx.set(refDoc, {
          nome: dados.nome.trim(),
          ativo: true,
          versao: 1,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
    });
    return refDoc.id;
  }

  async function atualizarEscola(escolaId, dadosAntes, dadosNovos) {
    exigirUsuario(escolaId, true);
    const batch = writeBatch(db);
    batch.update(doc(db, "escolas", escolaId), dadosNovos);

    await batch.commit();
  }

  const desativarEscola = (id, antes) =>
    atualizarEscola(id, antes, { ativo: false });
  return {
    escolas,
    carregando,
    erro,
    escutarEscolas,
    parar,
    criarEscola,
    ativarDeposito,
    atualizarEscola,
    desativarEscola,
  };
}
