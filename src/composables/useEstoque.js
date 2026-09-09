import {
  writeBatchAuditado as writeBatch,
  runTransactionAuditada as runTransaction,
} from "../portal/auditoria";
import { ref, computed, toValue } from "vue";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
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

function mensagemErroConsulta(falha) {
  const codigo = String(falha?.code || "").replace(/^firestore\//, "");
  const mensagens = {
    "permission-denied":
      "O Firebase negou a leitura de estoque. Confira as regras do Firestore e o papel do seu usuário.",
    "failed-precondition":
      "A consulta não pôde ser concluída. Confira os índices do Firestore; o detalhe está no Console do navegador.",
    unavailable:
      "Não foi possível conectar ao Firebase. Verifique a conexão e tente novamente.",
    unauthenticated:
      "Sua sessão não foi reconhecida. Saia do painel e entre novamente.",
    "resource-exhausted":
      "O Firebase atingiu um limite de uso. Confira a cota do projeto.",
  };
  const mensagem =
    mensagens[codigo] ||
    "Não foi possível carregar o estoque. Consulte o detalhe no Console do navegador.";
  return codigo ? `${mensagem} (${codigo})` : mensagem;
}

function numeroNaoNegativo(valor, campo) {
  if (
    valor === "" ||
    valor === null ||
    !Number.isFinite(Number(valor)) ||
    Number(valor) < 0
  ) {
    throw new Error(`${campo} deve ser um número igual ou maior que zero.`);
  }
  return Number(valor);
}

function dadosDoItem(dados, novo) {
  if (!dados.nome?.trim()) throw new Error("Informe o nome do item.");
  if (dados.nome.trim().length > 160 || String(dados.categoria || '').length > 100 ||
    !['kg', 'l', 'un', 'cx', 'pct'].includes(dados.unidade || 'kg') ||
    String(dados.localArmazenamento || '').length > 300)
    throw new Error('Confira nome, categoria, unidade e local de armazenamento.');
  const payload = {
    nome: dados.nome.trim(),
    categoria: dados.categoria,
    unidade: dados.unidade,
    quantidadeMinima: numeroNaoNegativo(
      dados.quantidadeMinima,
      "Quantidade mínima",
    ),
    precoUnitario: numeroNaoNegativo(dados.precoUnitario ?? 0, "Preço"),
    validade: dados.validade || null,
    localArmazenamento: dados.localArmazenamento?.trim() || "",
  };
  if (novo)
    payload.quantidadeAtual = numeroNaoNegativo(
      dados.quantidadeAtual ?? 0,
      "Quantidade inicial",
    );
  return payload;
}

export function useEstoque(escolaId, diasValidade = 15) {
  const itens = ref([]);
  const carregando = ref(false);
  const erro = ref("");
  const { exigirUsuario } = useAuth();
  let unsubscribe;
  let geracao = 0;
  const itensAbaixoDoMinimo = computed(() =>
    itens.value.filter((i) => i.quantidadeAtual <= i.quantidadeMinima),
  );
  const itensProximosDoVencimento = computed(() =>
    itens.value.filter((i) => {
      if (!i.validade || i.quantidadeAtual <= 0) return false;
      const ms = i.validade.toMillis
        ? i.validade.toMillis()
        : new Date(i.validade).getTime();
      return ms <= Date.now() + Math.min(90,Math.max(1,Number(toValue(diasValidade))||15)) * 86400000;
    }),
  );
  const valorTotalEstoque = computed(() =>
    itens.value.reduce(
      (s, i) => s + (i.quantidadeAtual || 0) * (i.precoUnitario || 0),
      0,
    ),
  );

  function parar() {
    geracao += 1;
    unsubscribe?.();
    unsubscribe = null;
    itens.value = [];
    carregando.value = false;
  }
  function escutarEstoque() {
    parar();
    erro.value = "";
    const id = toValue(escolaId);
    if (!id) return;
    carregando.value = true;
    const atual = geracao;
    // A ordenação por nome é feita localmente para dispensar o índice composto.
    const q = query(
      collection(db, "escolas", id, "estoque"),
      where("ativo", "==", true),
    );
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (atual !== geracao) return;
        itens.value = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .sort((a, b) =>
            String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
          );
        carregando.value = false;
      },
      (falha) => {
        if (atual !== geracao) return;
        console.error("Consulta de estoque falhou:", falha);
        itens.value = [];
        erro.value = mensagemErroConsulta(falha);
        carregando.value = false;
      },
    );
  }

  async function cadastrarItem(dados) {
    const id = toValue(escolaId);
    const usuario = exigirUsuario(id, true);
    const payload = {
      ...dadosDoItem(dados, true),
      ativo: true,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuario.uid,
    };
    const refDoc = doc(collection(db, "escolas", id, "estoque"));
    const batch = writeBatch(db);
    batch.set(refDoc, payload);

    await batch.commit();
    return refDoc.id;
  }

  async function editarItem(itemId, dadosAntes, dadosNovos) {
    const id = toValue(escolaId);
    const usuario = exigirUsuario(id, true);
    const itemRef = doc(db, "escolas", id, "estoque", itemId);

    // Nunca sobrescrever quantidadeAtual com uma cópia antiga do formulário.
    const payload = {
      ...dadosDoItem(dadosNovos, false),
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuario.uid,
    };
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists()) throw new Error("Item não encontrado.");
      tx.update(itemRef, payload);
    });
  }

  async function inativarItem(itemId, _dadosAntes) {
    const id = toValue(escolaId);
    exigirUsuario(id, true);
    const batch = writeBatch(db);
    batch.update(doc(db, "escolas", id, "estoque", itemId), { ativo: false });

    await batch.commit();
  }

  async function registrarMovimentacao({
    movimentacaoId,
    itemId,
    tipo,
    quantidade,
    motivo,
    notaFiscal = null,
    fornecedorId = null,
    observacoes = "",
    assinatura,
  }) {
    const id = toValue(escolaId);
    const usuario = exigirUsuario(id, true);
    if (!["entrada", "saida", "perda", "estorno"].includes(tipo))
      throw new Error("Tipo de movimentação inválido.");
    const qtd = numeroNaoNegativo(quantidade, "Quantidade");
    if (
      qtd < 0.000001 ||
      Math.abs(qtd - Math.round(qtd * 1000000) / 1000000) >
        Number.EPSILON * Math.max(1, qtd)
    )
      throw new Error(
        "Informe uma quantidade maior que zero, com até seis casas decimais.",
      );
    if (!motivo?.trim()) throw new Error("Informe o motivo da movimentação.");
    if (motivo.length > 1000 || String(observacoes || '').length > 3000 ||
      String(notaFiscal || '').length > 200 || String(fornecedorId || '').length > 128)
      throw new Error('Os textos da movimentação excedem o limite permitido.');
    if (!movimentacaoId)
      throw new Error("Confirme a identificação da movimentação.");
    validarIdentificacaoPreparada(assinatura, {
      escolaId: id,
      documentoId: movimentacaoId,
      documentoTipo: "movimentacao",
      usuarioId: usuario.uid,
    });
    const itemRef = doc(db, "escolas", id, "estoque", itemId);
    const movRef = doc(db, "escolas", id, "movimentacoes", movimentacaoId);

    const resultado = await executarComPrazo(
      (conferirAtiva) =>
        runTransaction(db, async (tx) => {
          tx.definirVerificacao(conferirAtiva);
          conferirAtiva();
          const existente = await tx.get(movRef);
          conferirAtiva();
          // A mesma confirmação pode ser reenviada após uma queda de conexão.
          if (existente.exists())
            return { movimentacao: { ...existente.data(), id: movRef.id } };
          const snap = await tx.get(itemRef);
          conferirAtiva();
          if (!snap.exists() || !snap.data().ativo)
            throw new Error("Item de estoque não encontrado ou inativo.");
          const item = snap.data();
          const anterior = numeroNaoNegativo(
            item.quantidadeAtual ?? 0,
            "Saldo",
          );
          const saldo =
            Math.round(
              (anterior +
                (["entrada", "estorno"].includes(tipo) ? qtd : -qtd)) *
                1000000,
            ) / 1000000;
          if (saldo < 0)
            throw new Error(
              `Quantidade insuficiente. Disponível: ${anterior} ${item.unidade}.`,
            );
          const movimentacao = {
            tipo,
            itemId,
            itemNome: item.nome,
            quantidade: qtd,
            quantidadeAnterior: anterior,
            quantidadeResultante: saldo,
            motivo: motivo?.trim() || "",
            notaFiscal,
            fornecedorId,
            responsavelId: usuario.uid,
            responsavelNome: assinatura.payload.nomeSignatario,
            registradoPorNome: usuario.nome,
            metodoConfirmacao: "identificacao_cpf",
            identificacaoResponsavel: resumirIdentificacao(assinatura.payload),
            assinaturaId: assinatura.id,
            observacoes,
            data: Timestamp.now(),
          };
          tx.update(itemRef, {
            quantidadeAtual: saldo,
            ultimaMovimentacaoId: movRef.id,
            atualizadoEm: serverTimestamp(),
            atualizadoPor: usuario.uid,
          });
          tx.set(assinatura.referencia, assinatura.payload);
          tx.set(movRef, movimentacao);

          return {
            movimentacao: { ...movimentacao, id: movRef.id },
            item: { ...item, quantidadeAtual: saldo },
          };
        }),
      {
        mensagem:
          "O banco não confirmou a movimentação em 45 segundos. Tente novamente nesta tela para conferir o mesmo registro.",
        codigo: "movimentacao/timeout",
      },
    );
    if (
      resultado.item &&
      resultado.item.quantidadeAtual <= resultado.item.quantidadeMinima
    ) {
      // Uma falha de alerta não pode transformar um lançamento confirmado em erro.
      criarNotificacao({
        tipo: "estoque_baixo",
        escolaId: id,
        origemId: resultado.movimentacao.id,
        titulo: `Estoque baixo: ${resultado.item.nome}`,
        mensagem: `Restam ${resultado.item.quantidadeAtual} ${resultado.item.unidade}.`,
      }).catch((e) => console.warn("Alerta de estoque não enviado:", e.code));
    }
    return resultado.movimentacao;
  }
  return {
    itens,
    carregando,
    erro,
    itensAbaixoDoMinimo,
    itensProximosDoVencimento,
    valorTotalEstoque,
    escutarEstoque,
    cadastrarItem,
    editarItem,
    inativarItem,
    registrarMovimentacao,
    parar,
  };
}
