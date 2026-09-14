import {
  writeBatchAuditado as writeBatch,
  runTransactionAuditada as runTransaction,
} from "../portal/auditoria";
import { ref } from "vue";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

import { criarNotificacao } from "./useNotificacoes";
import { useAuth } from "./useAuth";
import {
  validarIdentificacaoPreparada,
  resumirIdentificacao,
} from "../utils/identificacao";
import { executarComPrazo } from "../utils/operacaoComPrazo";

export const TEMPLATES_CHECKLIST = {
  recebimento: [
    "Embalagens íntegras, sem violação",
    "Temperatura adequada (produtos refrigerados/congelados)",
    "Prazo de validade conforme contrato",
    "Quantidade confere com a nota fiscal",
    "Ausência de pragas ou sinais de contaminação",
    "Transporte em veículo higienizado",
  ],
  sanitaria: [
    "Área de armazenamento limpa e organizada",
    "Controle de temperatura de geladeiras/freezers em dia",
    "Ausência de vetores (insetos/roedores)",
    "Uniformes e EPIs dos manipuladores adequados",
    "Rotulagem e identificação de validade nos itens abertos",
    "Lixo e resíduos descartados corretamente",
  ],
  estrutural: [
    "Piso e paredes sem infiltração ou rachaduras",
    "Iluminação adequada na cozinha e despensa",
    "Ventilação/exaustão funcionando",
    "Instalações elétricas e hidráulicas em ordem",
    "Equipamentos (fogão, geladeira, freezer) em funcionamento",
  ],
  rotina: [
    "Cardápio do dia sendo seguido conforme planejamento",
    "Per-capita de alimentos dentro do esperado",
    "Registro de temperatura da refeição servida",
    "Condições gerais de higiene do refeitório",
  ],
 AgroFamiliar: [
  "Produtos entregues são provenientes da agricultura familiar",
  "Fornecedor corresponde ao agricultor, associação ou cooperativa cadastrada",
  "Produtos entregues estão de acordo com os itens previstos no contrato/chamada pública",
  "Quantidade entregue está de acordo com o solicitado",
  "Qualidade dos produtos está dentro do padrão esperado",
],
};

