// src/composables/useMovimentacoes.js
// Histórico e filtros de entradas/saídas de estoque por escola.

import { ref } from "vue";
import {
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

export function useMovimentacoes(escolaId) {
  const movimentacoes = ref([]);
  const carregando = ref(false);
  const erro = ref("");
  let unsubscribe = null;
  let geracao = 0;

  function escutar({
    tipo = null,
    itemId = null,
    dataInicio = null,
    dataFim = null,
    limite = 200,
  } = {}) {
    parar();
    if (!escolaId) return;
    const atual = geracao;
    carregando.value = true;
    erro.value = "";
    const clausulas = [orderBy("data", "desc"), fsLimit(limite)];
    if (tipo) clausulas.unshift(where("tipo", "==", tipo));
    if (itemId) clausulas.unshift(where("itemId", "==", itemId));
    if (dataInicio) clausulas.unshift(where("data", ">=", dataInicio));
    if (dataFim) clausulas.unshift(where("data", "<=", dataFim));

    const q = query(
      collection(db, "escolas", escolaId, "movimentacoes"),
      ...clausulas,
    );
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (atual !== geracao) return;
        movimentacoes.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        carregando.value = false;
      },
      (e) => {
        if (atual !== geracao) return;
        movimentacoes.value = [];
        erro.value =
          "Não foi possível carregar as movimentações. Confira a conexão e as permissões." +
          (e.code ? ` (${e.code})` : "");
        carregando.value = false;
      },
    );
  }

  function parar() {
    geracao++;
    unsubscribe?.();
    unsubscribe = null;
    carregando.value = false;
    movimentacoes.value = [];
  }

  return { movimentacoes, carregando, erro, escutar, parar };
}
