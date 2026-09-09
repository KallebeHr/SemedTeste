<template>
  <div class="p-container p-page">
    <header class="p-page-head"><h1>Mapa do site</h1></header>
    <div class="p-grid">
      <section class="p-card">
        <h2>Serviços</h2>
        <ul>
          <li v-for="s in SERVICOS" :key="s.id">
            <router-link :to="s.caminho">{{ s.titulo }}</router-link>
          </li>
        </ul>
      </section>
      <section class="p-card">
        <h2>Institucional</h2>
        <ul>
          <li v-for="p in PAGINAS" :key="p[0]">
            <router-link :to="'/' + p[0]">{{ p[1] }}</router-link>
          </li>
        </ul>
      </section>
      <section class="p-card">
        <h2>Navegação</h2>
        <ul>
          <li><router-link to="/">Página inicial</router-link></li>
          <li><router-link to="/noticias">Notícias</router-link></li>
          <li><router-link to="/busca">Busca</router-link></li>
          <li>
            <router-link to="/acessibilidade">Acessibilidade</router-link>
          </li>
          <li>
            <router-link to="/atendimento">Minhas solicitações</router-link>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
<script setup>
import { SERVICOS, PAGINAS } from "../../portal/catalogo";
</script>
<style scoped>
ul {
  padding-left: 1.2rem;
}
li {
  margin: 0.6rem 0;
}
</style>
