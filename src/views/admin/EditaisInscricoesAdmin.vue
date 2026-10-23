<template>
  <section class="p-stack">
    <h1>Editais e Inscrições</h1>
    <p>Conferência exclusiva do Administrador Master.</p>
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="ocupado" role="status">Consultando servidor…</p>
    <div class="p-grid">
      <div class="p-card">
        Editais configurados: <strong>{{ globais.editais || 0 }}</strong>
      </div>
      <div class="p-card">
        Inscrições recebidas: <strong>{{ globais.recebidas || 0 }}</strong>
      </div>
      <div class="p-card">
        Aguardando conferência:
        <strong>{{
          (globais.recebidas || 0) - (globais.confirmadas || 0)
        }}</strong>
      </div>
      <div class="p-card">
        Confirmadas: <strong>{{ globais.confirmadas || 0 }}</strong>
      </div>
    </div>
    <label class="p-field"
      >Selecione o edital<select
        v-model="editalId"
        @change="reiniciar"
        :disabled="ocupado"
      >
        <option value="">Selecione</option>
        <option v-for="e in editais" :key="e.id" :value="e.id">
          {{ e.nome }}
        </option>
      </select></label
    ><button
      v-if="cursorEditais"
      class="p-button"
      :disabled="ocupado"
      @click="catalogo"
    >
      Carregar mais editais
    </button>
    <form v-if="editalId" @submit.prevent="reiniciar" class="p-actions">
      <label class="p-field"
        >Pesquisar por<select v-model="campoBusca">
          <option value="dados.responsavel">Responsável</option>
          <option value="dados.escola">Escola</option>
          <option value="dados.titulo">Título</option>
          <option value="protocolo">Protocolo completo</option>
        </select></label
      >
      <label class="p-field"
        >Texto da busca<input
          v-model="busca"
          maxlength="96"
          placeholder="Início do texto, respeitando maiúsculas" /></label
      ><label class="p-field"
        >Situação<select v-model="status">
          <option value="">Todas</option>
          <option value="recebida">Aguardando conferência</option>
          <option value="confirmada">Confirmada</option>
        </select></label
      ><button class="p-button" :disabled="ocupado">Buscar / atualizar</button>
    </form>
    <p v-if="editalId">
      Neste edital: {{ totais.recebidas || 0 }} recebidas ·
      {{ totais.confirmadas || 0 }} confirmadas
    </p>
    <div
      v-if="editalId"
      class="tabela"
      tabindex="0"
      role="region"
      aria-label="Inscrições do edital"
    >
      <table>
        <thead>
          <tr>
            <th>Protocolo</th>
            <th>Responsável</th>
            <th>Escola</th>
            <th>Prática</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Situação</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in linhas" :key="r.id">
            <td>{{ r.protocolo }}</td>
            <td>{{ r.dados.responsavel }}</td>
            <td>{{ r.dados.escola }}</td>
            <td>{{ r.dados.titulo }}</td>
            <td>{{ r.dados.categoria }}</td>
            <td>{{ dataHora(r.criadoEm) }}</td>
            <td>{{ r.status }}</td>
            <td>
              <button class="p-button" :disabled="ocupado" @click="abrir(r.id)">
                Ver ficha
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="editalId && !ocupado && !linhas.length">
      Nenhuma inscrição encontrada.
    </p>
    <div class="p-actions">
      <button
        v-if="historico.length"
        class="p-button"
        :disabled="ocupado"
        @click="anterior"
      >
        Página anterior</button
      ><button
        v-if="proximo"
        class="p-button"
        :disabled="ocupado"
        @click="seguinte"
      >
        Próxima página
      </button>
    </div>
    <section
      v-if="selecionada"
      class="p-card p-stack"
      aria-labelledby="titulo-ficha"
    >
      <h2 id="titulo-ficha" tabindex="-1" ref="tituloFicha">
        {{ selecionada.protocolo }}
      </h2>
      <p>{{ selecionada.config.nome }}</p>
      <dl>
        <template v-for="f in campos(selecionada.config)" :key="f.id"
          ><dt>
            <strong>{{ f.label }}</strong>
          </dt>
          <dd class="p-prose">
            {{ selecionada.dados[f.id] || "Não informado" }}
          </dd></template
        >
      </dl>
      <p class="p-prose">{{ selecionada.declaracao }}</p>
      <p>
        Aceite: {{ dataHora(selecionada.aceiteEm) }}. Não substitui assinatura
        ou ciência formal.
      </p>
      <p>Situação: {{ selecionada.status }}</p>
      <p v-if="selecionada.confirmadoEm">
        Confirmada em {{ dataHora(selecionada.confirmadoEm) }} por
        {{ selecionada.confirmadoPor }}
      </p>
      <div class="p-actions">
        <button class="p-button" @click="pdf">
          Imprimir ficha de inscrição / baixar PDF</button
        ><button
          v-if="selecionada.status === 'recebida'"
          class="p-button primary"
          :disabled="ocupado"
          @click="confirmar"
        >
          Confirmar inscrição</button
        ><button class="p-button" @click="selecionada = null">
          Fechar ficha
        </button>
      </div>
    </section>
  </section>
