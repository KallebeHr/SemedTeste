<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">BUSCA NO PORTAL</p>
      <h1>O que você procura?</h1>
    </header>
    <form @submit.prevent="buscar">
      <label class="p-field"
        >Pesquisar serviços e publicações<input
          aria-label="Pesquisar serviços e publicações"
          v-model="texto"
          type="search"
          maxlength="150"
      /></label>
      <div class="p-actions">
        <button class="p-button primary">Pesquisar</button>
      </div>
    </form>
    <EstadoConsulta :consulta="publicacoes" />
    <p class="p-muted" role="status">
      {{ resultados.length }} resultado(s){{
        termo ? " para “" + termo + "”" : ""
      }}
    </p>
    <div class="p-stack">
      <router-link
        v-for="r in resultados.slice(0, limite)"
        :key="r.caminho"
        :to="r.caminho"
        class="p-card p-card-link"
        ><span class="p-badge">{{ r.tipo }}</span>
        <h2>{{ r.titulo }}</h2>
        <p>{{ r.resumo }}</p></router-link
      >
    </div>
    <p v-if="!resultados.length" class="p-empty">
      Tente outra palavra ou consulte a
      <router-link to="/carta-de-servicos">carta de serviços</router-link>.
    </p>
    <button
      v-if="resultados.length > limite"
      class="p-button"
      @click="limite += 20"
    >
      Mostrar mais resultados
    </button>
  </div>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePortal } from "../../composables/usePortal";
import { PAGINAS, TIPOS_CONTEUDO } from "../../portal/catalogo";
import { normalizarBusca } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const route = useRoute(),
  router = useRouter(),
  { servicos, conteudos, publicacoes, escolas } = usePortal(),
  termo = computed(() => String(route.query.q || "").slice(0, 150)),
  texto = ref(termo.value),
  limite = ref(20);
const indice = computed(() => [
  ...servicos.value.map((s) => ({
    ...s,
    caminho: "/servico/" + s.id,
    tipo: "Serviço",
  })),
  ...PAGINAS.map(([id, titulo, resumo]) => ({
    titulo,
    resumo,
    caminho: "/" + id,
    tipo: "Institucional",
  })),
  ...conteudos.value
    .filter((c) => c.tipo !== "servico")
    .map((c) => ({
      ...c,
      caminho: "/publicacao/" + c.id,
      tipo: TIPOS_CONTEUDO[c.tipo],
    })),
  ...escolas.dados.value.map((e) => ({
    titulo: e.nome,
    resumo: e.endereco || "",
    caminho: "/escolas?escola=" + e.id,
    tipo: "Escola",
  })),
]);
const resultados = computed(() => {
  const partes = normalizarBusca(termo.value).split(/\s+/).filter(Boolean);
  return indice.value.filter((r) =>
    partes.every((p) =>
      normalizarBusca(
        r.titulo + " " + r.resumo + " " + (r.texto || ""),
      ).includes(p),
    ),
  );
});
function buscar() {
  router.replace({
    path: "/busca",
    query: texto.value.trim() ? { q: texto.value.trim() } : {},
  });
}
watch(termo, (v) => {
  texto.value = v;
  limite.value = 20;
});
</script>
