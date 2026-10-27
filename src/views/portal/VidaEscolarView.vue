<template>
  <div class="p-container p-page vida-escolar">
    <header class="p-page-head">
      <p class="p-eyebrow">ALUNOS E FAMÍLIAS</p>
      <h1>Vida Escolar</h1>
      <p>
        Acesse os serviços, informações e recursos publicados pela Secretaria
        para acompanhar a vida escolar.
      </p>
    </header>
    <EstadoConsulta :consulta="publicacoes" />
    <div v-if="topicos.length" class="vida-grid">
      <a
        v-for="t in topicos"
        :key="t.id"
        class="vida-card"
        :href="urlSegura(t.url)"
        :target="t.url.startsWith('/') ? undefined : '_blank'"
        :rel="t.url.startsWith('/') ? undefined : 'noopener noreferrer'"
      >
        <img
          :src="t.imagemUrl"
          :alt="t.imagemAlt || t.titulo"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        />
        <div class="vida-conteudo">
          <h2>{{ t.titulo }}</h2>
          <p v-if="t.resumo">{{ t.resumo }}</p>
          <span class="vida-acessar"
            >Acessar
            <i class="mdi mdi-arrow-top-right" aria-hidden="true" /><span
              v-if="!t.url.startsWith('/')"
              class="sr-only"
            >
              (abre em nova aba)</span
            ></span
          >
        </div>
      </a>
    </div>
    <p
      v-else-if="!publicacoes.carregando.value && !publicacoes.erro.value"
      class="p-empty"
    >
      Os tópicos de Vida Escolar aparecerão aqui após a publicação pela
      Secretaria.
    </p>
    <section class="p-card p-stack consulta-boletim">
      <h2>Consulta de boletim e notas</h2>
      <p>
        As famílias vinculadas pela escola continuam com acesso à consulta
        reservada do aluno.
      </p>
      <router-link class="p-button" to="/vida-escolar/boletim"
        >Consultar boletim e notas</router-link
      >
    </section>
  </div>
</template>
<script setup>
import { computed } from "vue";
import { usePortal } from "../../composables/usePortal";
import { urlSegura } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { conteudos, publicacoes } = usePortal();
const topicos = computed(() =>
  conteudos.value
    .filter(
      (c) =>
        c.tipo === "servico" &&
        c.categoria === "vida-escolar" &&
        urlSegura(c.url) &&
        urlSegura(c.imagemUrl, false),
    )
    .slice()
    .sort(
      (a, b) =>
        (a.ordem || 0) - (b.ordem || 0) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    ),
);
</script>
<style scoped>
.vida-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
}
.vida-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-border);
  border-radius: 1rem;
  overflow: hidden;
  text-decoration: none;
  color: var(--p-ink);
  background: var(--p-surface);
  transition:
    box-shadow 0.18s,
    transform 0.18s;
}
.vida-card:hover {
  box-shadow: 0 10px 28px #123a4015;
  transform: translateY(-2px);
}
.vida-card:focus-visible {
  outline: 3px solid var(--p-teal);
  outline-offset: 4px;
}
.vida-card img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: contain;
  background: var(--p-soft);
  display: block;
}
.vida-conteudo {
  padding: 1.2rem;
  overflow-wrap: anywhere;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.6rem;
}
.vida-conteudo h2 {
  font-size: 1.2rem;
  margin: 0;
}
.vida-conteudo p {
  margin: 0;
  color: var(--p-muted);
  white-space: pre-line;
}
.vida-acessar {
  margin-top: auto;
  padding-top: 0.5rem;
  color: var(--p-teal);
  font-weight: 700;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.consulta-boletim {
  margin-top: 2rem;
}
.consulta-boletim h2 {
  font-size: 1.3rem;
}
.consulta-boletim .p-button {
  width: fit-content;
  white-space: normal;
  min-height: 44px;
}
@media (max-width: 950px) {
  .vida-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .vida-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .vida-card {
    transition: none;
  }
  .vida-card:hover {
    transform: none;
  }
}
</style>
