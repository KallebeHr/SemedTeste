import { transacaoConfirmada } from "./transacao";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../composables/useAuth";
import { pode } from "./permissoes";
import { conteudoPublico } from "./validacao";

export async function salvarConteudo(form, publicar = false) {
  const u = useAuth().exigirUsuario();
  if (form.tipo === "cardapio" ? !pode(u, "nutricao") : !pode(u, "conteudo"))
    throw new Error("Você não pode editar este conteúdo.");
  const p = conteudoPublico(form);
  const referencia = form.id
    ? doc(db, "conteudos", form.id)
    : ["pagina", "servico"].includes(p.tipo)
      ? doc(db, "conteudos", p.tipo + "-" + p.slug)
      : doc(collection(db, "conteudos"));
  form.id = referencia.id;
  const publica = doc(db, "publicacoes", referencia.id);
  await transacaoConfirmada(async (t) => {
    const snap = await t.get(referencia);
    const anterior = snap.exists() ? snap.data() : null;
    if (anterior && anterior.versao !== form.versao)
      throw new Error(
        "Este conteúdo foi alterado por outra pessoa. Reabra o registro antes de salvar.",
      );
    if (anterior && anterior.tipo !== p.tipo)
      throw new Error("O tipo de um registro existente não pode ser alterado.");
    t.set(referencia, {
      ...p,
      versao: (anterior?.versao || 0) + 1,
      publicado: publicar ? true : anterior?.publicado || false,
      atualizadoPor: u.uid,
      atualizadoEm: serverTimestamp(),
    });
    if (publicar) t.set(publica, { ...p, publicadoEm: serverTimestamp() });
  });
  return referencia.id;
}
export async function retirarPublicacao(registro) {
  const u = useAuth().exigirUsuario();
  if (
    registro.tipo === "cardapio" ? !pode(u, "nutricao") : !pode(u, "conteudo")
  )
    throw new Error("Ação não permitida.");
  const ref = doc(db, "conteudos", registro.id);
  await transacaoConfirmada(async (t) => {
    const s = await t.get(ref);
    if (!s.exists() || s.data().versao !== registro.versao)
      throw new Error(
        "O registro foi alterado. Reabra-o antes de retirar a publicação.",
      );
    t.update(ref, {
      publicado: false,
      versao: registro.versao + 1,
      atualizadoPor: u.uid,
      atualizadoEm: serverTimestamp(),
    });
    t.delete(doc(db, "publicacoes", registro.id));
  });
}
