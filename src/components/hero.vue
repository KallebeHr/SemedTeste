<template>
  <section class="hero-main">
    <div class="p-container hero-grid">
      <div>
        <p class="hero-eyebrow">EDUCAÇÃO QUE CONECTA</p>
        <h1>
          {{
            configuracao.heroTitulo ||
            "Informação e serviços para toda a nossa comunidade."
          }}
        </h1>
        <p class="hero-text">
          {{
            configuracao.heroTexto ||
            "Acompanhe a educação de Pedro II. Encontre serviços, conheça nossas escolas e participe da vida da rede municipal."
          }}
        </p>
        <div class="p-actions">
          <router-link class="p-button hero-cta" to="/carta-de-servicos"
            >Encontre um serviço
            <i class="mdi mdi-arrow-right" aria-hidden="true" /></router-link
          ><router-link class="hero-link" to="/merenda-escolar"
            >Acompanhe a alimentação escolar</router-link
          >
        </div>
      </div>
      <router-link
        v-if="destaque"
        :to="'/publicacao/' + destaque.id"
        class="hero-news"
        ><img
          v-if="destaque.imagemUrl"
          :src="destaque.imagemUrl"
          :alt="destaque.imagemAlt"
          referrerpolicy="no-referrer" />
        <div>
          <span class="p-badge">{{ destaque.categoria || "Em destaque" }}</span>
          <h2>{{ destaque.titulo }}</h2>
          <p>{{ destaque.resumo }}</p>
          <span class="hero-read"
            >Ler publicação
            <i class="mdi mdi-arrow-up-right" aria-hidden="true"
          /></span></div
      ></router-link>
      <div v-else class="hero-guide">
        <span class="guide-number">AO SEU ALCANCE</span>
        <h2>Uma rede de possibilidades</h2>
        <router-link to="/escolas"
          ><i class="mdi mdi-school-outline" aria-hidden="true" /> Conheça
          nossas escolas
          <i class="mdi mdi-arrow-right" aria-hidden="true" /></router-link
        ><router-link to="/calendario"
          ><i class="mdi mdi-calendar-month-outline" aria-hidden="true" />
          Acompanhe o calendário
          <i class="mdi mdi-arrow-right" aria-hidden="true" /></router-link
        ><router-link to="/fale-conosco"
          ><i class="mdi mdi-message-text-outline" aria-hidden="true" /> Fale
          com a Secretaria <i class="mdi mdi-arrow-right" aria-hidden="true"
        /></router-link>
      </div>
    </div>
  </section>
</template>
<script setup>
import { computed } from "vue";
import { usePortal } from "../composables/usePortal";
const { configuracao, conteudos } = usePortal();
const destaque = computed(() =>
  conteudos.value.find((c) => c.tipo === "noticia" && c.destaque),
);
</script>
<style scoped>
.hero-main {
  background: linear-gradient(120deg, #064961, #075c71 58%, #07685e);
  color: white;
  padding-block: 4.5rem;
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 4rem;
  align-items: center;
}
.hero-grid > * {
  min-width: 0;
}
.hero-eyebrow,
.guide-number {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: #b9e4d7;
  margin-bottom: 1.4rem;
}
.hero-main h1 {
  color: inherit;
  font-size: clamp(2.2rem, 4vw, 3.4rem);
  max-width: 620px;
}
.hero-text {
  color: #dbedf0;
  font-size: 1.05rem;
  margin: 1.5rem 0;
  max-width: 520px;
}
.hero-cta {
  background: #f3c65a;
  border-color: #f3c65a;
  color: #183837;
}
.hero-link {
  color: white;
  font-size: 0.85rem;
}
.hero-news {
  display: block;
  background: var(--p-surface);
  border-radius: 1rem;
  overflow: hidden;
  color: var(--p-ink);
  text-decoration: none;
}
.hero-news img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}
.hero-news > div {
  padding: 1.5rem;
}
.hero-news h2 {
  font-size: 1.5rem;
  margin: 0.8rem 0;
}
.hero-news p {
  font-size: 0.9rem;
  color: var(--p-muted);
}
.hero-read {
  display: block;
  color: var(--p-teal);
  font-weight: 600;
  margin-top: 1rem;
  font-size: 0.85rem;
}
.hero-guide {
  border: 1px solid #ffffff35;
  border-radius: 1rem;
  padding: 2rem;
  background: #ffffff09;
}
.hero-guide h2 {
  color: inherit;
  margin-bottom: 1.5rem;
}
.hero-guide a {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #fff;
  padding: 1rem 0;
  text-decoration: none;
  border-bottom: 1px solid #ffffff30;
}
.hero-guide a i:last-child {
  margin-left: auto;
}
@media (max-width: 850px) {
  .hero-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
  }
  .hero-main {
    padding-block: 2.5rem;
  }
  .hero-guide {
    padding: 1.5rem;
  }
}
</style>
