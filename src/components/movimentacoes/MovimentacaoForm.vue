<template>
  <div class="mov-form">
    <p v-if="sucesso" role="status" class="mov-form__sucesso">
      Movimentação registrada com sucesso. O saldo do estoque foi atualizado.
    </p>
    <h3>
      {{
        conferencia ? "Conferir quantidade física" : "Registrar movimentação"
      }}
    </h3>
    <p>
      {{
        conferencia
          ? "Conte o produto e informe a quantidade encontrada. O sistema registra apenas a diferença, com motivo e identificação."
          : "Escolha o item, informe a quantidade e confira o saldo antes de confirmar."
      }}
    </p>
    <div v-if="etapa === 'form' && !conferencia" class="mov-form__tabs">
      <button :class="{ ativo: tipo === 'entrada' }" @click="tipo = 'entrada'">
        Entrada
      </button>
      <button :class="{ ativo: tipo === 'saida' }" @click="tipo = 'saida'">
        Saída
      </button>
      <button :class="{ ativo: tipo === 'perda' }" @click="tipo = 'perda'">
        Perda / descarte
      </button>
    </div>

    <form
      v-if="etapa === 'form'"
      class="mov-form__campos"
      @submit.prevent="avancar"
    >
      <label class="campo">
        <span>Item</span>
        <select v-model="itemId" required>
          <option value="" disabled>Selecione um item</option>
          <option v-for="item in itens" :key="item.id" :value="item.id">
            {{ item.nome }} ({{ item.quantidadeAtual }}{{ item.unidade }} em
            estoque)
          </option>
        </select>
      </label>

      <label class="campo">
        <span
          >{{
            conferencia ? "Quantidade contada" : "Quantidade a movimentar"
          }}
          ({{ unidadeSelecionada }})</span
        >
        <input
          v-model.number="quantidade"
          type="number"
          :min="conferencia ? 0 : 0.000001"
          step="0.000001"
          required
        />
      </label>

      <label v-if="tipo === 'entrada' && !conferencia" class="campo">
        <span>Nota fiscal</span>
        <input
          v-model="notaFiscal"
          maxlength="200"
          type="text"
          placeholder="Nº da nota fiscal"
        />
      </label>

      <label v-if="tipo === 'entrada' && !conferencia" class="campo">
        <span>Fornecedor</span>
        <select v-model="fornecedorId">
          <option value="">Não informado</option>
          <option v-for="f in fornecedores" :key="f.id" :value="f.id">
            {{ f.nome }}
          </option>
        </select>
      </label>

      <div
        v-if="itemSelecionado"
        class="saldo-resumo campo--largo"
        role="status"
      >
        <span
          >Saldo atual:
          <strong
            >{{ numeroEstoque(itemSelecionado.quantidadeAtual) }}
            {{ unidadeSelecionada }}</strong
          ></span
        ><span
          >Saldo previsto:
          <strong>{{ saldoPrevisto }} {{ unidadeSelecionada }}</strong></span
        >
      </div>
      <label
        v-if="tipo === 'saida' && !conferencia && escolasDestino.length"
        class="campo campo--largo"
        ><span>Destino da retirada (opcional)</span
        ><select v-model="destinoId">
          <option value="">Outro destino / consumo local</option>
          <option v-for="e in escolasDestino" :key="e.id" :value="e.id">
            {{ e.nome }}
          </option></select
        ><small
          >Registra o destino no histórico desta retirada. A escola deve
          registrar a entrada após conferir o recebimento.</small
        ></label
      >
      <label class="campo campo--largo">
        <span>Motivo</span>
        <input
          v-model="motivo"
          maxlength="800"
          type="text"
          :placeholder="
            tipo === 'saida'
              ? 'Ex.: Preparo do almoço de hoje'
              : 'Ex.: Recebimento de fornecedor'
          "
          required
        />
      </label>

      <label class="campo campo--largo">
        <span>Observações (opcional)</span>
        <textarea v-model="observacoes" maxlength="2500" rows="2" />
      </label>

      <div class="mov-form__acoes">
        <button type="submit" class="btn-primario" :disabled="processando">
          Continuar para identificação
        </button>
      </div>
    </form>

    <p v-if="erro" class="mov-form__erro" role="alert">{{ erro }}</p>

    <!-- Identificação e confirmação da movimentação -->
    <div v-if="etapa === 'assinatura'" class="mov-form__assinatura">
      <h4>Identifique o responsável</h4>
      <p class="resumo">
        {{ rotuloTipo }} de
        <strong
          >{{ dadosConfirmados?.quantidade }} {{ unidadeSelecionada }}</strong
        >
        —
        {{ itemSelecionado?.nome }}
      </p>
      <AssinaturaDigital
        v-if="!identificacao"
        :enviando="processando"
        :nome-padrao="rascunho?.nomeSignatario || usuario?.nome || ''"
        :cpf-padrao="rascunho?.cpf || ''"
        :papel-padrao="rascunho?.papelSignatario || usuario?.papel || 'gerente'"
        @confirmar="confirmarPessoa"
      />
      <div v-else class="identificacao-confirmada">
        <p>
          <strong>{{ identificacao.nomeSignatario }}</strong> · CPF
          {{ mascararCpf(identificacao.cpf) }}
        </p>
        <button
          v-if="!tentouSalvar"
          type="button"
          class="btn-secundario"
          :disabled="processando"
          @click="editarPessoa"
        >
          Editar identificação
        </button>
        <button
          type="button"
          class="btn-primario"
          :disabled="processando"
          @click="finalizar"
        >
          {{
            processando
              ? "Registrando movimentação…"
              : tentouSalvar
                ? "Tentar salvar novamente"
                : "Salvar movimentação"
          }}
        </button>
      </div>
      <button
        v-if="!tentouSalvar"
        type="button"
        class="btn-secundario"
        @click="voltar"
      >
        Voltar aos dados
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  numeroEstoque,
  saldoApos,
  ajusteConferencia,
  quantidadeValida,
} from "../../utils/estoque";
import { ref, computed } from "vue";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
import { collection, doc } from "firebase/firestore";
import { db } from "../../firebase";
import AssinaturaDigital from "../assinatura/AssinaturaDigital.vue";
import { useEstoque } from "../../composables/useEstoque";
import { useAssinaturas } from "../../composables/useAssinaturas";
import { useAuth } from "../../composables/useAuth";
import { validarIdentificacao, mascararCpf } from "../../utils/identificacao";

