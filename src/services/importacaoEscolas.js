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
  prepararLinhas,
  mesclarImportacao,
  idPorNome,
} from "../../shared/importacao-escolas.mjs";
export async function importarEscolas(
  rows,
  mapa,
  atualizar,
  progresso,
  publicarNomes = false,
) {
  if (!useAuth().pode("gerenciarEscolas"))
    throw new Error("Seu cargo não permite importar escolas.");
  const snap = await getDocsFromServer(collection(db, "escolas"));
  const linhas = prepararLinhas(
    rows,
    mapa,
    snap.docs.map((d) => ({ ...d.data(), id: d.id })),
  );
  if (linhas.some((l) => l.erro))
    throw new Error(
      "Os cadastros mudaram ou há erros na planilha. Revise a prévia.",
    );
  const resultado = { criadas: 0, atualizadas: 0, ignoradas: 0, falhas: [] };
  for (const l of linhas) {
    if (l.existente && !atualizar) {
      resultado.ignoradas++;
      progresso({ ...resultado });
      continue;
    }
    try {
      const id = l.existente?.id || (await idPorNome(l.dados.nome));
      const r = doc(db, "escolas", id);
      let acao;
      await transacaoConfirmada(async (t) => {
        const s = await t.get(r),
          antes = s.data();
        if (s.exists() && !l.existente) {
          acao = "ignoradas";
          return;
        }
        if (
          l.existente &&
          (!s.exists() || (antes.versao || 0) !== (l.existente.versao || 0))
        )
          throw new Error(
            "Cadastro alterado durante a importação. Revise e tente novamente.",
          );
        t.set(r, {
          ...mesclarImportacao(antes || {}, l.dados),
          ativo: antes?.ativo !== false,
          versao: (antes?.versao || 0) + 1,
          atualizadoEm: serverTimestamp(),
          ...(s.exists() ? {} : { criadoEm: serverTimestamp() }),
        });
        if (!s.exists() && publicarNomes)
          t.set(doc(db, "escolasPublicas", id), {
            nome: l.dados.nome,
            endereco: "",
            contato: "",
            etapas: "",
            horario: "",
            sobre: "",
            publicadoEm: serverTimestamp(),
          });
        acao = s.exists() ? "atualizadas" : "criadas";
      });
      resultado[acao]++;
    } catch (e) {
      resultado.falhas.push({
        linha: l.linha,
        nome: l.dados.nome,
        erro: e.message,
      });
    }
    progresso({ ...resultado });
  }
  return resultado;
}