export function useVistorias(escolaId) {
  const vistorias = ref([]);
  const carregando = ref(false);
  const erro = ref("");
  let unsubscribe;
  let geracao = 0;
  const { exigirUsuario, ehGestao, ehDiretor } = useAuth();

  function parar() {
    geracao++;
    unsubscribe?.();
    unsubscribe = null;
    carregando.value = false;
    vistorias.value = [];
  }
  function escutar({ status = null, tipo = null, limite = 100 } = {}) {
    parar();
    erro.value = "";
    if (!escolaId) return;
    carregando.value = true;
    const atual = geracao;
    const clausulas = [orderBy("data", "desc"), limit(limite)];
    if (status) clausulas.push(where("status", "==", status));
    if (tipo) clausulas.push(where("tipo", "==", tipo));
    unsubscribe = onSnapshot(
      query(collection(db, "escolas", escolaId, "vistorias"), ...clausulas),
      (snap) => {
        if (atual !== geracao) return;
        vistorias.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        carregando.value = false;
      },
      (e) => {
        if (atual !== geracao) return;
        vistorias.value = [];
        erro.value =
          "Não foi possível carregar as vistorias. Confira a conexão e as permissões." +
          (e.code ? ` (${e.code})` : "");
        carregando.value = false;
      },
    );
  }
  function calcularNota(checklist) {
    const aplicaveis = checklist.filter((c) =>
      ["conforme", "nao_conforme"].includes(c.status),
    );
    if (!aplicaveis.length) return null;
    return Number(
      (
        (aplicaveis.filter((c) => c.status === "conforme").length /
          aplicaveis.length) *
        10
      ).toFixed(1),
    );
  }
  function calcularStatus(checklist) {
    if (!checklist.length || checklist.some((c) => !c.status))
      return "pendente";
    if (checklist.every((c) => c.status === "nao_aplicavel"))
      return "nao_aplicavel";
    const total = checklist.filter((c) => c.status === "nao_conforme").length;
    return total === 0
      ? "conforme"
      : total <= 2
        ? "conforme_com_ressalvas"
        : "nao_conforme";
  }
  async function registrarVistoria({
    vistoriaId,
    tipo,
    checklist,
    fotos = [],
    planoDeAcao = null,
    assinaturas = [],
  }) {
    const usuario = exigirUsuario(escolaId);
    if (!ehGestao.value && !ehDiretor.value)
      throw new Error("Sua conta não pode registrar vistorias.");
    if (
      !TEMPLATES_CHECKLIST[tipo] ||
      !Array.isArray(checklist) ||
      !checklist.length ||
      checklist.length > 8 ||
      checklist.some(
        (c) =>
          !c.item?.trim() ||
          !["conforme", "nao_conforme", "nao_aplicavel"].includes(c.status),
      )
    )
      throw new Error("Preencha os itens da vistoria.");
    if (
      checklist.some(
        (c) => c.item.length > 300 || String(c.observacao || "").length > 3000,
      ) ||
      String(planoDeAcao || "").length > 5000
    )
      throw new Error("Revise o tamanho dos textos da vistoria.");
    const status = calcularStatus(checklist);
    const temPendencias = checklist.some((c) => c.status === "nao_conforme");
    if (temPendencias && !planoDeAcao?.trim())
      throw new Error("Informe o plano de ação.");
    if (!vistoriaId || assinaturas.length !== 2)
      throw new Error(
        "Confirme a identificação do responsável e da testemunha.",
      );
    assinaturas.forEach((identificacao) =>
      validarIdentificacaoPreparada(identificacao, {
        escolaId,
        documentoId: vistoriaId,
        documentoTipo: "vistoria",
        usuarioId: usuario.uid,
      }),
    );
    if (
      assinaturas[0].id === assinaturas[1].id ||
      assinaturas[0].payload.cpf === assinaturas[1].payload.cpf
    )
      throw new Error(
        "O responsável e a testemunha precisam ter CPFs diferentes.",
      );
    const refDoc = doc(db, "escolas", escolaId, "vistorias", vistoriaId);

    const payload = {
      tipo,
      checklist,
      fotos,
      planoDeAcao: planoDeAcao?.trim() || "",
      status,
      notaGeral: calcularNota(checklist),
      assinaturaResponsavelId: assinaturas[0].id,
      assinaturaTestemunhaId: assinaturas[1]?.id || null,
      metodoConfirmacao: "identificacao_cpf",
      identificacaoResponsavel: resumirIdentificacao(assinaturas[0].payload),
      identificacaoTestemunha: resumirIdentificacao(assinaturas[1].payload),
      responsavelId: usuario.uid,
      responsavelNome: assinaturas[0].payload.nomeSignatario,
      registradoPorNome: usuario.nome,
      data: Timestamp.now(),
      criadoEm: Timestamp.now(),
    };
    const nova = await executarComPrazo(
      (conferirAtiva) =>
        runTransaction(db, async (tx) => {
          tx.definirVerificacao(conferirAtiva);
          conferirAtiva();
          const existente = await tx.get(refDoc);
          conferirAtiva();
          if (existente.exists()) return false;
          assinaturas.forEach((a) => tx.set(a.referencia, a.payload));
          tx.set(refDoc, payload);

          return true;
        }),
      {
        mensagem:
          "O banco não confirmou a vistoria em 45 segundos. Confira o histórico e tente novamente nesta tela; o mesmo registro será reutilizado.",
        codigo: "vistoria/timeout",
      },
    );
    if (nova && temPendencias) {
      criarNotificacao({
        tipo: "vistoria_nao_conforme",
        escolaId,
        origemId: refDoc.id,
        titulo: "Vistoria com pendências",
        mensagem: `Nota ${payload.notaGeral}/10. Confira o plano de ação.`,
      }).catch((e) => console.warn("Alerta de vistoria não enviado:", e.code));
    }
    return refDoc.id;
  }
  async function atualizarPlanoDeAcao(vistoriaId, dadosAntes, planoDeAcao) {
    exigirUsuario(escolaId);
    if (!ehGestao.value && !ehDiretor.value)
      throw new Error("Acesso não autorizado.");
    const batch = writeBatch(db);
    batch.update(doc(db, "escolas", escolaId, "vistorias", vistoriaId), {
      planoDeAcao,
    });

    await batch.commit();
  }
  return {
    vistorias,
    carregando,
    erro,
    escutar,
    registrarVistoria,
    atualizarPlanoDeAcao,
    calcularNota,
    calcularStatus,
    parar,
  };
}