const props = defineProps({
  escolaId: { type: String, required: true },
  itens: { type: Array, default: () => [] },
  fornecedores: { type: Array, default: () => [] },
  itemInicial: { type: String, default: "" },
  tipoInicial: { type: String, default: "entrada" },
  escolasDestino: { type: Array, default: () => [] },
});
const emit = defineEmits(["concluido", "ocupado"]);
const conferencia = props.tipoInicial === "conferencia";
const tipo = ref(
  ["entrada", "saida", "perda"].includes(props.tipoInicial)
    ? props.tipoInicial
    : "entrada",
);
const itemId = ref(props.itemInicial),
  destinoId = ref("");
const quantidade = ref(null);
const notaFiscal = ref("");
const fornecedorId = ref("");
const motivo = ref("");
const observacoes = ref("");
const erro = ref("");
const etapa = ref("form");
const processando = ref(false);
const identificacao = ref(null),
  rascunho = ref(null),
  sucesso = ref(false);
useSaidaSegura(
  () =>
    !sucesso.value &&
    (!!itemId.value ||
      !!quantidade.value ||
      !!motivo.value ||
      etapa.value !== "form"),
);
const { usuario } = useAuth();
const tentouSalvar = ref(false);
let assinaturaPreparada;
let movimentacaoId;
let dadosConfirmados;
const { registrarMovimentacao } = useEstoque(props.escolaId);
const { prepararIdentificacao } = useAssinaturas(props.escolaId);
const itemSelecionado = computed(() =>
  props.itens.find((i) => i.id === itemId.value),
);
const unidadeSelecionada = computed(() => itemSelecionado.value?.unidade ?? "");
const saldoPrevisto = computed(() => {
  try {
    return numeroEstoque(
      conferencia
        ? quantidadeValida(quantidade.value)
        : saldoApos(
            itemSelecionado.value?.quantidadeAtual,
            tipo.value,
            quantidade.value,
          ),
    );
  } catch {
    return "—";
  }
});
const rotuloTipo = computed(() =>
  conferencia
    ? "Ajuste de saldo"
    : { entrada: "Entrada", saida: "Saída", perda: "Perda/descarte" }[
        tipo.value
      ],
);

