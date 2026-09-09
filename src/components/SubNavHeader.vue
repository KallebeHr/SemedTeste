<template>
  <Teleport to="body">
    <div class="acesso-flutuante no-print" data-nao-ler data-a11y-ui>
      <button ref="botao" type="button" class="acesso-icone" aria-label="Abrir menu de acessibilidade" aria-haspopup="dialog" :aria-expanded="aberto" aria-controls="menu-acessibilidade" @click="alternarMenu">
        <Icone nome="acesso" :tamanho="30" />
        <span v-if="totalAtivos" class="acesso-contador" aria-hidden="true">{{ totalAtivos }}</span>
      </button>
      <section v-show="aberto" id="menu-acessibilidade" ref="painel" class="acesso-painel" role="dialog" aria-modal="false" aria-labelledby="titulo-acessibilidade" tabindex="-1" @keydown.esc.stop.prevent="fechar">
        <header class="acesso-cabecalho">
          <span class="acesso-marca"><Icone nome="acesso" :tamanho="26" /></span>
          <div><h2 id="titulo-acessibilidade">Acessibilidade</h2><p>Ajuste a página para você</p></div>
          <button type="button" class="acesso-fechar" aria-label="Fechar acessibilidade" @click="fechar"><Icone nome="fechar" /></button>
        </header>
        <div class="acesso-conteudo">
          <section class="acesso-texto" aria-labelledby="acesso-texto-titulo">
            <div class="acesso-linha"><h3 id="acesso-texto-titulo">Tamanho do texto</h3><output aria-live="polite" aria-label="Tamanho da fonte">{{ preferencias.escala }}%</output></div>
            <div class="acesso-fontes">
              <button type="button" aria-label="Diminuir tamanho da fonte" :disabled="preferencias.escala <= 90" @click="definirEscala(preferencias.escala - 10)">A<span aria-hidden="true">−</span></button>
              <button type="button" class="acesso-tamanho-padrao" aria-label="Restaurar tamanho da fonte" @click="definirEscala(100)">Padrão</button>
              <button type="button" aria-label="Aumentar tamanho da fonte" :disabled="preferencias.escala >= 200" @click="definirEscala(preferencias.escala + 10)">A<span aria-hidden="true">+</span></button>
            </div>
          </section>
          <div class="acesso-grade" role="group" aria-label="Ajustes de visualização">
            <button v-for="opcao in opcoes" :key="opcao.chave" type="button" class="acesso-ajuste" :aria-pressed="preferencias[opcao.chave]" @click="preferencias[opcao.chave] = !preferencias[opcao.chave]">
              <span class="acesso-ajuste-topo"><Icone :nome="opcao.icone" /><span class="acesso-check" aria-hidden="true">{{ preferencias[opcao.chave] ? '✓' : '+' }}</span></span>
              <span>{{ opcao.nome }}</span>
            </button>
          </div>
          <section class="acesso-recurso" aria-labelledby="acesso-voz-titulo">
            <h3 id="acesso-voz-titulo"><Icone nome="voz" /> Leitura em voz alta</h3>
            <LeituraPagina ref="leitura" />
          </section>
          <section class="acesso-recurso" aria-label="Tradução em Libras">
            <LibrasPublica ref="libras" @ativado="fechar" @erro="abrirSemFoco" />
          </section>
        </div>
        <footer class="acesso-rodape">
          <button type="button" class="acesso-restaurar" @click="restaurar"><Icone nome="restaurar" :tamanho="18" /> Restaurar preferências</button>
          <router-link to="/acessibilidade" @click="fechar">Ajuda de acessibilidade <span aria-hidden="true">↗</span></router-link>
        </footer>
      </section>
      <span class="acesso-sr" role="status" aria-live="polite">{{ aviso }}</span>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import LeituraPagina from './portal/LeituraPagina.vue';
import LibrasPublica from './portal/LibrasPublica.vue';

