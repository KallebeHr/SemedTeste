<template>
  <section class="cal-stack">
    <div class="cal-filtros">
      <label
        >Categoria<select v-model="categoria" aria-label="Categoria">
          <option value="">Todas</option>
          <option v-for="(v, k) in categorias" :key="k" :value="k">
            {{ v.rotulo }}
          </option>
        </select></label
      ><label
        >Pesquisar eventos<input
          v-model="busca"
          type="search"
          placeholder="Título do evento" /></label
      ><label
        >Mês<select v-model="mes" aria-label="Mês">
          <option value="">Os 12 meses</option>
          <option v-for="(nome, i) in MESES" :key="nome" :value="String(i + 1)">
            {{ nome }}
          </option>
        </select></label
      >
    </div>
    <p class="cal-nota">
      {{ calendario.ano }} · {{ calendario.dias.length }} dias ·
      {{ calendario.eventos.length }} eventos. Selecione um dia para consultar
      os detalhes. As cores e siglas indicam a classificação; pontos indicam
      eventos.
    </p>
    <div class="cal-legenda">
      <span v-for="(v, k) in categorias" :key="k"
        ><i :style="{ background: v.cor }" />{{ v.rotulo }}</span
      >
    </div>
    <div class="cal-ano">
      <section v-for="m in mesesVisiveis" :key="m" class="cal-mes">
        <h2>{{ MESES[m - 1] }}</h2>
        <div class="cal-grade">
          <span
            v-for="s in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']"
            :key="s"
            class="cal-semana"
            >{{ s }}</span
          ><span v-for="n in inicio(m)" :key="'v' + n" />
          <button
            v-for="d in calendario.dias.filter((d) => d.mes === m)"
            :key="d.data"
            type="button"
            :style="{ background: d.cor }"
            :class="{
              atenuado: !combina(d),
              escolhido: selecionado === d.data,
            }"
            :aria-pressed="selecionado === d.data"
            :aria-label="`${d.data}: ${categorias[d.tipoVisual]?.rotulo}; ${d.eventoIds.length} eventos`"
            @click="selecionar(d)"
          >
            <strong>{{ d.dia }}</strong
            ><small
              >{{ sigla(d.tipoVisual)
              }}{{ d.eventoIds.length ? " •" : "" }}</small
            >
          </button>
        </div>
        <p v-if="calendario.diasLetivosPorMes" class="cal-nota">
          Dias letivos oficiais:
          {{ calendario.diasLetivosPorMes[String(m).padStart(2, "0")] ?? "—" }}
        </p>
      </section>
    </div>
    <section v-if="dia" ref="detalhes" tabindex="-1" class="p-card">
      <h2>
        {{ dia.data.split("-").reverse().join("/") }} —
        {{ categorias[dia.tipoVisual]?.rotulo }}
      </h2>
      <p v-if="!dia.eventoIds.length">
        Nenhum evento específico registrado para esta data.
      </p>
      <article
        v-for="e in calendario.eventos.filter((e) =>
          dia.eventoIds.includes(e.id),
        )"
        :key="e.id"
        class="cal-evento"
      >
        <h3>{{ e.titulo }}</h3>
        <p>
          {{ categorias[e.tipo]?.rotulo }} · {{ e.dataInicio }} até
          {{ e.dataFim }}
        </p>
        <p>{{ e.observacao }}</p>
        <small>Fonte: {{ e.fonte || calendario.fonte }}</small>
      </article>
    </section>
    <details class="cal-lista-opcional">
      <summary>Consultar lista de eventos ({{ eventos.length }})</summary>
      <h2>Eventos {{ busca || categoria ? "filtrados" : "" }}</h2>
      <p v-if="!eventos.length">Nenhum evento corresponde aos filtros.</p>
      <details v-for="e in eventos" :key="e.id" class="cal-evento">
        <summary>
          {{ e.dataInicio.split("-").reverse().join("/") }} — {{ e.titulo }}
        </summary>
        <p>
          {{ categorias[e.tipo]?.rotulo }} · {{ e.dataInicio }} a
          {{ e.dataFim }}
        </p>
        <p>{{ e.observacao }}</p>
        <small>{{ e.fonte }}</small>
      </details>
    </details>
    <p v-if="calendario.totalDiasLetivos !== undefined" class="p-alert">
      Total oficial: {{ calendario.totalDiasLetivos }} dias letivos. Esse total
      é o informado no documento, não uma contagem automática das cores.
    </p>
    <details>
      <summary>Fonte e observações</summary>
      <p>{{ calendario.fonte }} · {{ calendario.referenciaDocumento }}</p>
      <p v-for="(o, i) in calendario.observacoesImportacao || []" :key="i">
        {{ o }}
      </p>
    </details>
  </section>
