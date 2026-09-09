import { writeBatchAuditado } from "../portal/auditoria";
// src/composables/useNotificacoes.js
import { ref } from "vue";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";

// Criação de notificação — chamada internamente por outros composables
// (useEstoque ao detectar estoque baixo, useVistorias em não conformidades).
export async function criarNotificacao({
  tipo,
  escolaId,
  origemId,
  titulo,
  mensagem,
  destinatarios = null,
}) {
  const payload = {
    tipo,
    escolaId,
    origemId,
    titulo,
    mensagem,
    destinatarios: destinatarios ?? [], // preenchido pela regra de negócio (ex.: diretor + nutricionista da escola)
    lida: false,
    criadoEm: serverTimestamp(),
  };
  const lote = writeBatchAuditado(db);
  lote.set(doc(db, "notificacoes",tipo+'-'+escolaId+'-'+origemId), payload);
  await lote.commit();
}

export function useNotificacoes() {
  const { usuario } = useAuth();
  const notificacoes = ref([]);
  const naoLidas = ref(0);
  let unsubscribe = null;

  function escutar() {
    if (!usuario.value) return;
    const q = query(
      collection(db, "notificacoes"),
      where("destinatarios", "array-contains", usuario.value.uid),
      orderBy("criadoEm", "desc"),
    );
    if (unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(q, (snap) => {
      notificacoes.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      naoLidas.value = notificacoes.value.filter((n) => !n.lida).length;
    });
  }

  async function marcarComoLida(notifId) {
    const lote = writeBatchAuditado(db);
    lote.update(doc(db, "notificacoes", notifId), { lida: true });
    await lote.commit();
  }

  function parar() {
    if (unsubscribe) unsubscribe();
  }

  return { notificacoes, naoLidas, escutar, marcarComoLida, parar };
}
