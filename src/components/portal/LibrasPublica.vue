<template>
  <div data-nao-ler>
    <button v-if="publica" type="button" class="libras-botao" :aria-pressed="ativado" :aria-busy="ativado && !pronto" @click="alternar">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-12 5l-5-6a1.5 1.5 0 0 1 2-2l3 3" /></svg>
      <span>{{ ativado ? 'Desativar Libras' : 'Ativar Libras' }}</span><span aria-hidden="true">{{ ativado ? '✓' : '→' }}</span>
    </button>
    <p v-else class="libras-nota">Libras está disponível nas páginas públicas.</p>
    <p v-if="estado" class="libras-nota" role="status">{{ estado }}</p>
    <p v-if="erro" class="libras-erro" role="alert">{{ erro }}</p>
    <Teleport to="body">
      <iframe v-if="ativado && publica" ref="quadro" :class="['vlibras-widget-isolado', { 'vlibras-compacto': compacto, 'vlibras-carregando': !widgetVisivel }]" :src="`${base}libras/index.html?v=2.2`" title="VLibras Widget" sandbox="allow-scripts" referrerpolicy="no-referrer" @load="inicializar" />
      <button v-if="candidato && ativado && pronto && !compacto" type="button" class="libras-traduzir no-print" :style="posicao" data-nao-ler @click="traduzirCandidato">Traduzir em Libras</button>
    </Teleport>
  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { PAGINAS } from '../../portal/catalogo';
