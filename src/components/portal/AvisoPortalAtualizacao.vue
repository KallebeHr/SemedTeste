<template>
  <Teleport to="body">
    <dialog
      ref="dialogo"
      class="aviso-portal no-print"
      aria-labelledby="aviso-portal-titulo"
      aria-describedby="aviso-portal-texto aviso-portal-detalhe"
      @close="aoFechar"
    >
      <section class="aviso-portal-conteudo">
        <button
          ref="botaoFechar"
          type="button"
          class="aviso-portal-fechar"
          aria-label="Fechar aviso de atualização do portal"
          autofocus
          @click="fechar"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        <span class="aviso-portal-icone" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"
            />
            <path d="M14 3v6h6M8 13h8M8 17h5" />
          </svg>
        </span>
        <p class="aviso-portal-selo">COMUNICADO À COMUNIDADE</p>
        <h2 id="aviso-portal-titulo">Nosso portal está em atualização</h2>
        <p id="aviso-portal-texto">
          Estamos alimentando o site com informações, documentos e serviços da
          Secretaria Municipal de Educação de Pedro II.
        </p>
        <p id="aviso-portal-detalhe">
          Algumas seções ainda podem apresentar conteúdos incompletos enquanto
          esse trabalho é realizado. Agradecemos sua compreensão!
        </p>
        <div class="aviso-portal-nota">
          Para consultar os editais e realizar sua inscrição, acesse a seção
          <strong>Editais e concursos</strong>.
        </div>
        <div class="aviso-portal-acoes">
          <button type="button" class="aviso-portal-continuar" @click="fechar">
            Entendi, continuar
          </button>
          <router-link
            to="/editais"
            class="aviso-portal-editais"
            @click="fechar"
            >Consultar editais <span aria-hidden="true">→</span></router-link
          >
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePortal } from "../../composables/usePortal";

const route = useRoute(),
  router = useRouter();
const { conteudos } = usePortal();
const dialogo = ref(null),
  botaoFechar = ref(null);
let montado = false,
  encerrado = false,
  caminhoAtual = null,
  avisadoNestaVisita = false,
  geracao = 0;
const permitido = computed(() => {
  // A rota precisa estar resolvida para evitar um aviso na abertura direta de um edital.
  if (
    !route.matched.length ||
    route.meta.requerAuth ||
    route.meta.login ||
    route.matched.some((r) => r.meta.requerAuth || r.meta.login)
  )
    return false;
  if (
    /^\/(administracao|login|login-alimentacao|editais|inscricao)(\/|$)/.test(
      route.path,
    )
  )
    return false;
  if (/^\/publicacao\/[^/]+\/?$/.test(route.path)) {
    const publicacao = conteudos.value.find((c) => c.id === route.params.id);
    // Aguarda os dados já carregados pelo portal; nunca mostra o aviso antes de saber o tipo.
    return !!publicacao && publicacao.tipo !== "edital";
  }
  return true;
});

function fechar() {
  if (dialogo.value?.open) dialogo.value.close();
}
function aoFechar() {
  if (!encerrado && !dialogo.value?.open)
    document
      .getElementById("conteudo-principal")
      ?.focus({ preventScroll: true });
}
async function sincronizar() {
  if (!montado || encerrado) return;
  const atual = ++geracao;
  if (caminhoAtual !== route.path) {
    caminhoAtual = route.path;
    avisadoNestaVisita = false;
    fechar();
  }
  if (!permitido.value) {
    fechar();
    return;
  }
  if (avisadoNestaVisita) return;
  await nextTick();
  if (encerrado || atual !== geracao || !permitido.value || !dialogo.value)
    return;
  avisadoNestaVisita = true;
  if (!dialogo.value.open) dialogo.value.showModal();
  botaoFechar.value?.focus({ preventScroll: true });
}
// Uma exibição a cada entrada em uma seção. Alterar filtros ou rolar a página não reabre o aviso.
watch([() => route.path, permitido], sincronizar, { flush: "post" });
onMounted(async () => {
  await router.isReady();
  if (encerrado) return;
  montado = true;
  await sincronizar();
});
onBeforeUnmount(() => {
  encerrado = true;
  geracao++;
  fechar();
});
</script>

<style scoped>
.aviso-portal {
  width: min(490px, calc(100% - 2rem));
  max-width: calc(100% - 2rem);
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 1rem;
  color: var(--p-ink, #173c40);
  background: var(--p-surface, #fff);
  box-shadow: 0 1.5rem 5rem #10343833;
  font: inherit;
}
.aviso-portal::backdrop {
  background: #102f36a6;
}
.aviso-portal-conteudo {
  position: relative;
  display: grid;
  gap: 0.9rem;
  padding: 1.6rem;
}
.aviso-portal p,
.aviso-portal h2 {
  margin: 0;
}
.aviso-portal-icone {
  display: grid;
  place-items: center;
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 0.8rem;
  background: var(--p-soft, #e7f3ef);
  color: var(--p-teal, #007a72);
}
.aviso-portal .aviso-portal-selo {
  font-size: 0.7rem;
  line-height: 1.5;
  font-weight: 700;
  letter-spacing: 0.07em;
  color: var(--p-teal, #007a72);
}
.aviso-portal h2 {
  max-width: 22ch;
  font-size: clamp(1.25rem, 4.5vw, 1.65rem);
  line-height: 1.2;
  letter-spacing: -0.025em;
  color: var(--p-ink, #173c40);
}
.aviso-portal p:not(.aviso-portal-selo) {
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--p-muted, #536b70);
}
.aviso-portal-fechar {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.6rem;
  color: var(--p-ink, #173c40);
  background: var(--p-surface, #fff);
  cursor: pointer;
}
.aviso-portal-fechar:hover {
  background: var(--p-soft, #e7f3ef);
}
.aviso-portal-nota {
  padding: 0.8rem;
  border-radius: 0.6rem;
  background: var(--p-soft, #e7f3ef);
  color: var(--p-ink, #173c40);
  font-size: 0.82rem;
  line-height: 1.6;
}
.aviso-portal-acoes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding-top: 0.25rem;
}
.aviso-portal-continuar,
.aviso-portal-editais {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--p-teal, #007a72);
  border-radius: 0.55rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
  cursor: pointer;
}
.aviso-portal-continuar {
  flex: 1 1 10rem;
  color: var(--p-surface, #fff);
  background: var(--p-teal, #007a72);
}
.aviso-portal-editais {
  flex: 1 1 10rem;
  border-color: var(--p-border, #d5e3e2);
  color: var(--p-ink, #173c40);
  background: var(--p-surface, #fff);
  text-decoration: none;
}
.aviso-portal-editais:hover {
  background: var(--p-soft, #e7f3ef);
}
@media (max-width: 400px) {
  .aviso-portal-conteudo {
    padding: 1.2rem;
    gap: 0.8rem;
  }
  .aviso-portal-acoes {
    flex-direction: column;
    align-items: stretch;
  }
  .aviso-portal-continuar,
  .aviso-portal-editais {
    flex: auto;
  }
}
@media print {
  .aviso-portal {
    display: none;
  }
}
</style>
<style>
html:has(dialog.aviso-portal[open]) {
  overflow: hidden;
}
</style>
