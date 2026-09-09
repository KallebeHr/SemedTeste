<template>
  <v-app
    ><a href="#conteudo-principal" class="skip-link"
      >Ir para o conteúdo principal</a
    ><NavHeader v-if="!administracao" /><SubNavHeader /><v-main tag="div"
      ><div v-if="navegando" role="status" class="route-loading">Abrindo página…</div><main id="conteudo-principal" tabindex="-1">
        <router-view /></main></v-main
    ><PortalFooter v-if="!administracao" />
    <SessaoSegura />
    <RecuperarPagina />
    <div v-if="offline" class="offline" role="status">
      Você está sem conexão. Operações só são concluídas após a confirmação do
      servidor.
    </div></v-app
  >
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import NavHeader from "./components/NavHeader.vue";
import SubNavHeader from "./components/SubNavHeader.vue";
import PortalFooter from "./components/portal/PortalFooter.vue";
import SessaoSegura from './components/portal/SessaoSegura.vue';
import RecuperarPagina from './components/portal/RecuperarPagina.vue';
import { navegando } from './portal/navegacao';
import { fornecerPortal } from "./composables/usePortal";
import { aguardarAutenticacao } from "./composables/useAuth";
import "./styles/portal.css";
fornecerPortal();
aguardarAutenticacao();
const route = useRoute(),
  administracao = computed(
    () => route.path.startsWith("/administracao") || route.path === "/login",
  ),
  offline = ref(!navigator.onLine);
function rede() {
  offline.value = !navigator.onLine;
}
onMounted(() => {
  window.addEventListener("online", rede);
  window.addEventListener("offline", rede);
});
onUnmounted(() => {
  window.removeEventListener("online", rede);
  window.removeEventListener("offline", rede);
});
watch(
  () => route.path,
  async () => {
    await nextTick();
    document
      .getElementById("conteudo-principal")
      ?.focus({ preventScroll: true });
  },
);
</script>
<style scoped>
.offline {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #723e00;
  color: white;
  padding: 0.65rem 1rem;
  text-align: center;
  font-size: 0.9rem;
}
</style>
