<template>
  <div v-if="consulta.carregando.value" role="status" class="p-alert" aria-busy="true">
    <p>Carregando informações…</p><div class="p-skeleton" aria-hidden="true" />
  </div>
  <div v-else-if="consulta.erro.value" class="p-alert error" role="alert">
    <p>{{ consulta.erro.value }}</p>
    <button class="p-button" @click="consulta.recarregar">
      Tentar novamente
    </button>
  </div>
</template>
<script setup>
defineProps({ consulta: { type: Object, required: true } });
</script>
