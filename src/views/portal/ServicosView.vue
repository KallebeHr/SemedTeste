<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">SERVIÇOS</p>
      <h1>Carta de serviços</h1>
      <p>Encontre orientações e acesse os serviços da educação municipal.</p>
    </header>
    <label class="p-field"
      >Buscar serviço<input
        aria-label="Buscar serviço"
        v-model="termo"
        type="search"
        placeholder="Matrícula, merenda, transporte…"
    /></label>
    <div class="p-tabs">
      <button
        v-for="g in ['Todos', ...grupos]"
        :key="g"
        class="p-button"
        :class="{ primary: grupo === g }"
        :aria-pressed="grupo === g"
        @click="grupo = g"
      >
        {{ g }}
      </button>
    </div>
    <div class="p-grid">
      <router-link
        v-for="s in filtrados"
        :key="s.id"
        class="p-card p-card-link"
        :to="'/servico/' + s.id"
        ><span class="p-icon"
          ><i :class="'mdi mdi-' + s.icone" aria-hidden="true"
        /></span>
        <h2>{{ s.titulo }}</h2>
        <p>{{ s.resumo }}</p>
        <span class="p-badge">{{ s.grupo }}</span></router-link
      >
    </div>
    <p v-if="!filtrados.length" role="status" class="p-empty">
      Nenhum serviço encontrado.
    </p>
  </div>
</template>
<script setup>
import { computed, ref } from "vue";
import { usePortal } from "../../composables/usePortal";
import { normalizarBusca } from "../../portal/validacao";
const { servicos } = usePortal(),
  termo = ref(""),
  grupo = ref("Todos"),
  grupos = computed(() => [...new Set(servicos.value.map((s) => s.grupo))]),
  filtrados = computed(() =>
    servicos.value.filter(
      (s) =>
        (grupo.value === "Todos" || s.grupo === grupo.value) &&
        normalizarBusca(s.titulo + " " + s.resumo).includes(
          normalizarBusca(termo.value),
        ),
    ),
  );
</script>
