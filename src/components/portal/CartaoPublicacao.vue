<template>
  <router-link :to="'/publicacao/' + item.id" class="p-card p-card-link"
    ><img
      v-if="item.imagemUrl"
      :src="item.imagemUrl"
      :alt="item.imagemAlt"
      loading="lazy"
      referrerpolicy="no-referrer" /><span class="p-badge">{{
      item.categoria || TIPOS_CONTEUDO[item.tipo]
    }}</span>
    <h3>{{ item.titulo }}</h3>
    <p>{{ item.resumo }}</p>
    <p v-if="item.dataInicio" class="p-small">
      {{ dataTexto(item.dataInicio) }}
    </p>
    <span class="card-action"
      >Ver detalhes <i class="mdi mdi-arrow-right" aria-hidden="true" /></span
  ></router-link>
</template>
<script setup>
import { TIPOS_CONTEUDO } from "../../portal/catalogo";
import { dataTexto } from "../../portal/validacao";
defineProps({ item: { type: Object, required: true } });
</script>
<style scoped>
img {
  width: 100%;
  height: 170px;
  object-fit: cover;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}
h3 {
  margin-top: 0.8rem;
}
p {
  margin-bottom: 0.6rem;
}
.card-action {
  display: block;
  color: var(--p-teal);
  font-size: 0.84rem;
  font-weight: 700;
  margin-top: 1rem;
}
</style>