function avancar() {
  erro.value = "";
  sucesso.value = false;
  if (!motivo.value.trim()) {
    erro.value = "Informe o motivo da movimentação.";
    return;
  }
  if (
    !itemSelecionado.value ||
    !Number.isFinite(Number(quantidade.value)) ||
    (conferencia
      ? quantidade.value === null || Number(quantidade.value) < 0
      : Number(quantidade.value) <= 0)
  ) {
    erro.value = "Selecione um item e informe uma quantidade maior que zero.";
    return;
  }
  if (
    !conferencia &&
    tipo.value !== "entrada" &&
    quantidade.value > itemSelecionado.value.quantidadeAtual
  ) {
    erro.value = `Quantidade maior que o disponível (${itemSelecionado.value.quantidadeAtual} ${unidadeSelecionada.value}).`;
    return;
  }
  let ajustes;
  try {
    ajustes = conferencia
      ? ajusteConferencia(
          itemSelecionado.value.quantidadeAtual,
          quantidade.value,
        )
      : {
          tipo: tipo.value,
          quantidade: quantidadeValida(quantidade.value, "Quantidade", false),
        };
    saldoApos(
      itemSelecionado.value.quantidadeAtual,
      ajustes.tipo,
      ajustes.quantidade,
    );
  } catch (e) {
    erro.value = e.message;
    return;
  }
  movimentacaoId = doc(
    collection(db, "escolas", props.escolaId, "movimentacoes"),
  ).id;
  dadosConfirmados = {
    itemId: itemId.value,
    ...ajustes,
    motivo:
      (conferencia
        ? `Conferência física: saldo anterior ${itemSelecionado.value.quantidadeAtual}; contado ${quantidade.value}. `
        : "") + motivo.value.trim(),
    notaFiscal:
      !conferencia && tipo.value === "entrada"
        ? notaFiscal.value || null
        : null,
    fornecedorId:
      !conferencia && tipo.value === "entrada"
        ? fornecedorId.value || null
        : null,
    observacoes: [
      observacoes.value,
      destinoId.value && tipo.value === "saida" && !conferencia
        ? `Destino: ${props.escolasDestino.find((e) => e.id === destinoId.value)?.nome || destinoId.value} (ID: ${destinoId.value}). Confirmar recebimento separadamente.`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
  assinaturaPreparada = null;
  identificacao.value = null;
  tentouSalvar.value = false;
  etapa.value = "assinatura";
}

function confirmarPessoa(dados) {
  if (processando.value || tentouSalvar.value) return;
  try {
    identificacao.value = validarIdentificacao(dados);
    assinaturaPreparada = null;
    erro.value = "";
  } catch (e) {
    erro.value = e.message;
  }
}
function editarPessoa() {
  if (!processando.value && !tentouSalvar.value) {
    rascunho.value = identificacao.value;
    identificacao.value = null;
    assinaturaPreparada = null;
  }
}
function voltar() {
  if (!processando.value && !tentouSalvar.value) {
    etapa.value = "form";
    erro.value = "";
  }
}
async function finalizar() {
  if (processando.value || !identificacao.value) return;
  processando.value = true;
  emit("ocupado", true);
  erro.value = "";
  try {
    if (!assinaturaPreparada) {
      assinaturaPreparada = await prepararIdentificacao(
        identificacao.value,
        {
          cargoDocumento: rotuloTipo.value,
          documentoTipo: "movimentacao",
          documentoId: movimentacaoId,
          documentoDados: dadosConfirmados,
        },
        `${movimentacaoId}-responsavel`,
      );
    }
    tentouSalvar.value = true;
    const movimentacao = await registrarMovimentacao({
      ...dadosConfirmados,
      movimentacaoId,
      assinatura: assinaturaPreparada,
    });
    itemId.value = "";
    quantidade.value = null;
    notaFiscal.value = "";
    fornecedorId.value = "";
    motivo.value = "";
    observacoes.value = "";
    etapa.value = "form";
    assinaturaPreparada = null;
    identificacao.value = null;
    tentouSalvar.value = false;
    emit("ocupado", false);
    sucesso.value = true;
    rascunho.value = null;
    emit("concluido", movimentacao);
  } catch (e) {
    if (e.message?.startsWith("O saldo mudou durante")) {
      tentouSalvar.value = false;
      etapa.value = "form";
      identificacao.value = null;
      assinaturaPreparada = null;
    }
    erro.value =
      e.code === "permission-denied"
        ? "O Firestore negou o registro. Confira as regras publicadas e o perfil da conta. (permission-denied)"
        : e.message ||
          "Não foi possível confirmar. Tente novamente nesta tela.";
  } finally {
    processando.value = false;
    emit("ocupado", false);
  }
}
</script>

<style scoped>
.saldo-resumo {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  background: #edf5f1;
  border-radius: 10px;
  font-size: 0.9rem;
}
.mov-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.mov-form__tabs {
  display: flex;
  gap: 0.5rem;
}
.mov-form__tabs button {
  flex: 1;
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--cor-borda, #d9dee3);
  background: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--cor-texto-suave, #52606d);
}
.mov-form__tabs button.ativo {
  background: var(--cor-primaria, #3c6e47);
  border-color: var(--cor-primaria, #3c6e47);
  color: #fff;
}
.mov-form__campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}
@media (max-width: 640px) {
  .mov-form__campos {
    grid-template-columns: 1fr;
  }
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--cor-texto-suave, #52606d);
}
.campo--largo {
  grid-column: 1 / -1;
}
.campo input,
.campo select,
.campo textarea {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: inherit;
}
.mov-form__erro {
  grid-column: 1 / -1;
  color: #c0392b;
  font-size: 0.85rem;
  margin: 0;
}
.mov-form__acoes {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}
.btn-primario {
  padding: 0.65rem 1.2rem;
  border-radius: 8px;
  border: none;
  background: var(--cor-primaria, #3c6e47);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.btn-primario:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.mov-form__assinatura {
  border-top: 1px solid var(--cor-borda, #e4e7eb);
  padding-top: 1rem;
}
.mov-form__assinatura h4 {
  margin: 0 0 0.4rem;
}
.resumo {
  font-size: 0.85rem;
  color: var(--cor-texto-suave, #52606d);
  margin-bottom: 0.75rem;
}
.mov-form__sucesso {
  padding: 1rem;
  color: #245530;
  background: #e3f3e6;
  border-radius: 8px;
}
.identificacao-confirmada {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.identificacao-confirmada p {
  flex-basis: 100%;
}
.btn-secundario {
  padding: 0.65rem 1.2rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
</style>
