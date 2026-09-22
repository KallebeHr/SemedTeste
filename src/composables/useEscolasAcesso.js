import { computed } from "vue";
import { ehDeposito } from "../utils/estoque";
import { collection, query, where, documentId } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";
import { useColecao } from "./useColecao";
import { todasEscolas } from "../portal/permissoes";
export function useEscolasAcesso() {
  const { usuario } = useAuth();
  const consulta = useColecao(
    () => {
      const u = usuario.value;
      if (!u) return null;
      const q = [where("ativo", "==", true)];
      if (!todasEscolas(u)) {
        if (!u.escolasVinculadas.filter((id) => !ehDeposito(id)).length)
          return null;
        q.push(
          where(
            documentId(),
            "in",
            u.escolasVinculadas.filter((id) => !ehDeposito(id)).slice(0, 20),
          ),
        );
      }
      return query(collection(db, "escolas"), ...q);
    },
    () => [
      usuario.value?.uid,
      usuario.value?.papel,
      JSON.stringify(usuario.value?.escolasVinculadas),
    ],
  );
  return {
    ...consulta,
    dados: computed(() =>
      consulta.dados.value.filter((e) => !ehDeposito(e.id)),
    ),
  };
}
