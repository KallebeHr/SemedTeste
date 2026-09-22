<template>
  <form @submit.prevent="salvar">
    <fieldset class="estoque-form" :disabled="salvando">
      <label class="campo">
        <span>Nome do item</span>
        <input v-model="form.nome" type="text" maxlength="160" required />
      </label>

      <label class="campo">
        <span>Categoria</span>
        <select v-model="form.categoria" required>
          <option
            v-for="categoria in categoriasDisponiveis"
            :key="categoria"
            :value="categoria"
          >
            {{ categoria }}
          </option>
        </select>
      </label>

      <label class="campo">
        <span>Unidade</span>
        <select
          v-model="form.unidade"
          :disabled="
            !!itemExistente &&
            (itemExistente.quantidadeAtual > 0 ||
              !!itemExistente.ultimaMovimentacaoId)
          "
          required
        >
          <option value="kg">kg</option>
          <option value="l">litro</option>
          <option value="un">unidade</option>
          <option value="cx">caixa</option>
          <option value="pct">pacote</option>
        </select>
      </label>

      <label v-if="!itemExistente" class="campo">
        <span>Quantidade inicial</span>
        <input
          v-model.number="form.quantidadeAtual"
          type="number"
          min="0"
          step="0.000001"
        />
      </label>

      <label class="campo">
        <span>Quantidade mínima (alerta)</span>
        <input
          v-model.number="form.quantidadeMinima"
          type="number"
          min="0"
          step="0.000001"
          required
        />
      </label>

      <label class="campo">
        <span>Validade</span>
        <input v-model="form.validade" type="date" />
      </label>

      <label class="campo">
        <span>Preço unitário (R$)</span>
        <input
          v-model.number="form.precoUnitario"
          type="number"
          min="0"
          step="0.000001"
        />
      </label>

      <label class="campo campo--largo">
        <span>Local de armazenamento</span>
        <input
          v-model="form.localArmazenamento"
          type="text"
          maxlength="300"
          placeholder="Ex.: Depósito central, corredor 1, prateleira B"
        />
      </label>

      <p v-if="erro" class="campo--largo" role="alert" style="color: #b42318">
        {{ erro }}
      </p>
      <p v-if="itemExistente" class="campo--largo">
        Para alterar o saldo, use Entrada, Retirada, Perda ou Conferir saldo. A
        unidade de medida fica protegida quando o item tem saldo ou
        movimentações.
      </p>
      <p v-if="!itemExistente" class="campo--largo">
        A quantidade inicial representa o saldo de implantação. Depois do
        cadastro, use as movimentações para registrar recebimentos e retiradas.
        Produtos com validades diferentes devem ter cadastros separados e nomes
        que identifiquem o lote.
      </p>
      <div class="estoque-form__acoes">
        <button
          type="button"
          class="btn-secundario"
          :disabled="salvando"
          @click="$emit('cancelar')"
        >
          Cancelar
        </button>
        <button type="submit" class="btn-primario" :disabled="salvando">
          {{ salvando ? "Salvando..." : "Salvar item" }}
        </button>
      </div>
    </fieldset>
  </form>
</template>

<script setup>
import { ref, computed } from "vue";
import { useParametros } from "../../composables/useParametros";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
import { Timestamp } from "firebase/firestore";
import { useEstoque } from "../../composables/useEstoque";

const props = defineProps({
  escolaId: { type: String, required: true },
  itemExistente: { type: Object, default: null },
});
const emit = defineEmits(["salvo", "cancelar", "ocupado"]);

const form = ref(
  props.itemExistente
    ? {
        ...props.itemExistente,
        validade: dataParaInput(props.itemExistente.validade),
      }
    : {
        nome: "",
        categoria: "nao_perecivel",
        unidade: "kg",
        quantidadeAtual: 0,
        quantidadeMinima: 0,
        validade: "",
        precoUnitario: 0,
        localArmazenamento: "",
      },
);
const salvando = ref(false);
const erro = ref("");
const inicial = JSON.stringify(form.value),
  concluido = ref(false);
useSaidaSegura(
  () => !concluido.value && JSON.stringify(form.value) !== inicial,
);
const { categorias } = useParametros();
const categoriasDisponiveis = computed(() => [
  ...new Set([...categorias.value, form.value.categoria].filter(Boolean)),
]);

const { cadastrarItem, editarItem } = useEstoque(props.escolaId);

function dataParaInput(validade) {
  if (!validade) return "";
  const data = validade.toDate ? validade.toDate() : new Date(validade);
  return data.toISOString().slice(0, 10);
}

async function salvar() {
  if (salvando.value) return;
  salvando.value = true;
  emit("ocupado", true);
  erro.value = "";
  try {
    const payload = {
      ...form.value,
      validade: form.value.validade
        ? Timestamp.fromDate(new Date(form.value.validade + "T12:00:00"))
        : null,
    };
    if (props.itemExistente) {
      const { id, ...antes } = props.itemExistente;
      await editarItem(id, antes, payload);
    } else {
      await cadastrarItem(payload);
    }
    emit("ocupado", false);
    concluido.value = true;
    emit("salvo");
  } catch (e) {
    erro.value = e.code
      ? "Não foi possível salvar o item. Verifique a conexão e as permissões."
      : e.message;
  } finally {
    salvando.value = false;
    emit("ocupado", false);
  }
}
</script>

<style scoped>
.estoque-form {
  border: 0;
  padding: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}
@media (max-width: 640px) {
  .estoque-form {
    border: 0;
    padding: 0;
    min-width: 0;
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
.campo select {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  font-size: 0.9rem;
}
.estoque-form__acoes {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
.btn-primario,
.btn-secundario {
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-primario {
  background: var(--cor-primaria, #3c6e47);
  color: #fff;
}
.btn-primario:disabled {
  opacity: 0.6;
}
.btn-secundario {
  background: transparent;
  border: 1px solid var(--cor-borda, #d9dee3);
  color: var(--cor-texto-suave, #52606d);
}
</style>
