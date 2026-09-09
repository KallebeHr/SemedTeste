<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">PUBLICAÇÕES OFICIAIS</p>
      <h1>Editais e concursos</h1>
      <p>
        Consulte documentos, prazos e resultados publicados pela Secretaria.
      </p>
    </header>
    <div class="p-grid two">
      <label class="p-field"
        >Pesquisar edital<input
          v-model="busca"
          type="search"
          placeholder="Título, número ou categoria" /></label
      ><label class="p-field"
        >Situação<select v-model="status">
          <option value="">Todas</option>
          <option
            v-for="s in [
              'Prazo aberto',
              'Previsto',
              'Prazo encerrado',
              'Sem prazo informado',
            ]"
            :key="s"
          >
            {{ s }}
          </option>
        </select></label
      >
    </div>
    <EstadoConsulta :consulta="publicacoes" />
    <p class="p-muted" role="status">{{ filtrados.length }} edital(is)</p>
    <div class="p-stack">
      <router-link
        v-for="e in filtrados"
        :key="e.id"
        :to="'/publicacao/' + e.id"
        class="p-card p-card-link"
        ><span class="p-badge">{{ situacao(e) }}</span>
        <h2>{{ e.titulo }}</h2>
        <p v-if="e.numero">Edital {{ e.numero }}</p>
        <p>{{ e.resumo }}</p>
        <p v-if="e.dataFim">Prazo: {{ dataTexto(e.dataFim) }}</p>
        <span>Consultar documento e detalhes →</span></router-link
      >
    </div>
    <p
      v-if="
        !filtrados.length &&
        !publicacoes.carregando.value &&
        !publicacoes.erro.value
      "
      class="p-empty"
    >
      Nenhum edital publicado corresponde aos filtros.
    </p>
  </div>
</template>
<script setup>
import { ref, computed } from "vue";
import { usePortal } from "../composables/usePortal";
import { dataHoje, dataTexto, normalizarBusca } from "../portal/validacao";
import EstadoConsulta from "./portal/EstadoConsulta.vue";
const { conteudos, publicacoes } = usePortal(),
  busca = ref(""),
  status = ref("");
function situacao(e) {
  if (!e.dataInicio && !e.dataFim) return "Sem prazo informado";
  if (e.dataInicio > dataHoje()) return "Previsto";
  if (e.dataFim && e.dataFim < dataHoje()) return "Prazo encerrado";
  return "Prazo aberto";
}
const filtrados = computed(() =>
  conteudos.value.filter(
    (e) =>
      e.tipo === "edital" &&
      (!status.value || situacao(e) === status.value) &&
      normalizarBusca(e.titulo + " " + e.numero + " " + e.categoria).includes(
        normalizarBusca(busca.value),
      ),
  ),
);
</script>
