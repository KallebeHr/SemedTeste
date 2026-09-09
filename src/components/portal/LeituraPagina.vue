<template>
  <div class="leitura" data-nao-ler>
    <div class="leitura-acoes">
      <button v-if="!lendo" type="button" @click="iniciar">Ouvir página</button>
      <template v-else>
        <button type="button" @click="pausar">{{ pausada ? 'Retomar leitura' : 'Pausar leitura' }}</button>
        <button type="button" @click="parar">Parar leitura</button>
      </template>
    </div>
    <label class="leitura-velocidade">Velocidade
      <select v-model.number="velocidade" :disabled="lendo" aria-label="Velocidade da leitura">
        <option :value="0.8">Mais lenta</option><option :value="1">Normal</option><option :value="1.2">Mais rápida</option>
      </select>
    </label>
    <span v-if="mensagem" class="leitura-aviso" role="status">{{ mensagem }}</span>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { textoAcessivel, trechosDeVoz } from '../../portal/textoAcessivel';
const route = useRoute(), lendo = ref(false), pausada = ref(false), mensagem = ref(''), velocidade = ref(1);
let geracao = 0, falaAtual, voz;
function vozes() { voz = window.speechSynthesis?.getVoices().find(v => v.localService && /^pt(?:-|_)/i.test(v.lang)); }
function parar() { geracao++; window.speechSynthesis?.cancel(); falaAtual = null; lendo.value = false; pausada.value = false; mensagem.value = ''; }
function iniciar() {
  parar(); const sintese = window.speechSynthesis;
  if (!sintese || !window.SpeechSynthesisUtterance) { mensagem.value = 'Leitura em voz alta indisponível neste navegador.'; return; }
  vozes();
  if (!voz) { mensagem.value = 'Nenhuma voz local em português disponível. Ative uma voz de português nas configurações de fala do dispositivo e tente novamente.'; return; }
  const trechos = trechosDeVoz(textoAcessivel(document.getElementById('conteudo-principal')));
  if (!trechos.length) { mensagem.value = 'Não há texto disponível para leitura nesta página.'; return; }
  const g = geracao; lendo.value = true;
  function proximo(i) {
    if (g !== geracao) return;
    if (i >= trechos.length) { parar(); mensagem.value = 'Leitura concluída.'; return; }
    falaAtual = new SpeechSynthesisUtterance(trechos[i]); falaAtual.voice = voz; falaAtual.lang = voz.lang; falaAtual.rate = velocidade.value;
    falaAtual.onend = () => proximo(i + 1);
    falaAtual.onerror = () => { if (g === geracao) { parar(); mensagem.value = 'A leitura foi interrompida. Tente novamente.'; } };
    sintese.speak(falaAtual);
  }
  proximo(0);
}
function pausar() { if (pausada.value) window.speechSynthesis.resume(); else window.speechSynthesis.pause(); pausada.value = !pausada.value; }
watch(() => route.fullPath, parar);
onMounted(() => { vozes(); window.speechSynthesis?.addEventListener('voiceschanged', vozes); });
onUnmounted(() => { parar(); window.speechSynthesis?.removeEventListener('voiceschanged', vozes); });
defineExpose({ parar: () => { parar(); velocidade.value = 1; } });
</script>
<style scoped>
.leitura{display:grid;gap:10px}.leitura-acoes{display:flex;gap:8px;flex-wrap:wrap}.leitura-acoes button{flex:1}.leitura-velocidade{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:.82rem}.leitura-velocidade select{flex:1;min-width:100px}.leitura-aviso{font-size:.8rem;color:var(--p-muted,#536b70);line-height:1.5}
</style>
