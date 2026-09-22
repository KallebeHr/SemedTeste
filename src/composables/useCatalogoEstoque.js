import { ref, toValue } from "vue";
import { doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { runTransactionAuditada } from "../portal/auditoria";
import { useAuth } from "./useAuth";
import { executarComPrazo } from "../utils/operacaoComPrazo";
import {
  validarProdutoCatalogo,
  produtoJaCadastrado,
} from "../utils/catalogoEstoque";
import { quantidadeValida } from "../utils/estoque";
export function useCatalogoEstoque(escolaId) {
  const ocupado = ref(false),
    progresso = ref(0),
    total = ref(0),
    resultado = ref(null),
    erro = ref("");
  let interromper = false;
  const { exigirUsuario } = useAuth();
  function pararAposAtual() {
    interromper = true;
  }
  async function adicionar(
    produtos,
    { itensExistentes = [], minimo = 0, local = "" } = {},
  ) {
    if (ocupado.value) throw new Error("Aguarde a importação em andamento.");
    const unidadeId = toValue(escolaId),
      usuario = exigirUsuario(unidadeId, true);
    if (!Array.isArray(produtos) || !produtos.length || produtos.length > 1000)
      throw new Error("Selecione de 1 a 1.000 produtos.");
    const lista = [
      ...new Map(
        produtos.map((p) => {
          const v = validarProdutoCatalogo(p);
          return [v.id, v];
        }),
      ).values(),
    ];
    const quantidadeMinima = quantidadeValida(minimo, "Mínimo");
    if (typeof local !== "string" || local.trim().length > 300)
      throw new Error("Local de armazenamento: use até 300 caracteres.");
    ocupado.value = true;
    interromper = false;
    erro.value = "";
    progresso.value = 0;
    total.value = lista.length;
    const resumo = {
      criados: [],
      existentes: [],
      pendentes: [],
      interrompido: false,
    };
    resultado.value = resumo;
    try {
      for (let idx = 0; idx < lista.length; idx++) {
        if (interromper) {
          resumo.interrompido = true;
          resumo.pendentes = lista.slice(idx).map((p) => p.id);
          break;
        }
        const p = lista[idx];
        try {
          if (exigirUsuario(unidadeId, true).uid !== usuario.uid)
            throw new Error("A sessão mudou. Entre novamente.");
          if (produtoJaCadastrado(p, itensExistentes)) {
            resumo.existentes.push(p.id);
            progresso.value = idx + 1;
            continue;
          }
          const referencia = doc(
            db,
            "escolas",
            unidadeId,
            "estoque",
            "cat-" + p.id,
          );
          const criado = await executarComPrazo(
            (verificar) =>
              runTransactionAuditada(db, async (tx) => {
                tx.definirVerificacao(verificar);
                verificar();
                const snap = await tx.get(referencia);
                verificar();
                if (snap.exists()) return false;
                tx.set(referencia, {
                  nome: p.nome,
                  categoria: p.categoria,
                  unidade: p.unidade,
                  ativo: true,
                  quantidadeAtual: 0,
                  quantidadeMinima,
                  precoUnitario: 0,
                  validade: null,
                  localArmazenamento: local.trim(),
                  atualizadoPor: usuario.uid,
                  atualizadoEm: serverTimestamp(),
                });
                return true;
              }),
            {
              codigo: "catalogo/timeout",
              mensagem:
                "O banco não confirmou o item a tempo. Tente novamente; os cadastros confirmados serão reconhecidos.",
            },
          );
          (criado ? resumo.criados : resumo.existentes).push(p.id);
          progresso.value = idx + 1;
        } catch (e) {
          erro.value =
            e.code === "permission-denied"
              ? "O banco negou o cadastro. Confira o perfil e as regras publicadas."
              : e.message || "Falha ao cadastrar. Tente novamente.";
          resumo.pendentes = lista.slice(idx).map((v) => v.id);
          break;
        }
      }
    } finally {
      resultado.value = { ...resumo };
      ocupado.value = false;
    }
    return resultado.value;
  }
  return {
    ocupado,
    progresso,
    total,
    resultado,
    erro,
    adicionar,
    pararAposAtual,
  };
}
