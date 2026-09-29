<template>
  <section
    class="entregas-painel"
    aria-label="Movimentações entre depósito e escolas"
  >
    <EntregaForm
      v-if="formulario"
      :key="formulario.id || 'novo'"
      :escolas="escolas"
      :entrega="formulario.id ? formulario : null"
      @ocupado="$emit('ocupado', $event)"
      @fechar="formulario = null"
      @concluido="concluido"
    />
    <template v-else>
      <header class="cabecalho-entregas">
        <div>
          <h2>
            {{
              modo === "recebida"
                ? "Alimentação aguardando recebimento"
                : "Histórico de entregas"
            }}
          </h2>
          <p>Envios do depósito, confirmações das escolas e divergências.</p>
        </div>
        <button v-if="gestao" @click="formulario = {}">
          + Alimentação enviada
        </button>
      </header>
      <button
        v-if="gestao && modo === 'recebida'"
        @click="$emit('entrada-local')"
      >
        Registrar entrada de fornecedor na unidade selecionada
      </button>
      <p v-if="mensagem" role="status">{{ mensagem }}</p>
      <div
        v-if="totais"
        class="totais-entregas"
        aria-label="Resumo da unidade consultada"
      >
        <p>
          <strong>{{ totais.hoje }}</strong> envios hoje
        </p>
        <p>
          <strong>{{ totais.pendentes }}</strong> aguardando recebimento
        </p>
        <p>
          <strong>{{ totais.divergencias }}</strong> divergências abertas
        </p>
      </div>
      <div class="filtros-entregas">
        <label
          >Status<select v-model="status">
            <option value="">Todos</option>
            <option value="enviado">Aguardando recebimento</option>
            <option value="recebido">Recebido</option>
            <option value="cancelado">Cancelado</option>
          </select></label
        >
        <label
          >Escola<select v-model="unidade">
            <option v-if="gestao" value="deposito-municipal">
              Todas as escolas
            </option>
            <option
              v-for="e in escolas.filter((e) => e.id !== 'deposito-municipal')"
              :key="e.id"
              :value="e.id"
            >
              {{ e.nome }}
            </option>
          </select></label
        >
        <label
          >Código, produto ou responsável<input
            v-model="busca"
            type="search"
            maxlength="160"
            @keyup.enter="carregar(false)"
        /></label>
        <label>De<input v-model="de" type="date" /></label
        ><label>Até<input v-model="ate" type="date" /></label>
        <label
          >Divergências<select v-model="divergencia">
            <option value="">Todas</option>
            <option value="aberta">Abertas</option>
            <option value="resolvida">Resolvidas</option>
          </select></label
        >
        <button :disabled="busy || !unidade" @click="carregar(false)">
          Aplicar filtros / atualizar
        </button>
      </div>
      <p v-if="busy" role="status">Consultando entregas…</p>
      <p v-if="erro" role="alert">{{ erro }}</p>
      <p v-if="!busy && !registros.length && consultado">
        Nenhuma entrega nesta página para os filtros selecionados.
      </p>
      <ul class="lista-entregas">
        <li v-for="e in registros" :key="e.id">
          <div>
            <strong>{{ e.codigo }} · {{ e.escolaNome }}</strong>
            <p>
              {{ data(e.criadoEm) }} · {{ e.itens.length }} produtos ·
              {{ rotulo(e.status) }}
            </p>
            <p v-if="e.divergencia">Divergência {{ e.divergencia.status }}</p>
          </div>
          <button @click="abrir(e)">Ver detalhes</button
          ><button v-if="e.status === 'enviado'" @click="formulario = e">
            Confirmar recebimento
          </button>
        </li>
      </ul>
      <button v-if="cursor" :disabled="busy" @click="carregar(true)">
        Carregar próxima página
      </button>
      <p v-if="cursor">
        Há mais registros para consultar. A busca verifica até 100 registros por
        página, sem carregar fotos.
      </p>
      <section
        v-if="detalhe"
        ref="detalheEl"
        tabindex="-1"
        class="detalhe-entrega"
        aria-label="Detalhes e comprovante"
      >
        <h2>
          {{ detalhe.codigo }}
          <span v-if="detalhe.codigoRecebimento"
            >/ {{ detalhe.codigoRecebimento }}</span
          >
        </h2>
        <p>
          Secretaria Municipal de Educação · Movimentação de Alimentação Escolar
        </p>
        <p>Depósito Municipal → {{ detalhe.escolaNome }}</p>
        <p>Status: {{ rotulo(detalhe.status) }}</p>
        <p>
          Enviado por {{ detalhe.enviadoPorNome }} · responsável:
          {{ detalhe.responsavelEnvio }} · {{ data(detalhe.criadoEm) }}
        </p>
        <p v-if="detalhe.recebidoEm">
          Recebido por {{ detalhe.recebidoPorNome }} · responsável:
          {{ detalhe.responsavelRecebimento }} · {{ data(detalhe.recebidoEm) }}
        </p>
        <ul>
          <li v-for="(i, n) in detalhe.itens" :key="i.itemId">
            {{ i.nome }} — enviado {{ i.quantidade }} {{ i.unidade
            }}<span v-if="detalhe.recebidos"
              >; aceito {{ detalhe.recebidos[n].quantidadeRecebida }}
              {{ i.unidade }}</span
            ><span v-if="i.lote"> · lote {{ i.lote }}</span
            ><span v-if="i.validade"> · validade {{ data(i.validade) }}</span>
            <p v-if="i.observacao">{{ i.observacao }}</p>
            <p v-if="detalhe.recebidos?.[n].motivo">
              {{ detalhe.recebidos[n].motivo }}:
              {{ detalhe.recebidos[n].detalhe }}
            </p>
          </li>
        </ul>
        <p>{{ detalhe.observacao }}</p>
        <p>{{ detalhe.observacaoRecebimento }}</p>
        <p v-if="detalhe.motivoCancelamento">
          Cancelamento: {{ detalhe.motivoCancelamento }}
        </p>
        <p v-if="detalhe.divergencia">
          Divergência {{ detalhe.divergencia.status }}.
          {{ detalhe.divergencia.resolucao }}
        </p>
        <div class="nao-imprimir">
          <h3>Comprovantes privados</h3>
          <button
            v-for="(id, n) in [
              ...detalhe.fotosEnvio,
              ...detalhe.fotosRecebimento,
            ]"
            :key="id"
            :disabled="busy"
            @click="verFoto(id)"
          >
            Visualizar comprovante {{ n + 1 }}
          </button>
          <p
            v-if="
              !detalhe.fotosEnvio.length && !detalhe.fotosRecebimento.length
            "
          >
            Sem arquivos anexados.
          </p>
          <div v-if="preview">
            <img
              v-if="preview.mime.startsWith('image/')"
              :src="preview.url"
              alt="Comprovante da entrega"
              class="comprovante-img"
            /><a :href="preview.url" :download="preview.nome"
              >Baixar comprovante</a
            >
          </div>
          <button @click="imprimir">
            Imprimir / salvar comprovante em PDF
          </button>
          <form
            v-if="gestao && detalhe.status === 'enviado'"
            @submit.prevent="operar('cancelarEntrega')"
          >
            <label
              >Motivo do cancelamento<textarea
                v-model="providencia"
                required
                maxlength="1000"
              /></label
            ><label class="checkbox"
              ><input v-model="confirmacao" type="checkbox" required />Confirmo
              que a entrega não foi recebida e que os itens retornarão ao saldo
              do depósito.</label
            ><button :disabled="busy">
              Cancelar entrega e estornar depósito
            </button>
          </form>
          <form
            v-if="gestao && detalhe.divergencia?.status === 'aberta'"
            @submit.prevent="operar('resolverDivergencia')"
          >
            <label
              >Providência adotada<textarea
                v-model="providencia"
                required
                maxlength="2000"
              />
            </label>
            <p>
              O encerramento registra a providência; não altera quantidades de
              estoque.
            </p>
            <button :disabled="busy">Registrar solução da divergência</button>
          </form>
          <button @click="detalhe = null">Fechar detalhes</button>
        </div>
      </section>
      <section v-if="gestao" class="diagnostico">
        <h3>Armazenamento</h3>
        <button :disabled="busy" @click="testar">
          Testar API e Backblaze B2
        </button>
        <p v-if="storage" role="status">{{ storage }}</p>
      </section>
    </template>
  </section>
