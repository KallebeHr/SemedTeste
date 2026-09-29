<template>
  <section class="entrega-form" aria-labelledby="titulo-entrega">
    <h2 id="titulo-entrega">
      {{
        entrega
          ? "Confirmar alimentação recebida"
          : "Registrar alimentação enviada"
      }}
    </h2>
    <p>
      {{
        entrega
          ? `${entrega.codigo} · ${entrega.escolaNome}`
          : "Depósito Municipal → escola. A confirmação fará a baixa do depósito."
      }}
    </p>
    <form @submit.prevent="revisar">
      <fieldset :disabled="busy || bloqueado || resumo">
        <label v-if="!entrega"
          >Escola de destino<select
            v-model="destino"
            required
            :disabled="fotos.length > 0"
          >
            <option value="">Selecione</option>
            <option
              v-for="e in escolas.filter(
                (e) => e.id !== 'deposito-municipal' && e.ativo !== false,
              )"
              :key="e.id"
              :value="e.id"
            >
              {{ e.nome }}
            </option></select
          ><small v-if="fotos.length"
            >Remova as fotos antes de mudar o destino.</small
          ></label
        >
        <p v-if="carregando" role="status">Carregando estoque…</p>
        <p v-if="erroEstoque" role="alert">{{ erroEstoque }}</p>
        <div v-for="(linha, n) in linhas" :key="n" class="produto-linha">
          <template v-if="!entrega">
            <label
              >Produto<select v-model="linha.itemId" required>
                <option value="">Selecione</option>
                <option v-for="i in itens" :key="i.id" :value="i.id">
                  {{ i.nome }} · {{ i.quantidadeAtual }} {{ i.unidade }}
                </option>
              </select></label
            >
            <label
              >Quantidade<input
                v-model.number="linha.quantidade"
                type="number"
                min="0.000001"
                step="0.000001"
                required
            /></label>
            <label
              >Lote (se utilizado)<input v-model="linha.lote" maxlength="100"
            /></label>
            <label
              >Observação do produto<input
                v-model="linha.observacao"
                maxlength="500"
            /></label>
            <button
              type="button"
              :disabled="linhas.length === 1"
              @click="linhas.splice(n, 1)"
            >
              Remover produto
            </button>
          </template>
          <template v-else>
            <h3>
              {{ entrega.itens[n].nome }} · enviados
              {{ entrega.itens[n].quantidade }} {{ entrega.itens[n].unidade }}
            </h3>
            <label
              >Quantidade aceita no estoque<input
                v-model.number="linha.quantidadeRecebida"
                type="number"
                min="0"
                :max="entrega.itens[n].quantidade"
                step="0.000001"
                required
            /></label>
            <label
              >Item no estoque da escola<select v-model="linha.destinoItemId">
                <option value="">Criar / reutilizar item desta origem</option>
                <option :value="novosIds[n]">
                  Criar item separado para este lote
                </option>
                <option
                  v-for="i in itens.filter(
                    (i) =>
                      i.unidade === entrega.itens[n].unidade &&
                      i.nome === entrega.itens[n].nome,
                  )"
                  :key="i.id"
                  :value="i.id"
                >
                  {{ i.nome }} · {{ i.quantidadeAtual }} {{ i.unidade }} · lote
                  {{ i.lote || "não informado" }}
                </option>
              </select></label
            >
            <label
              >Motivo da divergência<select
                v-model="linha.motivo"
                :required="
                  linha.quantidadeRecebida !== entrega.itens[n].quantidade
                "
              >
                <option value="">Sem divergência</option>
                <option v-for="m in motivos" :key="m">{{ m }}</option>
              </select></label
            >
            <label
              >Detalhe da divergência<input
                v-model="linha.detalhe"
                maxlength="500"
                :required="linha.motivo === 'outro'"
            /></label>
          </template>
        </div>
        <button
          v-if="!entrega"
          type="button"
          :disabled="linhas.length >= 20"
          @click="linhas.push(novaLinha())"
        >
          + Adicionar produto
        </button>
        <label
          >Observações<textarea
            v-model="observacao"
            maxlength="3000"
            rows="3"
          />
        </label>
        <label
          >Nome completo do responsável<input
            v-model="nome"
            maxlength="160"
            required
            autocomplete="name"
        /></label>
        <label
          >CPF do responsável<input
            v-model="cpf"
            maxlength="14"
            inputmode="numeric"
            required
            autocomplete="off"
        /></label>
      </fieldset>
      <FotosEntrega
        v-if="destino"
        v-model="fotos"
        :disabled="busy || bloqueado || resumo"
        @preparando="preparando = $event"
      />
      <button
        v-if="!resumo && !bloqueado"
        type="submit"
        :disabled="busy || preparando || carregando || !!erroEstoque"
      >
        Revisar {{ entrega ? "recebimento" : "envio" }}
      </button>
    </form>
    <div
      v-if="resumo || bloqueado"
      class="revisao"
      role="region"
      aria-label="Resumo para confirmação"
    >
      <h3>Confira antes de confirmar</h3>
      <p>
        {{ entrega?.escolaNome || escolas.find((e) => e.id === destino)?.nome }}
        · {{ linhas.length }} produtos · {{ fotos.length }} comprovantes
      </p>
      <ul>
        <li v-for="(i, n) in linhas" :key="n">
          {{
            entrega
              ? entrega.itens[n].nome
              : itens.find((p) => p.id === i.itemId)?.nome
          }}: {{ entrega ? i.quantidadeRecebida : i.quantidade }}
          {{
            entrega
              ? entrega.itens[n].unidade
              : itens.find((p) => p.id === i.itemId)?.unidade
          }}
        </li>
      </ul>
      <p>
        {{
          entrega
            ? "O estoque da escola receberá somente as quantidades aceitas acima."
            : "As quantidades acima serão retiradas do depósito. A escola deverá confirmar o recebimento."
        }}
      </p>
      <button v-if="!bloqueado" :disabled="busy" @click="resumo = false">
        Voltar e corrigir
      </button>
      <button :disabled="busy || preparando" @click="salvar">
        {{
          busy
            ? "Enviando comprovantes e registrando…"
            : bloqueado
              ? "Tentar confirmar a mesma operação"
              : entrega
                ? "Confirmar que recebi"
                : "Confirmar envio"
        }}
      </button>
    </div>
    <p v-if="erro" role="alert">{{ erro }}</p>
    <button
      :disabled="busy || preparando || bloqueado"
      @click="confirmarAlteracoes() && $emit('fechar')"
    >
      Fechar formulário
    </button>
    <p v-if="bloqueado">
      Se a conexão caiu, tente novamente nesta tela. O identificador é
      preservado para evitar duplicação.
    </p>
  </section>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useEstoque } from "../../composables/useEstoque";
