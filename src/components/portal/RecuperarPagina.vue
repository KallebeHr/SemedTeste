<template>
  <div v-if="navegando" class="route-progress" role="status"><span class="sr-only">Abrindo página…</span></div>
  <aside v-if="falhaNavegacao" class="p-card recovery-message" role="alert">
    <h2>Não foi possível abrir a página</h2>
    <p>{{ falhaNavegacao.modulo ? 'Pode haver uma nova versão do portal ou uma falha de conexão ao carregar os arquivos.' : 'Ocorreu uma falha na navegação. Tente novamente e informe a administração se persistir.' }}</p>
    <p>Salve ou copie seu trabalho antes de recarregar. Dados não confirmados pelo servidor não estão salvos.</p>
    <div class="p-actions"><button class="p-button primary" @click="recarregar">Recarregar página</button><button class="p-button" @click="falhaNavegacao = null">Continuar nesta tela</button></div>
  </aside>
</template>
<script setup>
import { falhaNavegacao, navegando } from '../../portal/navegacao';
function recarregar() { window.location.assign(falhaNavegacao.value.destino); }
</script>
<style scoped>
.recovery-message { position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); width: min(42rem, calc(100% - 2rem)); z-index: 200; border: 2px solid var(--p-error); box-shadow: 0 6px 30px #0003; }
.route-progress { position: fixed; inset: 0 0 auto; height: 4px; background: var(--p-teal); z-index: 200; }
</style>
