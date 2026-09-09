<template>
  <section class="p-card p-section">
    <div class="p-section-head">
      <h2>Alertas da alimentação</h2>
      <span class="p-badge"
        >{{ pendentes.length }} pendente(s) entre os últimos 100 alertas</span
      >
    </div>
    <EstadoConsulta :consulta="consulta" />
    <p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
    <div v-for="n in pendentes.slice(0, 10)" :key="n.id" class="p-alert">
      <h3>{{ n.titulo }}</h3>
      <p>{{ n.mensagem }}</p>
      <p class="p-small">{{ dataTexto(n.criadoEm) }}</p>
      <div class="p-actions">
        <router-link class="p-button" to="/administracao/merenda"
          >Abrir alimentação escolar</router-link
        ><button class="p-button" :disabled="ocupado" @click="ler(n)">
          Marcar como lido para mim
        </button>
      </div>
    </div>
    <p v-if="!pendentes.length && !consulta.carregando.value" class="p-muted">
      Nenhum alerta pendente entre os registros carregados.
    </p>
  </section>
</template>
<script setup>
import { ref, computed } from "vue";
import { usarCaixaEntrada } from '../../composables/useCaixaEntrada';
import { dataTexto, mensagemErro } from "../../portal/validacao";
import EstadoConsulta from "./EstadoConsulta.vue";
const caixa = usarCaixaEntrada(), consulta = caixa.alertas,
  pendentes = computed(() => caixa.naoLidas.value.filter(n=>n.origem==='alerta')),
  erro = ref(""),
  ocupado = ref(false);
async function ler(n) {
  ocupado.value = true;
  erro.value = "";
  try {
    await caixa.marcarLida(n);
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
</script>
