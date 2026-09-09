<template>
  <section class="p-container p-section" aria-labelledby="titulo-servicos">
    <div class="p-section-head">
      <div>
        <p class="p-eyebrow">SERVIÇOS PARA VOCÊ</p>
        <h2 id="titulo-servicos">Como podemos ajudar?</h2>
      </div>
      <router-link to="/carta-de-servicos"
        >Ver todos os serviços
        <i class="mdi mdi-arrow-right" aria-hidden="true"
      /></router-link>
    </div>
    <div class="p-grid service-grid">
      <router-link
        v-for="s in servicos"
        :key="s.id"
        :to="s.caminho"
        class="p-card p-card-link"
        ><span class="p-icon"
          ><i :class="'mdi mdi-' + s.icone" aria-hidden="true"
        /></span>
        <h3>{{ s.titulo }}</h3>
        <p>{{ s.resumo }}</p></router-link
      >
    </div>
  </section>
</template>
<script setup>
import { usePortal } from "../composables/usePortal";
const { servicos } = usePortal();
</script>
<style scoped>
.service-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.service-grid > a:nth-last-child(-n + 2) {
  grid-column: span 2;
}
@media (max-width: 1000px) {
  .service-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .service-grid > a:nth-last-child(-n + 2) {
    grid-column: auto;
  }
}
@media (max-width: 520px) {
  .service-grid {
    grid-template-columns: 1fr;
  }
}
</style>
