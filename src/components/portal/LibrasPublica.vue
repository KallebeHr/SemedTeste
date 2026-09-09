<template>
  <div v-if="publica" data-nao-ler>
    <button :aria-pressed="ativado" @click="alternar">{{ativado?'Desativar Libras':'Libras'}}</button>
    <p v-if="erro" role="alert">{{erro}}</p>
    <Teleport to="body">
      <iframe v-if="ativado" ref="quadro" :class="['vlibras-widget-isolado',{'vlibras-compacto':compacto}]" src="/libras/index.html" title="VLibras Widget" sandbox="allow-scripts" referrerpolicy="same-origin" @load="enviar" />
    </Teleport>
  </div>
</template>
<script setup>
import {ref,computed,watch,onMounted,onBeforeUnmount} from 'vue';
import {useRoute} from 'vue-router';
import {PAGINAS} from '../../portal/catalogo';
import {textoAcessivel} from '../../portal/textoAcessivel';
const emit=defineEmits(['ativado']);
const route=useRoute(),ativado=ref(false),compacto=ref(false),quadro=ref(null),erro=ref('');
const caminhos=new Set(['/','/escolas','/merenda-escolar','/noticias','/biblioteca-digital','/transporte-escolar','/carta-de-servicos','/calendario','/editais','/acessibilidade','/mapa-do-site',...PAGINAS.map(([slug])=>'/'+slug)]);
const publica=computed(()=>!route.meta.requerAuth && (caminhos.has(route.path)||/^\/(publicacao|servico)\/[^/]+$/.test(route.path)));
function alternar(){ativado.value=!ativado.value;compacto.value=false;erro.value='';if(ativado.value)emit('ativado');}
function enviar(){if(publica.value && ativado.value)quadro.value?.contentWindow?.postMessage({tipo:'seduc-texto-publico',texto:textoAcessivel(document.getElementById('conteudo-principal'))},'*');}
function receber(e){if(e.source!==quadro.value?.contentWindow)return;if(e.data?.tipo==='vlibras-tamanho' && typeof e.data.aberto==='boolean')compacto.value=!e.data.aberto;if(e.data?.tipo==='vlibras-falha'){erro.value='O VLibras não carregou. Tente ativá-lo novamente.';ativado.value=false;}}
watch(()=>route.fullPath,()=>{ativado.value=false;erro.value='';});
onMounted(()=>window.addEventListener('message',receber));
onBeforeUnmount(()=>window.removeEventListener('message',receber));
</script>
<style scoped>
button{padding:.5rem .7rem;min-height:44px}
.vlibras-widget-isolado{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:180;width:min(400px,calc(100vw - 24px));height:min(640px,calc(100dvh - 24px));border:0;background:transparent;color-scheme:light;}
.vlibras-widget-isolado.vlibras-compacto{width:80px;height:80px}
@media print{.vlibras-widget-isolado{display:none}}
</style>
