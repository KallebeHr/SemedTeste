<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">ALUNOS E FAMÍLIAS</p>
      <h1>Matrícula escolar</h1>
      <p>Consulte as orientações da Secretaria e registre sua solicitação.</p>
    </header>
    <EstadoConsulta :consulta="publicacoes" />
    <div v-if="orientacao" class="p-card p-prose">{{ orientacao.texto }}</div>
    <div v-else class="p-alert">
      As orientações de matrícula, documentos e prazos ainda não foram
      publicadas. A solicitação de atendimento permite entrar em contato com a
      equipe e não garante reserva de vaga.
    </div>
    <div class="p-actions">
      <router-link to="/atendimento?tipo=matricula" class="p-button primary"
        >Solicitar matrícula</router-link
      ><router-link to="/escolas" class="p-button"
        >Conhecer as escolas</router-link
      ><a
        v-if="orientacao && urlSegura(orientacao.url)"
        :href="urlSegura(orientacao.url)"
        class="p-button"
        target="_blank"
        rel="noopener noreferrer"
        >Orientações adicionais</a
      >
    </div>
  </div>
</template>
<script setup>
import { computed } from "vue";
import { usePortal } from "../../composables/usePortal";
import { urlSegura } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { conteudos, publicacoes } = usePortal(),
  orientacao = computed(() =>
    conteudos.value.find((c) => c.tipo === "servico" && c.slug === "matricula"),
  );
</script>
