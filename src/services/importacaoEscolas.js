import {
  collection,
  doc,
  getDocsFromServer,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../composables/useAuth";
import { transacaoConfirmada } from "../portal/transacao";
import { prepararLinhas } from "../../shared/importacao-escolas.mjs";
export async function importarEscolas(rows, mapa, atualizar, progresso) {
  if (!useAuth().pode("escolas"))
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
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          l.dados.inep
            ? "inep:" + l.dados.inep
            : "nome:" +
                l.dados.nome
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, " ")
                  .trim(),
        ),
      );
      const id =
        l.existente?.id ||
        "import-" +
          Array.from(new Uint8Array(bytes), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("");
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
          ...(antes || {}),
          ...l.dados,
          ativo: antes?.ativo !== false,
          versao: (antes?.versao || 0) + 1,
          atualizadoEm: serverTimestamp(),
          ...(s.exists() ? {} : { criadoEm: serverTimestamp() }),
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
