<template>
  <div class="leitura" data-nao-ler>
    <button v-if="!lendo" @click="iniciar">Ouvir página</button>
    <template v-else><button @click="pausar">{{pausada?'Retomar leitura':'Pausar leitura'}}</button><button @click="parar">Parar leitura</button></template>
    <span v-if="mensagem" class="leitura-aviso" role="status">{{mensagem}}</span>
  </div>
</template>
<script setup>
import {ref,watch,onUnmounted} from 'vue';
import {useRoute} from 'vue-router';
import {textoAcessivel,trechosDeVoz} from '../../portal/textoAcessivel';
const route=useRoute(),lendo=ref(false),pausada=ref(false),mensagem=ref('');
let geracao=0;
function parar(){geracao++;window.speechSynthesis?.cancel();lendo.value=false;pausada.value=false;mensagem.value='';}
function iniciar(){
  parar();const sintese=window.speechSynthesis;
  if(!sintese){mensagem.value='Leitura em voz alta indisponível neste navegador.';return;}
  const voz=sintese.getVoices().find(v=>v.localService && /^pt(?:-|_)/i.test(v.lang));
  if(!voz){mensagem.value='Instale uma voz de português no dispositivo e tente novamente. Usamos somente vozes locais para preservar a privacidade.';return;}
  const trechos=trechosDeVoz(textoAcessivel(document.getElementById('conteudo-principal')));
  if(!trechos.length){mensagem.value='Não há texto disponível para leitura nesta página.';return;}
  const g=geracao;lendo.value=true;
  function proximo(i){if(g!==geracao)return;if(i>=trechos.length){parar();mensagem.value='Leitura concluída.';return;}
    const fala=new SpeechSynthesisUtterance(trechos[i]);fala.voice=voz;fala.lang=voz.lang;fala.rate=1;
    fala.onend=()=>proximo(i+1);fala.onerror=()=>{if(g===geracao){parar();mensagem.value='A leitura foi interrompida pelo navegador. Tente novamente.';}};sintese.speak(fala);
  }
  proximo(0);
}
function pausar(){if(pausada.value)window.speechSynthesis.resume();else window.speechSynthesis.pause();pausada.value=!pausada.value;}
watch(()=>route.fullPath,parar);onUnmounted(parar);
</script>
<style scoped>.leitura{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}.leitura button{padding:.4rem .6rem;min-height:44px;border-radius:.3rem}.leitura-aviso{max-width:32rem;color:var(--p-ink)}</style>
