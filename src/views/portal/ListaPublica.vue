<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">PORTAL DA EDUCAÇÃO</p>
      <h1>{{ route.meta.titulo }}</h1>
      <p>{{ route.meta.descricao }}</p>
    </header>
    <form class="p-grid two" @submit.prevent>
      <label class="p-field"
        >Pesquisar nesta página<input
          aria-label="Pesquisar nesta página"
          v-model="busca"
          type="search"
          maxlength="150"
          placeholder="Digite uma palavra-chave" /></label
      ><label v-if="categorias.length" class="p-field"
        >Categoria<select aria-label="Categoria" v-model="categoria">
          <option value="">Todas as categorias</option>
          <option v-for="c in categorias" :key="c">{{ c }}</option>
        </select></label
      >
    </form>
    <EstadoConsulta :consulta="publicacoes" />
    <p class="p-small p-muted" role="status">
      {{ filtrados.length }} publicação(ões)
    </p>
    <div class="p-grid p-section">
      <CartaoPublicacao
        v-for="n in filtrados.slice(0, limite)"
        :key="n.id"
        :item="n"
      />
    </div>
    <p
      v-if="
        !filtrados.length &&
        !publicacoes.carregando.value &&
        !publicacoes.erro.value
      "
      class="p-empty"
    >
      {{
        busca || categoria
          ? "Nenhum resultado para os filtros escolhidos."
          : "Ainda não há publicações nesta seção."
      }}
    </p>
    <button
      v-if="filtrados.length > limite"
      class="p-button"
      @click="limite += 12"
    >
      Mostrar mais</button
    ><router-link
      v-if="route.meta.tipo === 'transporte'"
      class="p-button primary"
      to="/atendimento?tipo=transporte"
      >Solicitar transporte escolar</router-link
    >
  </div>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { usePortal } from "../../composables/usePortal";
import { normalizarBusca } from "../../portal/validacao";
import CartaoPublicacao from "../../components/portal/CartaoPublicacao.vue";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const route = useRoute(),
  { conteudos, publicacoes } = usePortal(),
  busca = ref(""),
  categoria = ref(""),
  limite = ref(12);
const lista = computed(() =>
    conteudos.value.filter((c) => c.tipo === route.meta.tipo),
  ),
  categorias = computed(() =>
    [...new Set(lista.value.map((c) => c.categoria).filter(Boolean))].sort(),
  ),
  filtrados = computed(() =>
    lista.value.filter(
      (c) =>
        (!categoria.value || c.categoria === categoria.value) &&
        normalizarBusca(c.titulo + " " + c.resumo + " " + c.texto).includes(
          normalizarBusca(busca.value),
        ),
    ),
  );
watch(
  () => route.path,
  () => {
    busca.value = "";
    categoria.value = "";
    limite.value = 12;
  },
);
watch([busca, categoria], () => (limite.value = 12));
</script>
