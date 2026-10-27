import {
  collection,
  doc,
  getDocsFromServer,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../composables/useAuth";
import { transacaoConfirmada } from "../portal/transacao";
import {
  normalizar,
  validarEscola,
  idPorNome,
} from "../../shared/importacao-escolas.mjs";
import { ehDeposito } from "../utils/estoque";
export const PUBLICAVEIS = [
  "endereco",
  "contato",
  "etapas",
  "horario",
  "sobre",
  "bairro",
  "zona",
  "email",
  "latitude",
  "longitude",
];
function master() {
  if (!useAuth().pode("gerenciarEscolas"))
    throw Error("Somente o Administrador Master pode gerenciar o cadastro.");
}
export async function salvarFichaEscola(form, publicar, autorizados) {
  master();
  if (ehDeposito(form.id))
    throw Error("O depósito municipal é gerenciado em seu módulo próprio.");
  const dados = validarEscola(form);
  if ((dados.latitude === null) !== (dados.longitude === null))
    throw Error("Informe latitude e longitude juntas, ou deixe ambas vazias.");
  if (
    publicar &&
    autorizados.includes("latitude") !== autorizados.includes("longitude")
  )
    throw Error(
      "Para publicar a localização, autorize latitude e longitude juntas.",
    );
  const lista = await getDocsFromServer(collection(db, "escolas"));
  if (
    lista.docs.some(
      (s) =>
        s.id !== form.id &&
        (normalizar(s.data().nome) === normalizar(dados.nome) ||
          (dados.inep && s.data().inep === dados.inep)),
    )
  )
    throw Error(
      "Já existe uma escola com este nome ou INEP. Edite o cadastro existente.",
    );
  const id = form.id || (await idPorNome(dados.nome)),
    r = doc(db, "escolas", id);
  await transacaoConfirmada(async (tx) => {
    const s = await tx.get(r);
    if ((s.data()?.versao || 0) !== form.versao || (!form.id && s.exists()))
      throw Error("Cadastro alterado. Atualize a lista e reabra a escola.");
    tx.set(r, {
      ...s.data(),
      ...dados,
      ativo: form.ativo,
      arquivada: s.data()?.arquivada === true,
      versao: form.versao + 1,
      atualizadoEm: serverTimestamp(),
      ...(s.exists() ? {} : { criadoEm: serverTimestamp() }),
    });
    const p = doc(db, "escolasPublicas", id);
    if (publicar && form.ativo && !s.data()?.arquivada) {
      const snapshot = { nome: dados.nome, publicadoEm: serverTimestamp() };
      for (const k of PUBLICAVEIS) {
        const ok = autorizados.includes(k);
        if (["latitude", "longitude"].includes(k)) {
          if (ok && dados[k] !== null) snapshot[k] = dados[k];
        } else if (
          ["endereco", "contato", "etapas", "horario", "sobre"].includes(k)
        )
          snapshot[k] = ok ? dados[k] || "" : "";
        else if (ok && dados[k]) snapshot[k] = dados[k];
      }
      tx.set(p, snapshot);
    } else tx.delete(p);
  });
  return id;
}
export async function alterarSituacaoEscola(escola, acao) {
  master();
  if (ehDeposito(escola.id))
    throw Error("Não é permitido arquivar o depósito por esta tela.");
  await transacaoConfirmada(async (tx) => {
    const r = doc(db, "escolas", escola.id),
      s = await tx.get(r);
    if (!s.exists() || (s.data().versao || 0) !== (escola.versao || 0))
      throw Error("Cadastro alterado. Atualize a lista antes de continuar.");
    const reativar = acao === "reativar";
    if (!["reativar", "desativar", "arquivar"].includes(acao))
      throw Error("Ação inválida.");
    tx.update(r, {
      ativo: reativar,
      arquivada:
        acao === "arquivar" || (!reativar && s.data().arquivada === true),
      versao: (s.data().versao || 0) + 1,
      atualizadoEm: serverTimestamp(),
      ...(acao === "arquivar" ? { arquivadoEm: serverTimestamp() } : {}),
    });
    if (!reativar) tx.delete(doc(db, "escolasPublicas", escola.id));
  });
}
