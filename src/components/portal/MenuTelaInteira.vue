<template>
  <Teleport to="body">
    <dialog ref="dialogo" class="menu-tela-inteira" :aria-label="titulo" @cancel.prevent="$emit('fechar')">
      <header class="menu-tela-topo"><strong>{{titulo}}</strong><button type="button" class="menu-fechar" aria-label="Fechar menu" autofocus @click="$emit('fechar')"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
      <div class="menu-tela-opcoes"><slot /></div>
    </dialog>
  </Teleport>
</template>
<script setup>
import {ref,watch,nextTick,onBeforeUnmount} from 'vue';
const props=defineProps({aberto:Boolean,titulo:{type:String,default:'Menu'}});
defineEmits(['fechar']);
const dialogo=ref(null);let overflowAnterior=null;
function liberar(){if(overflowAnterior!==null){document.body.style.overflow=overflowAnterior;overflowAnterior=null;}}
watch(()=>props.aberto,async aberto=>{await nextTick();if(!dialogo.value)return;if(aberto && props.aberto){if(!dialogo.value.open)dialogo.value.showModal();if(overflowAnterior===null){overflowAnterior=document.body.style.overflow;document.body.style.overflow='hidden';}}else{dialogo.value.close();liberar();}},{immediate:true});
onBeforeUnmount(()=>{dialogo.value?.close();liberar();});
</script>
<style scoped>
.menu-tela-inteira{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:var(--p-surface);color:var(--p-ink);overscroll-behavior:contain;overflow-y:auto;}
.menu-tela-inteira::backdrop{background:var(--p-surface)}
.menu-tela-topo{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:max(1rem,env(safe-area-inset-top)) max(1rem,env(safe-area-inset-right)) 1rem max(1rem,env(safe-area-inset-left));background:var(--p-surface);border-bottom:1px solid var(--p-border);z-index:1;font-size:1.2rem;}
.menu-fechar{display:grid;place-items:center;min-width:48px;min-height:48px;border:1px solid var(--p-border);border-radius:.6rem;color:var(--p-ink);background:var(--p-soft);flex-shrink:0;}
.menu-tela-opcoes{padding:1rem max(1rem,env(safe-area-inset-right)) max(2rem,env(safe-area-inset-bottom)) max(1rem,env(safe-area-inset-left));}
.menu-tela-opcoes :deep(nav){display:grid;gap:.4rem}.menu-tela-opcoes :deep(nav a){display:block;padding:.85rem;text-decoration:none;color:var(--p-ink);border-radius:.5rem;}
.menu-tela-opcoes :deep(a.router-link-exact-active){background:var(--p-soft);color:var(--p-teal)}
</style>
