import { ref, onScopeDispose, watch } from "vue";
import { onSnapshot } from "firebase/firestore";
import { mensagemErro } from "../portal/validacao";

// Reinscrição cancela callbacks antigos e limpa os dados ao mudar usuário/escola.
export function useColecao(criarConsulta, dependencias) {
  const dados = ref([]),
    carregando = ref(false),
    erro = ref("");
  let cancelar,
    prazo,
    geracao = 0;
  function parar() {
    geracao++;
    cancelar?.();
    clearTimeout(prazo);
    cancelar = null;
    dados.value = [];
    carregando.value = false;
  }
  function recarregar() {
    parar();
    erro.value = "";
    try {
      const consulta = criarConsulta();
      if (!consulta) return;
      const atual = geracao;
      carregando.value = true;
      prazo = setTimeout(() => {
        if (atual === geracao && carregando.value) {
          carregando.value = false;
          erro.value =
            "Não foi possível confirmar a leitura com o servidor. Confira a conexão e tente novamente.";
        }
      }, 20000);
      cancelar = onSnapshot(
        consulta,
        { includeMetadataChanges: true },
        (snap) => {
          if (atual !== geracao || snap.metadata?.fromCache) return;
          clearTimeout(prazo);
          dados.value = snap.docs
            ? snap.docs.map((d) => ({ ...d.data(), id: d.id }))
            : snap.exists()
              ? [{ ...snap.data(), id: snap.id }]
              : [];
          carregando.value = false;
          erro.value = "";
        },
        (e) => {
          if (atual === geracao) {
            clearTimeout(prazo);
            dados.value = [];
            erro.value = mensagemErro(e);
            carregando.value = false;
          }
        },
      );
    } catch (e) {
      erro.value = mensagemErro(e);
    }
  }
  if (dependencias) watch(dependencias, recarregar, { immediate: true });
  else recarregar();
  onScopeDispose(parar);
  return { dados, carregando, erro, recarregar };
}
