<template>
  <Teleport to="body">
    <div class="acesso-flutuante no-print" data-nao-ler>
      <button ref="botao" class="acesso-icone" aria-label="Abrir menu de acessibilidade" aria-haspopup="dialog" :aria-expanded="aberto" aria-controls="menu-acessibilidade" @click="alternarMenu">
        <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="16" cy="16" r="14" /><circle cx="16" cy="8" r="2" fill="currentColor" stroke="none" /><path d="m8 12 8 2 8-2M16 14v6m0 0-5 6m5-6 5 6" /></svg>
      </button>
      <dialog id="menu-acessibilidade" ref="painel" :open="aberto" class="acesso-painel p-card" aria-labelledby="titulo-acessibilidade" tabindex="-1" @keydown.esc.stop.prevent="fechar">
        <header><h2 id="titulo-acessibilidade">Acessibilidade</h2><button class="acesso-fechar" aria-label="Fechar acessibilidade" @click="fechar">×</button></header>
        <div class="acesso-fontes"><span>Tamanho do texto</span><div><button aria-label="Diminuir tamanho da fonte" :disabled="escala<=90" @click="definir(escala-10)">A−</button><button aria-label="Restaurar tamanho da fonte" @click="definir(100)">A</button><button aria-label="Aumentar tamanho da fonte" :disabled="escala>=200" @click="definir(escala+10)">A+</button></div></div>
        <button class="acesso-opcao" :aria-pressed="contraste" @click="alternarContraste">{{contraste?'Contraste padrão':'Alto contraste'}}</button>
        <LeituraPagina />
        <LibrasPublica @ativado="fechar" />
        <router-link to="/acessibilidade" @click="fechar">Mais sobre acessibilidade</router-link>
        <span class="sr-only" role="status">Tamanho da fonte: {{escala}}%</span>
      </dialog>
    </div>
  </Teleport>
</template>
<script setup>
import {ref,onMounted,onBeforeUnmount,nextTick,watch} from 'vue';
import {useRoute} from 'vue-router';
import LeituraPagina from './portal/LeituraPagina.vue';
import LibrasPublica from './portal/LibrasPublica.vue';
const escala=ref(100),contraste=ref(false),aberto=ref(false),botao=ref(null),painel=ref(null),route=useRoute();
function salvar(k,v){try{localStorage.setItem(k,v);}catch{/* A preferência continua funcionando nesta sessão. */}}
function definir(v){escala.value=Math.min(200,Math.max(90,Number(v)||100));document.documentElement.style.fontSize=escala.value+'%';salvar('site-font-scale',String(escala.value));}
function alternarContraste(){contraste.value=!contraste.value;document.documentElement.classList.toggle('high-contrast',contraste.value);salvar('site-high-contrast',String(contraste.value));}
function fechar(){aberto.value=false;botao.value?.focus({preventScroll:true});}
async function alternarMenu(){if(aberto.value){fechar();return;}aberto.value=true;await nextTick();painel.value?.focus({preventScroll:true});}
function fora(e){if(aberto.value && !painel.value?.contains(e.target) && !botao.value?.contains(e.target))aberto.value=false;}
watch(()=>route.fullPath,()=>{aberto.value=false;});
onMounted(()=>{try{definir(localStorage.getItem('site-font-scale'));contraste.value=localStorage.getItem('site-high-contrast')==='true';document.documentElement.classList.toggle('high-contrast',contraste.value);}catch{/* Preferências indisponíveis. */}document.addEventListener('pointerdown',fora);});
onBeforeUnmount(()=>document.removeEventListener('pointerdown',fora));
</script>
<style scoped>
.acesso-flutuante{position:fixed;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));z-index:190;color:var(--p-ink);}
.acesso-icone{width:56px;height:56px;display:grid;place-items:center;border-radius:50%;background:var(--p-blue);color:white;border:2px solid white;box-shadow:0 3px 16px #0003;}
:global(html.high-contrast) .acesso-icone{background:#000;border-color:#fff}
.acesso-painel{position:fixed;inset:auto auto calc(max(16px,env(safe-area-inset-bottom)) + 70px) max(16px,env(safe-area-inset-left));margin:0;width:min(340px,calc(100vw - 32px));max-height:calc(100dvh - 110px);overflow:auto;border:1px solid var(--p-border);background:var(--p-surface);color:var(--p-ink);box-shadow:0 8px 32px #0003;padding:1rem;font-size:1rem;}
.acesso-painel[open]{display:grid;gap:.9rem}
.acesso-painel header{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.acesso-painel h2{font-size:1.15rem;margin:0}
.acesso-fechar{font-size:1.7rem;width:44px;min-height:44px;flex-shrink:0}
.acesso-fontes{display:grid;gap:.35rem}.acesso-fontes>div{display:flex;gap:.4rem}.acesso-fontes button{flex:1}
.acesso-painel :deep(button:not(.acesso-fechar)){min-height:44px;padding:.5rem .7rem;border:1px solid var(--p-border);border-radius:.5rem;color:var(--p-ink);background:var(--p-soft);}
.acesso-opcao{text-align:left}.acesso-painel a{padding:.35rem 0;color:var(--p-blue)}
</style>
