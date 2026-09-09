<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">INFORMAÇÃO PÚBLICA</p>
      <h1>{{ titulo }}</h1>
      <p>{{ descricao }}</p>
    </header>
    <EstadoConsulta :consulta="publicacoes" />
    <div v-if="pagina" class="p-card p-prose">{{ pagina.texto }}</div>
    <div v-else-if="slug === 'privacidade'" class="p-card p-prose">
      As páginas públicas podem ser consultadas sem criar uma conta. Para abrir
      solicitações ou consultar boletins, utilizamos a identificação da conta e
      os dados necessários ao atendimento. Solicitações e dados escolares são
      acessíveis apenas ao titular e aos profissionais autorizados. CPFs de
      confirmações internas não são publicados na área de merenda. Não informe
      dados de saúde, documentos ou informações de terceiros em campos livres de
      atendimento. Os controles de fonte e contraste são salvos apenas no
      navegador. A autenticação utiliza o Firebase. Para informações sobre o
      tratamento de dados ou exercer direitos, utilize o canal Fale conosco. Os
      canais oficiais e os prazos de retenção devem ser publicados pela
      Secretaria.
    </div>
    <p
      v-else-if="
        !publicacoes.carregando.value &&
        !publicacoes.erro.value &&
        !lista.length
      "
      class="p-empty"
    >
      As informações desta seção ainda não foram publicadas pela Secretaria.
    </p>
    <div class="p-grid p-section">
      <CartaoPublicacao v-for="c in lista" :key="c.id" :item="c" />
    </div>
    <div v-if="slug === 'acesso-a-informacao'" class="p-actions">
      <router-link class="p-button primary" to="/atendimento?tipo=informacao"
        >Solicitar informação</router-link
      ><router-link class="p-button" to="/transparencia"
        >Consultar transparência</router-link
      >
    </div>
  </div>
</template>
<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { usePortal } from "../../composables/usePortal";
import { PAGINAS } from "../../portal/catalogo";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
import CartaoPublicacao from "../../components/portal/CartaoPublicacao.vue";
const route = useRoute(),
  { conteudos, publicacoes } = usePortal(),
  slug = computed(() => route.meta.slug),
  dados = computed(() => PAGINAS.find((p) => p[0] === slug.value) || []),
  titulo = computed(() => dados.value[1]),
  descricao = computed(() => dados.value[2]),
  pagina = computed(() =>
    conteudos.value.find((c) => c.tipo === "pagina" && c.slug === slug.value),
  ),
  lista = computed(() =>
    conteudos.value.filter(
      (c) =>
        (c.tipo === "documento" && c.categoria === slug.value) ||
        (slug.value === "indicadores" && c.tipo === "indicador") ||
        (slug.value === "sistemas" && c.tipo === "sistema"),
    ),
  );
</script>
