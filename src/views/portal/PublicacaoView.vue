<template>
  <article class="p-container p-page">
    <EstadoConsulta :consulta="publicacoes" /><template v-if="item"
      ><header class="p-page-head">
        <router-link :to="voltar">← Voltar às publicações</router-link>
        <p class="p-eyebrow">
          {{ item.categoria || TIPOS_CONTEUDO[item.tipo] }}
        </p>
        <h1>{{ item.titulo }}</h1>
        <p>{{ item.resumo }}</p>
        <p v-if="item.numero" class="p-small">Referência: {{ item.numero }}</p>
        <p v-if="item.dataInicio" class="p-small">
          {{ dataTexto(item.dataInicio)
          }}<template v-if="item.dataFim">
            até {{ dataTexto(item.dataFim) }}</template
          >
        </p>
        <p v-if="item.local">Local: {{ item.local }}</p>
      </header>
      <img
        v-if="item.imagemUrl"
        class="cover"
        :src="item.imagemUrl"
        :alt="item.imagemAlt"
        referrerpolicy="no-referrer"
      />
      <div class="p-card p-prose">{{ item.texto }}</div>
      <p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
      <div class="p-actions">
        <a
          v-if="urlSegura(item.url)"
          class="p-button primary"
          :href="urlSegura(item.url)"
          :target="item.url.startsWith('/') ? undefined : '_blank'"
          rel="noopener noreferrer"
          >{{
            item.tipo === "sistema"
              ? "Acessar sistema"
              : "Abrir documento ou serviço"
          }}
          <span v-if="!item.url.startsWith('/')" class="sr-only"
            >(abre em nova aba)</span
          ></a
        ><button class="p-button" :disabled="baixando" @click="baixar">
          {{
            baixando ? "Gerando PDF…" : "Baixar esta publicação em PDF"
          }}</button
        ><button class="p-button" @click="copiar">Copiar link</button>
      </div>
      <p role="status">{{ mensagem }}</p></template
    >
    <div
      v-else-if="!publicacoes.carregando.value && !publicacoes.erro.value"
      class="p-empty"
    >
      <h1>Publicação não disponível</h1>
      <p>O conteúdo pode ter sido retirado do portal.</p>
      <router-link to="/">Voltar ao início</router-link>
    </div>
  </article>
</template>
<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { usePortal } from "../../composables/usePortal";
import { TIPOS_CONTEUDO } from "../../portal/catalogo";
import { urlSegura, dataTexto, mensagemErro } from "../../portal/validacao";
import { baixarPublicacao } from "../../portal/downloads";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const route = useRoute(),
  { conteudos, publicacoes } = usePortal(),
  item = computed(() => conteudos.value.find((c) => c.id === route.params.id)),
  baixando = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  voltar = computed(
    () =>
      ({
        noticia: "/noticias",
        edital: "/editais",
        evento: "/calendario",
        biblioteca: "/biblioteca-digital",
        transporte: "/transporte-escolar",
        cardapio: "/merenda-escolar",
      })[item.value?.tipo] || "/carta-de-servicos",
  );
async function baixar() {
  baixando.value = true;
  erro.value = "";
  try {
    await baixarPublicacao(item.value);
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    baixando.value = false;
  }
}
async function copiar() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    mensagem.value = "Link copiado.";
  } catch {
    mensagem.value = "Copie o endereço na barra do navegador.";
  }
}
</script>
<style scoped>
.cover {
  width: 100%;
  max-height: 480px;
  object-fit: cover;
  border-radius: 1rem;
  margin-bottom: 2rem;
}
.p-prose {
  max-width: 960px;
}
</style>
