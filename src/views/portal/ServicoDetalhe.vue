<template>
  <div class="p-container p-page">
    <router-link to="/carta-de-servicos">← Carta de serviços</router-link>
    <EstadoConsulta :consulta="publicacoes" />
    <template v-if="servico">
      <header class="p-page-head">
        <p class="p-eyebrow">{{ servico.grupo }}</p>
        <h1>{{ servico.titulo }}</h1>
        <p>{{ servico.resumo }}</p>
      </header>
      <article v-if="servico.texto" class="p-card p-prose">
        {{ servico.texto }}
      </article>
      <p v-else class="p-alert">
        Consulte o serviço ou fale com a equipe para obter orientações sobre sua
        situação.
      </p>
      <div class="p-actions">
        <router-link
          v-if="destinoInterno"
          :to="destinoInterno"
          class="p-button primary"
          >Acessar serviço</router-link
        >
        <a
          v-if="url"
          :href="url"
          class="p-button"
          :target="url.startsWith('https://') ? '_blank' : undefined"
          rel="noopener noreferrer"
          >{{
            url.startsWith("https://")
              ? "Abrir canal indicado (nova aba)"
              : "Abrir canal indicado"
          }}</a
        >
        <router-link
          v-if="!destinoInterno"
          to="/atendimento"
          class="p-button primary"
          >Solicitar atendimento</router-link
        >
      </div>
    </template>
    <div v-else-if="!publicacoes.carregando.value" class="p-empty">
      <h1>Serviço não encontrado</h1>
      <p>
        O serviço pode ter sido retirado de publicação. Consulte a carta de
        serviços.
      </p>
    </div>
  </div>
</template>
<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { usePortal } from "../../composables/usePortal";
import { SERVICOS } from "../../portal/catalogo";
import { urlSegura } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const route = useRoute(),
  { servicos, publicacoes } = usePortal();
const servico = computed(() =>
  servicos.value.find((s) => s.id === route.params.id),
);
const destinoInterno = computed(
  () => SERVICOS.find((s) => s.id === route.params.id)?.caminho,
);
const url = computed(() => urlSegura(servico.value?.url));
</script>
