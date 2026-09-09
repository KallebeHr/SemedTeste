import { collection, query, where, documentId } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";
import { useColecao } from "./useColecao";
import { todasEscolas } from "../portal/permissoes";
export function useEscolasAcesso() {
  const { usuario } = useAuth();
  return useColecao(
    () => {
      const u = usuario.value;
      if (!u) return null;
      const q = [where("ativo", "==", true)];
      if (!todasEscolas(u)) {
        if (!u.escolasVinculadas.length) return null;
        q.push(where(documentId(), "in", u.escolasVinculadas.slice(0, 20)));
      }
      return query(collection(db, "escolas"), ...q);
    },
    () => [
      usuario.value?.uid,
      usuario.value?.papel,
      JSON.stringify(usuario.value?.escolasVinculadas),
    ],
  );
}