const desenhos = {
  acesso: ['M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'M4 9l8 2 8-2M12 11v5m0 0-4 6m4-6 4 6'],
  fechar: ['m6 6 12 12M18 6 6 18'], contraste: ['M12 3a9 9 0 1 0 0 18V3Z', 'M12 3a9 9 0 0 1 0 18'],
  linhas: ['M8 5h13M8 12h13M8 19h13M3 4v16m-2-2 2 2 2-2M1 6l2-2 2 2'],
  letras: ['M5 5h14M12 5v10M4 20h16m-3-3 3 3-3 3M7 17l-3 3 3 3'],
  links: ['m10 13 4-4m-6 6-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m4 0 2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0M3 22h18'],
  movimento: ['M3 7h8M3 12h5M3 17h8M15 5v14M20 5v14'],
  foco: ['M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', 'M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0'],
  fonte: ['m4 20 7-16h2l7 16M7 14h10'],
  voz: ['M4 9h4l5-4v14l-5-4H4V9Z', 'M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'],
  restaurar: ['M3 10a9 9 0 1 1 2 8M3 4v6h6'],
};
const Icone = defineComponent({
  props: { nome: String, tamanho: { type: Number, default: 22 } },
  setup: props => () => h('svg', { viewBox: '0 0 24 24', width: props.tamanho, height: props.tamanho, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, (desenhos[props.nome] || []).map(d => h('path', { d }))),
});
const padrao = { escala: 100, contraste: false, linhas: false, letras: false, links: false, movimento: false, foco: false, fonte: false };
const preferencias = reactive({ ...padrao });
const opcoes = [
  { chave: 'contraste', nome: 'Alto contraste', icone: 'contraste' },
  { chave: 'links', nome: 'Destacar links', icone: 'links' },
  { chave: 'linhas', nome: 'Espaçar linhas', icone: 'linhas' },
  { chave: 'letras', nome: 'Espaçar letras', icone: 'letras' },
  { chave: 'movimento', nome: 'Reduzir animações', icone: 'movimento' },
  { chave: 'foco', nome: 'Realçar foco', icone: 'foco' },
  { chave: 'fonte', nome: 'Fonte simples', icone: 'fonte' },
];
const classes = { contraste: 'high-contrast', linhas: 'seduc-a11y-linhas', letras: 'seduc-a11y-letras', links: 'seduc-a11y-links', movimento: 'seduc-a11y-movimento', foco: 'seduc-a11y-foco', fonte: 'seduc-a11y-fonte' };
const aberto = ref(false), botao = ref(null), painel = ref(null), leitura = ref(null), libras = ref(null), aviso = ref(''), route = useRoute();
const totalAtivos = computed(() => opcoes.filter(o => preferencias[o.chave]).length + Number(preferencias.escala !== 100));
let montado = false;
function definirEscala(v) { preferencias.escala = Math.min(200, Math.max(90, Math.round((Number(v) || 100) / 10) * 10)); }
function aplicar() {
  if (!montado) return;
  document.documentElement.style.fontSize = preferencias.escala + '%';
  Object.entries(classes).forEach(([chave, classe]) => document.documentElement.classList.toggle(classe, preferencias[chave]));
  try {
    localStorage.setItem('seduc-acessibilidade-v2', JSON.stringify(preferencias));
    localStorage.setItem('site-font-scale', String(preferencias.escala));
    localStorage.setItem('site-high-contrast', String(preferencias.contraste));
  } catch { /* Continua funcionando mesmo com armazenamento bloqueado. */ }
}
function fechar() { aberto.value = false; botao.value?.focus({ preventScroll: true }); }
async function alternarMenu() { if (aberto.value) return fechar(); aberto.value = true; await nextTick(); painel.value?.focus({ preventScroll: true }); }
function abrirSemFoco() { aberto.value = true; }
function fora(e) { if (aberto.value && !painel.value?.contains(e.target) && !botao.value?.contains(e.target)) aberto.value = false; }
function sairPorTeclado(e) { if (aberto.value && !painel.value?.contains(e.target) && !botao.value?.contains(e.target)) aberto.value = false; }
function restaurar() { Object.assign(preferencias, padrao); leitura.value?.parar(); libras.value?.desativar(); aviso.value = 'Preferências de acessibilidade restauradas.'; }
watch(preferencias, aplicar);
watch(() => route.fullPath, () => { aberto.value = false; aviso.value = ''; });
onMounted(() => {
  try {
    const salvo = JSON.parse(localStorage.getItem('seduc-acessibilidade-v2') || 'null');
    if (salvo && typeof salvo === 'object') {
      definirEscala(salvo.escala);
      opcoes.forEach(o => { preferencias[o.chave] = salvo[o.chave] === true; });
    } else {
      definirEscala(localStorage.getItem('site-font-scale'));
      preferencias.contraste = localStorage.getItem('site-high-contrast') === 'true';
    }
  } catch { /* Valores inválidos não impedem abrir o menu. */ }
  montado = true; aplicar();
  document.addEventListener('pointerdown', fora);
  document.addEventListener('focusin', sairPorTeclado);
});
onBeforeUnmount(() => { document.removeEventListener('pointerdown', fora); document.removeEventListener('focusin', sairPorTeclado); });
</script>

<style scoped>
.acesso-flutuante{--a-fundo:var(--p-surface,#fff);--a-texto:var(--p-ink,#173c40);--a-suave:var(--p-soft,#e7f3ef);--a-borda:var(--p-border,#d5e3e2);--a-cor:var(--p-teal,#007a72);--a-sec:var(--p-muted,#536b70);position:fixed;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));z-index:210;font-family:Arial,sans-serif;color:var(--a-texto);line-height:1.45}
.acesso-flutuante *{box-sizing:border-box}.acesso-flutuante button{font:inherit;cursor:pointer;touch-action:manipulation}.acesso-flutuante button:disabled{cursor:not-allowed;opacity:.45}.acesso-flutuante svg{flex-shrink:0}
.acesso-icone{position:relative;width:56px;height:56px;display:grid;place-items:center;border-radius:50%;background:#005ba5;color:#fff;border:2px solid #fff;box-shadow:0 4px 18px #173c4040;transition:transform .15s,box-shadow .15s}.acesso-icone:hover{transform:translateY(-2px);box-shadow:0 6px 22px #173c4050}
.acesso-contador{position:absolute;top:-3px;right:-3px;min-width:20px;min-height:20px;padding:1px 4px;border:2px solid white;border-radius:20px;background:#007a72;color:#fff;font-size:12px;font-weight:700}
.acesso-painel{position:fixed;inset:auto auto calc(max(16px,env(safe-area-inset-bottom)) + 70px) max(16px,env(safe-area-inset-left));width:min(400px,calc(100vw - 32px));max-height:calc(100vh - 108px);max-height:calc(100dvh - 108px);display:flex;flex-direction:column;border:1px solid var(--a-borda);border-radius:20px;background:var(--a-fundo);box-shadow:0 16px 56px #173c402b,0 2px 8px #173c401a;overflow:hidden;isolation:isolate}
.acesso-cabecalho{display:flex;align-items:center;gap:12px;padding:18px;border-bottom:1px solid var(--a-borda);flex-shrink:0;background:var(--a-suave)}.acesso-marca{display:grid;place-items:center;color:var(--a-cor)}.acesso-cabecalho>div{min-width:0;flex:1}.acesso-cabecalho h2{margin:0;font-size:1.12rem;letter-spacing:-.02em;line-height:1.3;color:var(--a-texto)}.acesso-cabecalho p{margin:4px 0 0;font-size:.8rem;color:var(--a-sec);line-height:1.4}
.acesso-fechar{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border:1px solid var(--a-borda);border-radius:12px;background:var(--a-fundo);color:var(--a-texto)}
.acesso-conteudo{padding:18px;overflow-y:auto;overscroll-behavior:contain;min-height:0;display:grid;gap:18px;scrollbar-width:thin}.acesso-conteudo h3{margin:0;font-size:.88rem;font-weight:700;line-height:1.4;color:var(--a-texto)}.acesso-linha{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.acesso-linha output{font-size:.82rem;font-weight:700;color:var(--a-cor);padding:3px 8px;border-radius:6px;background:var(--a-suave);font-variant-numeric:tabular-nums}
.acesso-fontes{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:8px;margin-top:10px}.acesso-fontes button{min-height:48px;border:1px solid var(--a-borda);border-radius:10px;background:var(--a-fundo);color:var(--a-texto);font-size:1.12rem;font-weight:700;padding:7px}.acesso-fontes .acesso-tamanho-padrao{font-size:.82rem;font-weight:500}
.acesso-grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.acesso-ajuste{display:flex;flex-direction:column;gap:10px;text-align:left;padding:12px;min-height:92px;border:1px solid var(--a-borda);border-radius:12px;color:var(--a-texto);background:var(--a-fundo);font-size:.84rem!important;line-height:1.4!important}.acesso-ajuste-topo{display:flex;justify-content:space-between;align-items:center;width:100%;color:var(--a-cor)}.acesso-check{display:grid;place-items:center;width:20px;height:20px;flex-shrink:0;border-radius:50%;border:1px solid var(--a-borda);font-size:13px;line-height:1;color:var(--a-sec)}.acesso-ajuste[aria-pressed=true]{background:var(--a-suave);border-color:var(--a-cor);box-shadow:inset 0 0 0 1px var(--a-cor)}.acesso-ajuste[aria-pressed=true] .acesso-check{background:#007a72;border-color:#007a72;color:white}
.acesso-recurso{border-top:1px solid var(--a-borda);padding-top:16px}.acesso-recurso h3{display:flex;align-items:center;gap:8px;margin-bottom:12px}.acesso-recurso :deep(button),.acesso-recurso :deep(select){padding:10px 12px;min-height:44px;border:1px solid var(--a-borda);border-radius:10px;background:var(--a-fundo);color:var(--a-texto);font:inherit;font-size:.86rem;line-height:1.4;max-width:100%}.acesso-recurso :deep(button[aria-pressed=true]){background:var(--a-suave);border-color:var(--a-cor)}
.acesso-rodape{display:grid;gap:10px;padding:14px 18px;border-top:1px solid var(--a-borda);background:var(--a-fundo);flex-shrink:0}.acesso-restaurar{display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--a-borda);border-radius:10px;padding:10px;min-height:44px;background:var(--a-suave);color:var(--a-texto);font-size:.83rem!important}.acesso-rodape a{text-align:center;font-size:.78rem;color:var(--p-blue,#005ba5);padding:3px;line-height:1.4;text-underline-offset:3px}.acesso-sr{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.acesso-flutuante :is(button,a):focus-visible{outline:3px solid var(--p-focus,#dc8600);outline-offset:3px}.acesso-flutuante button:not(:disabled):hover{border-color:var(--a-cor)}
:global(html.high-contrast) .acesso-icone{background:#000;border-color:#fff}:global(html.high-contrast) .acesso-contador,:global(html.high-contrast) .acesso-check{background:#000!important;color:#ffeb3b!important;border-color:#fff!important}
@media(max-height:600px){.acesso-cabecalho{padding:10px 14px}.acesso-cabecalho p{display:none}.acesso-rodape{padding:8px 14px;gap:4px}.acesso-rodape a{display:none}}
@media(prefers-reduced-motion:reduce){.acesso-icone{transition:none;transform:none}}
@media print{.acesso-flutuante{display:none}}
</style>

<style>
/* Preferências explícitas: aplicadas ao conteúdo, sem reescrever o DOM do Vue. */
html.seduc-a11y-linhas #app :is(p,li,dd,dt,td,th,label,.p-prose){line-height:1.9!important}
html.seduc-a11y-letras #app :is(p,li,dd,dt,h1,h2,h3,h4,label,a,td,th){letter-spacing:.12em!important;word-spacing:.16em!important}
html.seduc-a11y-links #app a[href]{text-decoration:underline!important;text-decoration-thickness:2px!important;text-underline-offset:.25em!important}
html.seduc-a11y-fonte #app :is(p,li,dd,dt,h1,h2,h3,h4,a,label,input,textarea,select,button,td,th){font-family:Arial,Helvetica,sans-serif!important}
html.seduc-a11y-foco :focus-visible{outline:4px solid var(--p-focus,#dc8600)!important;outline-offset:4px!important;box-shadow:0 0 0 7px var(--p-surface,#fff)!important}
html.seduc-a11y-movimento,html.seduc-a11y-movimento *,html.seduc-a11y-movimento *::before,html.seduc-a11y-movimento *::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}
</style>
