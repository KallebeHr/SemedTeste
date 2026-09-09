<template>
  <Hero /><AcessoRapido />
  <section class="p-container p-section">
    <div class="p-section-head">
      <div>
        <p class="p-eyebrow">FIQUE POR DENTRO</p>
        <h2>Notícias da educação</h2>
      </div>
      <router-link to="/noticias">Todas as notícias</router-link>
    </div>
    <EstadoConsulta :consulta="publicacoes" />
    <div v-if="noticias.length" class="p-grid">
      <CartaoPublicacao
        v-for="n in noticias.slice(0, 3)"
        :key="n.id"
        :item="n"
      />
    </div>
    <p
      v-else-if="!publicacoes.carregando.value && !publicacoes.erro.value"
      class="p-empty"
    >
      As notícias da rede serão exibidas aqui quando publicadas pela Secretaria.
    </p>
  </section>
  <section class="p-container p-section school-banner">
    <div>
      <p class="p-eyebrow">NOSSA REDE</p>
      <h2>Informação que aproxima escola e comunidade.</h2>
      <p>
        Consulte os contatos das unidades, acompanhe os cardápios e conheça as
        publicações da rede.
      </p>
    </div>
    <router-link to="/escolas" class="p-button primary"
      >Conhecer as escolas <i class="mdi mdi-arrow-right" aria-hidden="true"
    /></router-link>
  </section>
</template>
<script setup>
import { computed } from "vue";
import Hero from "../components/hero.vue";
import AcessoRapido from "../components/AcessoRapido.vue";
import CartaoPublicacao from "../components/portal/CartaoPublicacao.vue";
import EstadoConsulta from "../components/portal/EstadoConsulta.vue";
import { usePortal } from "../composables/usePortal";
const { conteudos, publicacoes } = usePortal();
const noticias = computed(() =>
  conteudos.value.filter((c) => c.tipo === "noticia"),
);
</script>
<style scoped>
.school-banner {
  display: flex;
  align-items: center;
  gap: 2rem;
  justify-content: space-between;
  padding: 2.5rem;
  background: var(--p-soft);
  border-radius: 1.25rem;
}
.school-banner div {
  max-width: 700px;
}
.school-banner p {
  margin-top: 0.7rem;
}
@media (max-width: 720px) {
  .school-banner {
    flex-direction: column;
    align-items: start;
    padding: 1.5rem;
  }
}
</style>