const emit = defineEmits(['ativado', 'erro']);
const route = useRoute(), ativado = ref(false), compacto = ref(false), pronto = ref(false), widgetVisivel = ref(false), quadro = ref(null), erro = ref(''), estado = ref(''), candidato = ref(null), posicao = ref({});
const base = import.meta.env.BASE_URL || '/';
const caminhos = new Set(['/', '/escolas', '/merenda-escolar', '/noticias', '/biblioteca-digital', '/transporte-escolar', '/carta-de-servicos', '/calendario', '/editais', '/acessibilidade', '/mapa-do-site', ...PAGINAS.map(([slug]) => '/' + slug)]);
const publica = computed(() => !route.meta.requerAuth && !route.matched.some(r => r.meta.requerAuth) && (caminhos.has(route.path) || /^\/(publicacao|servico)\/[^/]+$/.test(route.path)));
const excluir = 'form,input,textarea,select,[contenteditable]:not([contenteditable="false"]),script,style,[aria-hidden="true"],[hidden],[inert],[data-nao-ler],[data-privado],.sr-only,[role="dialog"],.acesso-flutuante,.libras-traduzir,iframe';
let prazo, realcado, sequencia = 0, ultimoEnvio = 0, aberturaInformada = false;
function desativar() { clearTimeout(prazo); aberturaInformada = false; ativado.value = false; pronto.value = false; widgetVisivel.value = false; compacto.value = false; estado.value = ''; candidato.value = null; limparRealce(); }
function alternar() {
  if (ativado.value) { desativar(); return; }
  if (!publica.value) return;
  erro.value = ''; estado.value = 'Carregando VLibras…'; ativado.value = true;
  prazo = setTimeout(() => falhar('O VLibras demorou para carregar. Verifique a conexão e tente novamente.'), 90000);
}
function informarAbertura() { if (!aberturaInformada) { aberturaInformada = true; emit('ativado'); } }
function falhar(mensagem) { desativar(); erro.value = mensagem; emit('erro'); }
function enviar(dados) { if (ativado.value && publica.value) quadro.value?.contentWindow?.postMessage(dados, '*'); }
function inicializar() { enviar({ tipo: 'seduc-libras-iniciar', versao: 2 }); }
function receber(e) {
  // O sandbox tem origem opaca (null). A identidade é a janela exata, nunca só o nome do evento.
  if (!ativado.value || !publica.value || e.source !== quadro.value?.contentWindow || e.origin !== 'null') return;
  if (e.data?.tipo === 'vlibras-pronto') { pronto.value = true; widgetVisivel.value = true; estado.value = ''; clearTimeout(prazo); informarAbertura(); }
  if (e.data?.tipo === 'vlibras-tamanho' && typeof e.data.aberto === 'boolean') {
    compacto.value = !e.data.aberto; widgetVisivel.value = true; if (e.data.aberto) informarAbertura();
    if (compacto.value) { candidato.value = null; limparRealce(); }
  }
  if (e.data?.tipo === 'vlibras-traducao-tempo') falhar('A tradução demorou para responder. Ative Libras novamente e tente um trecho menor.');
  if (e.data?.tipo === 'vlibras-falha') falhar('O VLibras não pôde carregar. Tente ativá-lo novamente.');
  if (e.data?.tipo === 'vlibras-traducao-erro' && e.data.id === sequencia) { erro.value = 'Não foi possível traduzir este trecho. Tente novamente.'; emit('erro'); }
}
function limparRealce() { realcado?.classList.remove('seduc-libras-realce'); realcado = null; }
function elementoTexto(alvo) {
  if (!ativado.value || !pronto.value || compacto.value || !publica.value || !(alvo instanceof Element) || alvo.closest(excluir)) return null;
  // Inclui textos do header e rodapé públicos; nunca lê campos ou regiões privadas.
  const raiz = alvo.closest('#conteudo-principal,.portal-header,.portal-footer');
  if (!raiz) return null;
  const el = alvo.closest('p,h1,h2,h3,h4,h5,h6,li,dt,dd,td,th,a,button,span,label,figcaption');
  if (!el || !raiz.contains(el) || el.closest(excluir) || !el.getClientRects().length) return null;
  return el;
}
function extrair(el) {
  if (!el || el.closest(excluir)) return '';
  // Usa somente nós de texto visíveis do elemento, sem innerHTML nem valores de inputs.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), partes = []; let n, total = 0;
  while ((n = walker.nextNode()) && total < 1500) {
    const p = n.parentElement;
    if (!p || p.closest(excluir) || !p.getClientRects().length || getComputedStyle(p).visibility !== 'visible') continue;
    const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) { partes.push(t); total += t.length; }
  }
  return partes.join(' ').slice(0, 1500).trim();
}
function realcar(e) { const el = elementoTexto(e.target); if (el === realcado) return; limparRealce(); if (el && extrair(el)) { realcado = el; el.classList.add('seduc-libras-realce'); } }
function traduzir(texto) {
  if (!pronto.value || !publica.value || !texto || Date.now() - ultimoEnvio < 350) return;
  ultimoEnvio = Date.now(); erro.value = ''; candidato.value = null;
  enviar({ tipo: 'seduc-libras-traduzir', texto: texto.slice(0, 1500), id: ++sequencia });
}
function oferecer(el, texto) {
  if (!texto) return;
  candidato.value = { el, texto };
  const r = el.getBoundingClientRect();
  posicao.value = { left: Math.max(8, Math.min(r.left, window.innerWidth - 228)) + 'px', top: Math.max(8, Math.min(r.bottom + 6, window.innerHeight - 60)) + 'px' };
}
function clicar(e) {
  const el = elementoTexto(e.target); if (!el || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  // Links e botões preservam sua ação; o botão contextual permite traduzir por hover/foco.
  if (el.closest('a,button,[role="button"],[role="link"]')) return;
  const selecao = window.getSelection(); if (selecao && !selecao.isCollapsed) return;
  traduzir(extrair(el));
}
function aoFocar(e) { const el = elementoTexto(e.target); if (el) oferecer(el, extrair(el)); }
function aoPassar(e) { realcar(e); const el = elementoTexto(e.target); if (el?.closest('a,button')) oferecer(el, extrair(el)); }
function selecionar() {
  if (!ativado.value || !pronto.value || compacto.value || !publica.value) return;
  const s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return;
  const range = s.getRangeAt(0), ancestral = range.commonAncestorContainer;
  const el = ancestral.nodeType === Node.ELEMENT_NODE ? ancestral : ancestral.parentElement;
  if (!el || el.closest(excluir) || !el.closest('#conteudo-principal,.portal-header,.portal-footer')) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), partes = [];
  let n, total = 0;
  while ((n = walker.nextNode()) && total < 1500) {
    const p = n.parentElement;
    if (!range.intersectsNode(n) || !p || p.closest(excluir) || !p.getClientRects().length) continue;
    if (getComputedStyle(p).visibility !== 'visible') continue;
    const inicio = n === range.startContainer ? range.startOffset : 0;
    const fim = n === range.endContainer ? range.endOffset : n.textContent.length;
    const texto = n.textContent.slice(inicio, fim).replace(/\s+/g, ' ').trim();
    if (texto) { partes.push(texto); total += texto.length; }
  }
  const texto = partes.join(' ').slice(0, 1500).trim();
  if (texto) oferecer(el, texto);
}
function traduzirCandidato() { const item = candidato.value; if (item && item.el.isConnected && !item.el.closest(excluir) && publica.value) traduzir(item.texto); }
function tecla(e) {
  if (e.key === 'Escape') { candidato.value = null; limparRealce(); }
  if (e.altKey && e.key === 'Enter') { const el = elementoTexto(e.target); if (el) { e.preventDefault(); traduzir(extrair(el)); } }
}
function rolar() { candidato.value = null; }
// Remove o iframe imediatamente ao entrar em qualquer outra rota, especialmente a administração.
watch(() => route.fullPath, () => { desativar(); erro.value = ''; }, { flush: 'sync' });
onMounted(() => {
  window.addEventListener('message', receber);
  document.addEventListener('click', clicar, true);
  document.addEventListener('pointerover', aoPassar);
  document.addEventListener('focusin', aoFocar);
  document.addEventListener('pointerup', selecionar);
  document.addEventListener('keyup', selecionar);
  document.addEventListener('keydown', tecla);
  window.addEventListener('scroll', rolar, true);
});
onBeforeUnmount(() => {
  desativar(); window.removeEventListener('message', receber);
  document.removeEventListener('click', clicar, true); document.removeEventListener('pointerover', aoPassar);
  document.removeEventListener('focusin', aoFocar); document.removeEventListener('pointerup', selecionar);
  document.removeEventListener('keyup', selecionar); document.removeEventListener('keydown', tecla);
  window.removeEventListener('scroll', rolar, true);
});
defineExpose({ desativar: () => { desativar(); erro.value = ''; } });
</script>
<style scoped>
.libras-botao{width:100%;display:flex;align-items:center;gap:10px;text-align:left}.libras-botao>span:first-of-type{flex:1}.libras-botao svg{flex-shrink:0}.libras-nota,.libras-erro{margin:8px 0 0;font-size:.8rem;line-height:1.5;color:var(--p-muted,#536b70)}.libras-erro{color:var(--p-error,#a9261b)}
.vlibras-widget-isolado{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:180;width:min(400px,calc(100vw - 24px));height:min(640px,calc(100vh - 24px));height:min(640px,calc(100dvh - 24px));border:0;background:transparent;color-scheme:light;}
.vlibras-widget-isolado.vlibras-compacto{width:80px;height:80px}.vlibras-carregando{width:1px;height:1px;opacity:0;pointer-events:none}
.libras-traduzir{position:fixed;z-index:200;border:1px solid #fff;border-radius:8px;padding:10px 14px;min-height:44px;width:220px;max-width:calc(100vw - 16px);background:#005ba5;color:#fff;box-shadow:0 3px 14px #0003;font:600 .85rem/1.4 Arial,sans-serif;text-align:center}
@media print{.vlibras-widget-isolado,.libras-traduzir{display:none}}
</style>
<style>
.seduc-libras-realce{outline:2px dashed var(--p-blue,#005ba5);outline-offset:3px;cursor:help}
</style>
