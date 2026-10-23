<template>
  <section
    v-if="dados"
    class="p-card p-stack"
    aria-label="Documentos e inscrição do edital"
  >
    <div class="p-actions">
      <a
        v-if="dados.config.temPdf"
        class="p-button"
        :href="'/api/editais?acao=pdf&editalId=' + encodeURIComponent(editalId)"
        >Baixar Edital PDF Completo</a
      ><router-link
        v-if="dados.config.ativo && !dados.aviso"
        class="p-button primary"
        :to="'/inscricao/' + editalId"
        >Realizar Inscrição Online</router-link
      >
    </div>
    <p v-if="dados.config.ativo && dados.aviso" role="status">
      {{ dados.aviso }}
    </p>
  </section>
  <p v-if="erro" role="alert">
    Não foi possível consultar os documentos e inscrições.
    <button class="p-button" @click="carregar">Tentar novamente</button>
  </p>
</template>
<script setup>
import { ref, watch, onUnmounted } from "vue";
import { lerEdital } from "../../services/editaisApi";
import { abertura } from "../../../shared/editais.mjs";
const props = defineProps({ editalId: String }),
  dados = ref(null),
  erro = ref(false);
let offset = 0;
async function carregar() {
  erro.value = false;
  try {
    dados.value = await lerEdital(props.editalId);
    offset = dados.value.agora - Date.now();
  } catch (e) {
    dados.value = null;
    erro.value = !e.message.includes("não disponível");
  }
}
watch(() => props.editalId, carregar, { immediate: true });
const timer = setInterval(() => {
  if (dados.value)
    dados.value.aviso = abertura(dados.value.config, Date.now() + offset);
}, 1000);
onUnmounted(() => clearInterval(timer));
</script>