import { useAuth } from "../../composables/useAuth";
import {
  useSaidaSegura,
  confirmarAlteracoes,
} from "../../composables/useSaidaSegura";
import {
  cpfValido,
  normalizarCpf,
  normalizarNome,
} from "../../utils/identificacao";
import { alimentacaoApi } from "../../services/alimentacaoApi";
import { enviarFotos } from "../../services/fotosEntrega";
import FotosEntrega from "./FotosEntrega.vue";
const props = defineProps({
  escolas: { type: Array, default: () => [] },
  entrega: { type: Object, default: null },
});
const emit = defineEmits(["concluido", "fechar", "ocupado"]);
const { usuario } = useAuth();
const destino = ref(props.entrega?.escolaId || "");
const {
  itens,
  carregando,
  erro: erroEstoque,
  escutarEstoque,
  parar,
} = useEstoque(props.entrega?.escolaId || "deposito-municipal");
const novaLinha = () => ({
  itemId: "",
  quantidade: null,
  lote: "",
  observacao: "",
});
const linhas = ref(
  props.entrega
    ? props.entrega.itens.map((i) => ({
        itemId: i.itemId,
        quantidadeRecebida: i.quantidade,
        destinoItemId: "",
        motivo: "",
        detalhe: "",
      }))
    : [novaLinha()],
);
const novosIds = linhas.value.map(() => crypto.randomUUID());
const motivos = [
  "quantidade diferente",
  "produto danificado",
  "produto vencido",
  "embalagem violada",
  "item não recebido",
  "produto diferente",
  "outro",
];
const fotos = ref([]),
  observacao = ref(""),
  nome = ref(usuario.value?.nome || ""),
  cpf = ref(""),
  erro = ref(""),
  resumo = ref(false),
  busy = ref(false),
  preparando = ref(false),
  bloqueado = ref(false),
  concluido = ref(false);
const id = props.entrega?.id || crypto.randomUUID();
let payload;
useSaidaSegura(
  () =>
    !concluido.value &&
    (fotos.value.length > 0 ||
      linhas.value.some((i) => i.itemId) ||
      !!cpf.value),
);
onMounted(escutarEstoque);
onUnmounted(parar);
function revisar() {
  erro.value = "";
  if (
    !destino.value ||
    !linhas.value.length ||
    linhas.value.some((i) => !i.itemId)
  ) {
    erro.value = "Escolha a escola e os produtos.";
    return;
  }
  if (
    !cpfValido(cpf.value) ||
    normalizarNome(nome.value).split(" ").length < 2
  ) {
    erro.value = "Confira nome completo e CPF.";
    return;
  }
  resumo.value = true;
}
async function salvar() {
  if (busy.value) return;
  busy.value = true;
  emit("ocupado", true);
  erro.value = "";
  try {
    const ids = await enviarFotos(destino.value, fotos.value);
    if (!payload)
      payload = {
        acao: props.entrega ? "receberEntrega" : "enviarEntrega",
        id,
        escolaId: destino.value,
        itens: JSON.parse(JSON.stringify(linhas.value)),
        fotos: ids,
        responsavel: {
          nome: normalizarNome(nome.value),
          cpf: normalizarCpf(cpf.value),
        },
        observacao: observacao.value,
      };
    bloqueado.value = true;
    const resultado = await alimentacaoApi(payload);
    concluido.value = true;
    emit("concluido", resultado);
  } catch (e) {
    erro.value = e.message;
    if (e.status >= 400 && e.status < 500) {
      bloqueado.value = false;
      resumo.value = false;
      payload = null;
    }
  } finally {
    busy.value = false;
    emit("ocupado", false);
  }
}
</script>
<style scoped>
.entrega-form {
  max-width: 900px;
}
fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
label {
  display: grid;
  gap: 6px;
  margin: 14px 0;
}
input,
select,
textarea {
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 1px solid #8b9b94;
  border-radius: 6px;
  background: #fff;
  color: #172e24;
  font: inherit;
}
button {
  min-height: 44px;
  padding: 10px 16px;
  margin: 6px 8px 6px 0;
  border: 1px solid #426d59;
  border-radius: 6px;
  color: #183e2b;
  background: #edf4ef;
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.produto-linha,
.revisao {
  padding: 16px;
  border: 1px solid #ccd8d0;
  margin: 16px 0;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
[role="alert"] {
  color: #a42121;
}
h3 {
  font-size: 1.05rem;
}
:focus-visible {
  outline: 3px solid #b96d12;
  outline-offset: 3px;
}
</style>
