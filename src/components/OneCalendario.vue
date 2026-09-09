<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">REDE MUNICIPAL</p>
      <h1>Calendário escolar</h1>
      <p>Consulte as datas e os eventos publicados pela Secretaria.</p>
    </header>
    <div class="calendar-controls">
      <button class="p-button" aria-label="Mês anterior" @click="mudar(-1)">
        ←
      </button>
      <h2 aria-live="polite">{{ tituloMes }}</h2>
      <button class="p-button" aria-label="Próximo mês" @click="mudar(1)">
        →</button
      ><button class="p-button" @click="mes = dataHoje().slice(0, 7)">
        Hoje</button
      ><label class="p-field"
        ><span class="sr-only">Ir para o mês</span
        ><input v-model="mes" type="month"
      /></label>
    </div>
    <label class="p-field"
      >Pesquisar eventos<input v-model="busca" type="search" /></label
    ><EstadoConsulta :consulta="publicacoes" />
    <div class="calendar-grid" aria-label="Dias do mês">
      <div
        v-for="d in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']"
        :key="d"
        class="weekday"
        aria-hidden="true"
      >
        {{ d }}
      </div>
      <div v-for="n in inicioSemana" :key="'v' + n" class="blank" />
      <button
        v-for="dia in dias"
        :key="dia"
        :class="[
          'day',
          { hoje: dia === dataHoje(), escolhido: selecionado === dia },
        ]"
        :aria-label="dataTexto(dia) + ', ' + noDia(dia).length + ' evento(s)'"
        :aria-pressed="selecionado === dia"
        @click="selecionado = selecionado === dia ? '' : dia"
      >
        <span>{{ Number(dia.slice(-2)) }}</span
        ><span v-if="noDia(dia).length" class="day-count"
          >{{ noDia(dia).length }}
          <span class="desktop-only">evento(s)</span></span
        >
      </button>
    </div>
    <div class="p-section-head">
      <h2>
        {{
          selecionado ? "Agenda de " + dataTexto(selecionado) : "Agenda do mês"
        }}
      </h2>
      <button v-if="selecionado" class="p-button" @click="selecionado = ''">
        Ver mês inteiro
      </button>
    </div>
    <div class="p-stack">
      <router-link
        v-for="e in agenda"
        :key="e.id"
        :to="'/publicacao/' + e.id"
        class="p-card p-card-link"
        ><span class="p-badge"
          >{{ dataTexto(e.dataInicio)
          }}<template v-if="e.dataFim && e.dataFim !== e.dataInicio">
            a {{ dataTexto(e.dataFim) }}</template
          ></span
        >
        <h3>{{ e.titulo }}</h3>
        <p>{{ e.resumo }}</p>
        <p v-if="e.local">{{ e.local }}</p></router-link
      >
    </div>
    <p v-if="!agenda.length && !publicacoes.carregando.value" class="p-empty">
      Nenhum evento publicado para este período e filtro.
    </p>
    <div class="p-actions">
      <button class="p-button" :disabled="!eventosMes.length" @click="exportar">
        Baixar agenda do mês (.ics)</button
      ><button class="p-button" @click="imprimir">Imprimir calendário</button>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { usePortal } from "../composables/usePortal";
import { dataHoje, dataTexto, normalizarBusca } from "../portal/validacao";
import { baixarTexto, calendarioIcs } from "../portal/downloads";
import EstadoConsulta from "./portal/EstadoConsulta.vue";
const { conteudos, publicacoes } = usePortal(),
  mes = ref(dataHoje().slice(0, 7)),
  busca = ref(""),
  selecionado = ref("");
const dataMes = computed(
    () =>
      new Date(
        (/^\d{4}-\d{2}$/.test(mes.value) ? mes.value : dataHoje().slice(0, 7)) +
          "-01T12:00:00",
      ),
  ),
  tituloMes = computed(() =>
    dataMes.value.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    }),
  ),
  inicioSemana = computed(() => dataMes.value.getDay()),
  dias = computed(() =>
    Array.from(
      {
        length: new Date(
          dataMes.value.getFullYear(),
          dataMes.value.getMonth() + 1,
          0,
        ).getDate(),
      },
      (_, i) => `${mes.value}-${String(i + 1).padStart(2, "0")}`,
    ),
  ),
  eventosMes = computed(() =>
    conteudos.value
      .filter(
        (c) =>
          c.tipo === "evento" &&
          c.dataInicio <= dias.value.at(-1) &&
          (c.dataFim || c.dataInicio) >= dias.value[0] &&
          normalizarBusca(c.titulo + " " + c.resumo).includes(
            normalizarBusca(busca.value),
          ),
      )
      .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)),
  ),
  agenda = computed(() =>
    selecionado.value ? noDia(selecionado.value) : eventosMes.value,
  );
function noDia(d) {
  return eventosMes.value.filter(
    (e) => e.dataInicio <= d && (e.dataFim || e.dataInicio) >= d,
  );
}
function mudar(n) {
  const d = dataMes.value;
  const novo = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
  mes.value = `${novo.getFullYear()}-${String(novo.getMonth() + 1).padStart(2, "0")}`;
}
function exportar() {
  baixarTexto(
    calendarioIcs(eventosMes.value),
    "calendario-" + mes.value + ".ics",
    "text/calendar;charset=utf-8",
  );
}
function imprimir() {
  window.print();
}
watch(mes, () => (selecionado.value = ""));
</script>
<style scoped>
.calendar-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1.4rem;
}
.calendar-controls h2 {
  text-transform: capitalize;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border: 1px solid var(--p-border);
  border-radius: 0.8rem;
  overflow: hidden;
  background: var(--p-surface);
  margin: 2rem 0;
}
.weekday {
  background: var(--p-soft);
  padding: 0.65rem;
  text-align: center;
  font-size: 0.8rem;
}
.day {
  min-height: 80px;
  padding: 0.65rem;
  text-align: left;
  border-right: 1px solid var(--p-border);
  border-top: 1px solid var(--p-border);
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 0.6rem;
}
.day-count {
  font-size: 0.72rem;
  color: var(--p-teal);
  font-weight: 700;
}
.day.hoje {
  box-shadow: inset 0 0 0 2px var(--p-teal);
}
.day.escolhido {
  background: var(--p-soft);
}
@media (max-width: 560px) {
  .desktop-only {
    display: none;
  }
  .day {
    min-height: 60px;
    padding: 0.45rem;
  }
  .calendar-controls {
    gap: 0.5rem;
  }
}
</style>