</template>
<script setup>
import { computed, ref, nextTick } from "vue";
import { BASE, MESES } from "../../../shared/calendario.mjs";
const props = defineProps({ calendario: { type: Object, required: true } }),
  emit = defineEmits(["dia"]);
const categoria = ref(""),
  busca = ref(""),
  mes = ref(""),
  selecionado = ref(""),
  detalhes = ref(null);
const categorias = computed(() => ({
  ...BASE,
  ...props.calendario.categorias,
}));
const mesesVisiveis = computed(() =>
  mes.value ? [Number(mes.value)] : Array.from({ length: 12 }, (_, i) => i + 1),
);
const normal = (v) =>
  String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const eventos = computed(() =>
  props.calendario.eventos.filter(
    (e) =>
      (!categoria.value || e.tipo === categoria.value) &&
      normal(e.titulo + " " + (e.observacao || "")).includes(
        normal(busca.value),
      ) &&
      (!mes.value ||
        (Number(e.dataInicio.slice(5, 7)) <= Number(mes.value) &&
          Number(e.dataFim.slice(5, 7)) >= Number(mes.value))),
  ),
);
const dia = computed(() =>
  props.calendario.dias.find((d) => d.data === selecionado.value),
);
function inicio(m) {
  return new Date(Date.UTC(props.calendario.ano, m - 1, 1)).getUTCDay();
}
function combina(d) {
  return (
    (!mes.value || d.mes === Number(mes.value)) &&
    ((!categoria.value && !busca.value) ||
      (!busca.value && d.tipoVisual === categoria.value) ||
      eventos.value.some((e) => d.eventoIds.includes(e.id)))
  );
}
function sigla(t) {
  return t
    .split("_")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}
async function selecionar(d) {
  selecionado.value = d.data;
  emit("dia", d.data);
  await nextTick();
  detalhes.value?.focus();
}
</script>
<style scoped>
.cal-stack {
  display: grid;
  gap: 1.1rem;
  min-width: 0;
}
.cal-filtros {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.cal-filtros label {
  display: grid;
  gap: 0.3rem;
  flex: 1 1 150px;
  font-size: 0.85rem;
}
.cal-filtros input,
.cal-filtros select {
  min-width: 0;
  width: 100%;
  border: 1px solid var(--p-border);
  border-radius: 6px;
  padding: 0.65rem;
  background: var(--p-surface);
  color: var(--p-ink);
}
.cal-ano {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
  gap: 1rem;
}
.cal-mes {
  min-width: 0;
  border: 1px solid var(--p-border);
  border-radius: 12px;
  padding: 0.75rem;
  background: var(--p-surface);
}
.cal-mes h2 {
  font-size: 1.1rem;
  margin: 0 0 0.7rem;
}
.cal-grade {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px;
}
.cal-semana {
  text-align: center;
  font-size: 0.7rem;
}
.cal-grade button {
  min-width: 0;
  min-height: 44px;
  padding: 3px 0;
  border: 1px solid #647474;
  border-radius: 4px;
  color: #101c1f;
  display: grid;
  place-content: center;
  font-size: 0.85rem;
}
.cal-grade small {
  font-size: 0.52rem;
  line-height: 1.2;
}
.cal-grade .atenuado {
  opacity: 0.32;
}
.cal-grade .escolhido {
  outline: 3px solid var(--p-blue);
  outline-offset: 1px;
}
.cal-legenda {
  display: flex;
  gap: 0.6rem 1rem;
  flex-wrap: wrap;
  font-size: 0.78rem;
}
.cal-legenda span {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.cal-legenda i {
  width: 14px;
  height: 14px;
  border: 1px solid #555;
}
.cal-nota {
  font-size: 0.8rem;
  color: var(--p-muted);
}
.cal-evento {
  border-bottom: 1px solid var(--p-border);
  padding: 0.75rem 0;
  overflow-wrap: anywhere;
}
.cal-evento h3 {
  font-size: 1rem;
}
.cal-evento summary {
  cursor: pointer;
  min-height: 44px;
}
.cal-evento p {
  white-space: pre-line;
}
.cal-stack > section h2 {
  font-size: 1.2rem;
}
</style>
