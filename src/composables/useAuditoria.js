import { ref } from "vue";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";

// Nas operações principais o registro é escrito no mesmo lote/transação dos dados.
export function criarRegistroAuditoria({
  colecao,
  documentoId,
  escolaId = null,
  acao,
  dadosAntes = null,
  dadosDepois = null,
}) {
  const { exigirUsuario } = useAuth();
  const usuario = exigirUsuario();
  const chaves = new Set([
    ...Object.keys(dadosAntes || {}),
    ...Object.keys(dadosDepois || {}),
  ]);
  return {
    colecao,
    documentoId,
    escolaId,
    acao,
    dadosAntes,
    dadosDepois,
    usuarioId: usuario.uid,
    usuarioNome: usuario.nome,
    papelUsuario: usuario.papel,
    camposAlterados: [...chaves].filter(
      (c) =>
        JSON.stringify(dadosAntes?.[c]) !== JSON.stringify(dadosDepois?.[c]),
    ),
    timestamp: Timestamp.now(),
    dispositivo:
      typeof navigator === "undefined" ? "servidor" : navigator.userAgent,
  };
}

export function registrarAuditoria(_dados) {
  throw new Error("Use a transação auditada para registrar uma operação.");
}

export function useAuditoria() {
  const registros = ref([]);
  const carregando = ref(false);
  const erro = ref("");
  let unsubscribe;
  let geracao = 0;
  function parar() {
    geracao += 1;
    unsubscribe?.();
    unsubscribe = null;
    registros.value = [];
    carregando.value = false;
  }
  function escutar({
    escolaId = null,
    usuarioId = null,
    colecao = null,
    limite = 100,
    legado = false,
  } = {}) {
    parar();
    erro.value = "";
    carregando.value = true;
    const atual = geracao;
    const clausulas = [orderBy("timestamp", "desc"), limit(limite)];
    if (!legado) clausulas.push(where("dominio", "==", "alimentacao"));
    if (escolaId) clausulas.push(where("escolaId", "==", escolaId));
    if (usuarioId) clausulas.push(where("usuarioId", "==", usuarioId));
    if (colecao) clausulas.push(where("colecao", "==", colecao));
    unsubscribe = onSnapshot(
      query(
        collection(db, legado ? "auditoria" : "auditoriaRegistros"),
        ...clausulas,
      ),
      (snap) => {
        if (atual !== geracao) return;
        registros.value = snap.docs.map((d) => {
          const r = d.data();
          return {
            ...r,
            id: d.id,
            camposAlterados:
              r.camposAlterados ||
              [
                ...new Set([
                  ...Object.keys(r.dadosAntes || {}),
                  ...Object.keys(r.dadosDepois || {}),
                ]),
              ].filter(
                (k) =>
                  !k.startsWith("_") &&
                  JSON.stringify(r.dadosAntes?.[k]) !==
                    JSON.stringify(r.dadosDepois?.[k]),
              ),
          };
        });
        carregando.value = false;
      },
      () => {
        if (atual !== geracao) return;
        erro.value =
          "Não foi possível carregar a auditoria. Verifique a conexão e as permissões.";
        carregando.value = false;
      },
    );
  }
  return { registros, carregando, erro, escutar, parar };
}
