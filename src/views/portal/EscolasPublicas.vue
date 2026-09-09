<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">NOSSA REDE</p>
      <h1>Escolas de Pedro II</h1>
      <p>
        Informações e contatos públicos das unidades cadastradas pela
        Secretaria.
      </p>
    </header>
    <label class="p-field"
      >Encontrar escola<input
        aria-label="Encontrar escola"
        v-model="busca"
        type="search"
        placeholder="Nome ou localidade" /></label
    ><EstadoConsulta :consulta="escolas" />
    <div class="p-grid p-section">
      <article v-for="e in filtradas" :key="e.id" class="p-card">
        <span class="p-icon"
          ><i class="mdi mdi-school-outline" aria-hidden="true"
        /></span>
        <h2>{{ e.nome }}</h2>
        <p>{{ e.etapas }}</p>
        <p class="p-prose">{{ e.sobre }}</p>
        <dl class="school-dl">
          <template v-if="e.endereco"
            ><dt>Endereço</dt>
            <dd>{{ e.endereco }}</dd></template
          ><template v-if="e.contato"
            ><dt>Contato</dt>
            <dd>{{ e.contato }}</dd></template
          ><template v-if="e.horario"
            ><dt>Atendimento</dt>
            <dd>{{ e.horario }}</dd></template
          >
        </dl>
        <router-link class="p-button" :to="'/merenda-escolar?escola=' + e.id"
          >Cardápios e vistorias</router-link
        >
      </article>
    </div>
    <p
      v-if="
        !filtradas.length && !escolas.carregando.value && !escolas.erro.value
      "
      class="p-empty"
    >
      {{
        busca
          ? "Nenhuma escola encontrada."
          : "Nenhuma escola foi publicada ainda."
      }}
    </p>
  </div>
</template>
<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { usePortal } from "../../composables/usePortal";
import { normalizarBusca } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { escolas } = usePortal(),
  route = useRoute(),
  busca = ref(""),
  filtradas = computed(() =>
    escolas.dados.value
      .filter(
        (e) =>
          (!route.query.escola || e.id === route.query.escola) &&
          normalizarBusca(e.nome + " " + e.endereco).includes(
            normalizarBusca(busca.value),
          ),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  );
</script>
<style scoped>
.school-dl {
  margin: 1rem 0;
}
.school-dl dt {
  font-size: 0.8rem;
  color: var(--p-muted);
  margin-top: 0.65rem;
}
.school-dl dd {
  overflow-wrap: anywhere;
}
</style>
