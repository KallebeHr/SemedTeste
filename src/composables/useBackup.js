import { ref } from "vue";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";
import { executarComPrazo } from "../utils/operacaoComPrazo";
const SUBCOLECOES = [
  "estoque",
  "movimentacoes",
  "vistorias",
  "assinaturas",
  "cardapios",
  "fornecedores",
];

export function useBackup() {
  const gerando = ref(false),
    progresso = ref(0),
    erro = ref("");
  const { exigirUsuario } = useAuth();
  async function gerarBackup(escolaIds) {
    if (gerando.value) throw new Error("Aguarde a geração atual.");
    gerando.value = true;
    progresso.value = 0;
    erro.value = "";
    try {
      const usuario = exigirUsuario(null, true);
      const ids = [...new Set(escolaIds)];
      if (!ids.length) throw new Error("Selecione ao menos uma escola.");
      ids.forEach((id) => exigirUsuario(id, true));
      return await executarComPrazo(
        async (conferirAtiva) => {
          function conferir() {
            conferirAtiva();
            if (exigirUsuario(null, true).uid !== usuario.uid)
              throw new Error(
                "Sua sessão mudou. Entre novamente para gerar o backup.",
              );
          }
          const backup = {
            geradoEm: new Date().toISOString(),
            geradoPor: usuario.nome,
            versaoEsquema: 2,
            incluiArquivosDeAssinatura: false,
            escolas: {},
          };
          let totalDocumentos = 0,
            concluidas = 0;
          for (const id of ids) {
            conferir();
            const escola = await getDoc(doc(db, "escolas", id));
            conferir();
            if (!escola.exists())
              throw new Error(
                "Uma escola selecionada não foi encontrada. Atualize a lista e tente novamente.",
              );
            const dados = {};
            for (const sub of SUBCOLECOES) {
              conferir();
              const snap = await getDocs(collection(db, "escolas", id, sub));
              conferir();
              dados[sub] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
              totalDocumentos += snap.docs.length;
            }
            const auditoria = await getDocs(
              query(collection(db, "auditoria"), where("escolaId", "==", id)),
            );
            const auditados = await getDocs(
              query(
                collection(db, "auditoriaRegistros"),
                where("dominio", "==", "alimentacao"),
                where("escolaId", "==", id),
              ),
            );
            conferir();
            backup.escolas[id] = {
              escola: escola.data(),
              dados,
              auditoria: auditoria.docs.map((d) => ({ ...d.data(), id: d.id })),
              auditoriaVerificada: auditados.docs.map((d) => ({
                ...d.data(),
                alvo: d.data().alvo?.path,
                id: d.id,
              })),
            };
            totalDocumentos +=
              1 + auditoria.docs.length + auditados.docs.length;
            progresso.value = Math.round((++concluidas / ids.length) * 100);
          }
          return {
            json: JSON.stringify(backup, null, 2),
            totalDocumentos,
            nomeArquivo: `backup-alimentacao-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
          };
        },
        {
          limiteMs: 120000,
          codigo: "backup/timeout",
          mensagem:
            "O banco não respondeu a tempo. Selecione menos escolas ou confira a conexão e tente novamente.",
        },
      );
    } catch (e) {
      erro.value =
        e.code === "permission-denied"
          ? "O Firestore negou a leitura do backup. Confira as regras e o perfil da conta. (permission-denied)"
          : e.message || "Não foi possível gerar o backup.";
      throw e;
    } finally {
      gerando.value = false;
    }
  }
  function baixarJsonLocal(json, nomeArquivo = `backup-${Date.now()}.json`) {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { gerando, progresso, erro, gerarBackup, baixarJsonLocal };
}