</template>
<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { alimentacaoApi } from "../../services/alimentacaoApi";
import EntregaForm from "./EntregaForm.vue";
const props = defineProps({
  escolaId: { type: String, required: true },
  escolas: { type: Array, default: () => [] },
  gestao: Boolean,
  modo: { type: String, default: "historico" },
});
const emit = defineEmits(["ocupado", "entrada-local"]);
const formulario = ref(props.modo === "enviada" ? {} : null),
  unidade = ref(props.escolaId),
  status = ref(props.modo === "recebida" ? "enviado" : ""),
  busca = ref(""),
  de = ref(""),
  ate = ref(""),
  divergencia = ref("");
const registros = ref([]),
  cursor = ref(null),
  busy = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  consultado = ref(false),
  detalhe = ref(null),
  detalheEl = ref(null),
  preview = ref(null),
  providencia = ref(""),
  confirmacao = ref(false),
  storage = ref("");
const totais = ref(null);
watch(busy, (v) => emit("ocupado", v));
let filtros = null;
const data = (v) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const rotulo = (v) =>
  ({
    enviado: "Aguardando recebimento",
    recebido: "Recebido",
    cancelado: "Cancelado",
  })[v] || v;
async function carregar(mais = false) {
  if (busy.value || !unidade.value) return;
  busy.value = true;
  erro.value = "";
  if (!mais) {
    filtros = {
      escolaId: unidade.value,
      status: status.value,
      busca: busca.value,
      de: de.value,
      ate: ate.value,
      divergencia: divergencia.value,
    };
    totais.value = null;
    registros.value = [];
    cursor.value = null;
  }
  try {
    const r = await alimentacaoApi({
      acao: "listarEntregas",
      ...filtros,
      cursor: mais ? cursor.value : null,
    });
    registros.value.push(...r.registros);
    cursor.value = r.cursor;
    consultado.value = true;
    if (!mais)
      totais.value = await alimentacaoApi({
        acao: "resumoEntregas",
        escolaId: unidade.value,
      });
  } catch (e) {
    erro.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function concluido() {
  formulario.value = null;
  mensagem.value = "Operação confirmada. Estoque e histórico atualizados.";
  await carregar(false);
}
async function abrir(e) {
  detalhe.value = e;
  providencia.value = "";
  confirmacao.value = false;
  limparPreview();
  await nextTick();
  detalheEl.value?.focus();
}
function limparPreview() {
  if (preview.value) URL.revokeObjectURL(preview.value.url);
  preview.value = null;
}
async function verFoto(id) {
  busy.value = true;
  erro.value = "";
  try {
    const blob = await alimentacaoApi(
      { acao: "baixar", escolaId: detalhe.value.escolaId, id },
      true,
    );
    limparPreview();
    preview.value = {
      url: URL.createObjectURL(blob),
      mime: blob.type,
      nome: `comprovante.${blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`,
    };
  } catch (e) {
    erro.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function operar(acao) {
  if (busy.value) return;
  busy.value = true;
  erro.value = "";
  const atual = detalhe.value;
  try {
    await alimentacaoApi({
      acao,
      escolaId: atual.escolaId,
      id: atual.id,
      motivo: providencia.value,
      resolucao: providencia.value,
    });
    detalhe.value = await alimentacaoApi({
      acao: "detalharEntrega",
      escolaId: atual.escolaId,
      id: atual.id,
    });
    mensagem.value = "Providência registrada.";
  } catch (e) {
    erro.value = e.message;
  } finally {
    busy.value = false;
  }
  await carregar(false);
}
async function testar() {
  busy.value = true;
  storage.value = "";
  try {
    const r = await alimentacaoApi({
      acao: "status",
      escolaId: props.escolaId,
    });
    storage.value = `API online · B2 conectado · ${data(r.verificadoEm)}. Confirma acesso ao bucket privado; valide o envio de uma foto antes de liberar o uso.`;
  } catch (e) {
    storage.value = e.message;
  } finally {
    busy.value = false;
  }
}
function imprimir() {
  document.body.classList.add("imprimir-entrega");
  window.print();
  document.body.classList.remove("imprimir-entrega");
}
onMounted(() => carregar(false));
onUnmounted(limparPreview);
</script>
<style scoped>
.totais-entregas {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.totais-entregas p {
  padding: 14px;
  background: #edf4ef;
  border-radius: 6px;
}
.totais-entregas strong {
  font-size: 1.4rem;
  margin-right: 6px;
}
.entregas-painel {
  overflow-wrap: anywhere;
  color: #20382b;
}
.cabecalho-entregas {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
}
.filtros-entregas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
  gap: 12px;
  margin: 20px 0;
}
label {
  display: grid;
  gap: 6px;
}
input,
select,
textarea {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid #8b9b94;
  border-radius: 6px;
  font: inherit;
  color: #172e24;
  background: white;
}
button {
  min-height: 44px;
  padding: 10px 14px;
  margin: 4px;
  border: 1px solid #426d59;
  border-radius: 6px;
  background: #edf4ef;
  color: #183e2b;
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
}
.lista-entregas {
  list-style: none;
  padding: 0;
}
.lista-entregas li {
  padding: 18px 0;
  border-bottom: 1px solid #ccd8d0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.lista-entregas li > div {
  flex: 1 1 220px;
}
.detalhe-entrega {
  background: white;
  border: 1px solid #98ae9e;
  padding: clamp(12px, 3vw, 28px);
  margin: 24px 0;
  border-radius: 8px;
}
.comprovante-img {
  display: block;
  max-width: 100%;
  max-height: 500px;
}
form {
  margin: 20px 0;
}
.checkbox {
  display: flex;
  align-items: center;
}
.checkbox input {
  width: 20px;
  flex-shrink: 0;
}
.diagnostico {
  margin-top: 32px;
  border-top: 1px solid #ccd8d0;
  padding-top: 20px;
}
[role="alert"] {
  color: #a42121;
}
:focus-visible {
  outline: 3px solid #b96d12;
  outline-offset: 3px;
}
</style>
<style>
@media print {
  body.imprimir-entrega * {
    visibility: hidden;
  }
  body.imprimir-entrega .detalhe-entrega,
  body.imprimir-entrega .detalhe-entrega * {
    visibility: visible;
  }
  body.imprimir-entrega .detalhe-entrega {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    border: 0;
    margin: 0;
  }
  body.imprimir-entrega .nao-imprimir,
  body.imprimir-entrega .nao-imprimir * {
    display: none !important;
  }
}
</style>