</template>
<script setup>
import { ref, onMounted, nextTick } from "vue";
import { editaisApi } from "../../services/editaisApi";
import { campos } from "../../../shared/editais.mjs";
const editalId = ref(""),
  editais = ref([]),
  cursorEditais = ref(null),
  globais = ref({}),
  totais = ref({}),
  erro = ref(""),
  ocupado = ref(false),
  busca = ref(""),
  campoBusca = ref("dados.responsavel"),
  status = ref(""),
  linhas = ref([]),
  selecionada = ref(null),
  cursor = ref(null),
  proximo = ref(null),
  historico = ref([]),
  tituloFicha = ref(null);
const api = (acao, extra = {}) =>
  editaisApi({ acao, editalId: editalId.value || "catalogo", ...extra }, true);
function dataHora(v) {
  return v
    ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";
}
async function executar(fn) {
  erro.value = "";
  ocupado.value = true;
  try {
    await fn();
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
async function catalogo() {
  await executar(async () => {
    const r = await api("catalogo", { cursor: cursorEditais.value });
    editais.value.push(...r.editais);
    cursorEditais.value = r.cursor;
    globais.value = r.totais;
  });
}
async function listar() {
  const r = await api("listar", {
    busca: busca.value.trim(),
    campoBusca: campoBusca.value,
    status: status.value,
    cursor: cursor.value,
  });
  linhas.value = r.linhas;
  proximo.value = r.cursor;
  totais.value = r.totais;
}
async function reiniciar() {
  cursor.value = null;
  historico.value = [];
  selecionada.value = null;
  if (editalId.value) await executar(listar);
}
async function seguinte() {
  historico.value.push(cursor.value);
  cursor.value = proximo.value;
  await executar(listar);
}
async function anterior() {
  cursor.value = historico.value.pop();
  await executar(listar);
}
async function abrir(id) {
  await executar(async () => {
    selecionada.value = await api("detalhe", { id });
    await nextTick();
    tituloFicha.value?.focus();
  });
}
async function confirmar() {
  if (
    !window.confirm(
      "Confirma que conferiu os dados da ficha? Esta ação será registrada na auditoria.",
    )
  )
    return;
  await executar(async () => {
    await api("confirmar", { id: selecionada.value.id });
    selecionada.value = await api("detalhe", { id: selecionada.value.id });
    await listar();
    const r = await api("catalogo");
    globais.value = r.totais;
  });
}
async function pdf() {
  await executar(async () => {
    const { baixarFicha } =
      await import("../../components/editais/fichaPdf.mjs");
    baixarFicha(selecionada.value);
  });
}
onMounted(catalogo);
</script>
<style scoped>
.tabela {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
td,
th {
  text-align: left;
  padding: 0.7rem;
  border-bottom: 1px solid var(--p-border);
  vertical-align: top;
}
td:first-child {
  min-width: 13rem;
  overflow-wrap: anywhere;
}
dd {
  margin: 0 0 1rem;
  overflow-wrap: anywhere;
}
</style>
