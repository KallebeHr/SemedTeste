<template>
  <header class="portal-header" @keydown.esc="fecharComTeclado">
    <div class="p-container header-inner">
      <router-link
        to="/"
        class="portal-brand"
        aria-label="Secretaria de Educação de Pedro II, início"
        ><img
          src="/IMG/semedBranco.svg"
          alt="Secretaria de Educação de Pedro II"
          width="285"
          height="90"
      /></router-link>
      <form class="header-search" role="search" @submit.prevent="buscar">
        <label for="busca-portal" class="sr-only"
          >Buscar serviços, notícias e publicações</label
        ><input
          id="busca-portal"
          v-model="termo"
          type="search"
          placeholder="O que você procura?"
          list="sugestoes-servicos"
          maxlength="150"
        /><datalist id="sugestoes-servicos">
          <option
            v-for="s in servicos"
            :key="s.id"
            :value="s.titulo"
          /></datalist
        ><button type="submit" aria-label="Pesquisar no portal">
          <i class="mdi mdi-magnify" aria-hidden="true" />
        </button>
      </form>
      <button
        ref="menuBotao"
        class="menu-toggle"
        :aria-expanded="aberto"
        aria-controls="nav-portal-mobile"
        @click="aberto = !aberto"
      >
        <i
          :class="['mdi', aberto ? 'mdi-close' : 'mdi-menu']"
          aria-hidden="true"
        />
        Menu
      </button>
    </div>
    <nav
      v-if="!compacto"
      id="nav-portal"
      :class="['portal-nav', { aberto }]"
      aria-label="Navegação principal"
    >
      <div class="p-container nav-inner">
        <template v-for="n in NAV" :key="n.titulo"
          ><router-link v-if="n.caminho" :to="n.caminho" @click="fechar">{{
            n.titulo
          }}</router-link>
          <details v-else @toggle="fecharOutros">
            <summary>
              {{ n.titulo }}
              <i class="mdi mdi-chevron-down" aria-hidden="true" />
            </summary>
            <div class="nav-submenu">
              <router-link
                v-for="f in n.filhos"
                :key="f[1]"
                :to="f[1]"
                @click="fechar"
                >{{ f[0] }}</router-link
              >
            </div>
          </details></template
        >
      </div>
    </nav>
    <MenuTelaInteira v-if="compacto" :aberto="aberto" titulo="Menu principal" @fechar="fecharComTeclado">
      <nav id="nav-portal-mobile" aria-label="Navegação principal">
        <template v-for="n in NAV" :key="n.titulo">
          <router-link v-if="n.caminho" :to="n.caminho" @click="fechar">{{n.titulo}}</router-link>
          <details v-else class="mobile-grupo"><summary>{{n.titulo}}<i class="mdi mdi-chevron-down" aria-hidden="true" /></summary><div><router-link v-for="f in n.filhos" :key="f[1]" :to="f[1]" @click="fechar">{{f[0]}}</router-link></div></details>
        </template>
      </nav>
    </MenuTelaInteira>
  </header>
</template>
<script setup>
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { NAV } from "../portal/catalogo";
import { usePortal } from "../composables/usePortal";
import {useMediaQuery} from '@vueuse/core';
import MenuTelaInteira from './portal/MenuTelaInteira.vue';
const compacto=useMediaQuery('(max-width: 900px)');
const { servicos } = usePortal(),
  router = useRouter(),
  route = useRoute(),
  termo = ref(""),
  aberto = ref(false),
  menuBotao = ref(null);
function fechar() {
  aberto.value = false;
  document
    .querySelectorAll(".portal-nav details[open]")
    .forEach((d) => (d.open = false));
}
function fecharComTeclado(e) {
  const resumo = e?.target?.closest("details")?.querySelector("summary");
  const eraAberto = aberto.value;
  fechar();
  if (eraAberto) menuBotao.value?.focus();
  else resumo?.focus();
}
function fecharOutros(e) {
  if (e.target.open)
    document.querySelectorAll(".portal-nav details[open]").forEach((d) => {
      if (d !== e.target) d.open = false;
    });
}
function buscar() {
  router.push({
    path: "/busca",
    query: termo.value.trim() ? { q: termo.value.trim() } : {},
  });
  fechar();
}
watch(() => route.fullPath, fechar);
watch(compacto,fechar);
</script>
<style scoped>
.portal-header {
  background: var(--p-blue);
  color: #fff;
  position: relative;
  z-index: 20;
}
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding-block: 1rem;
}
.portal-brand {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.portal-brand img {
  width: 285px;
  height: auto;
  max-height: 96px;
}
.header-search {
  display: flex;
  align-items: center;
  max-width: 470px;
  flex: 1;
  background: var(--p-surface);
  border-radius: 0.7rem;
  padding: 0.25rem;
  color: var(--p-ink);
}
.header-search input {
  width: 100%;
  min-width: 0;
  outline: 0;
  padding: 0.7rem 1rem;
}
.header-search button {
  background: var(--p-teal);
  color: #fff;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 1.3rem;
}
.portal-nav {
  background: var(--p-teal);
}
.nav-inner {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 0.7rem;
}
.nav-inner > a,
.nav-inner summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem 0.5rem;
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.86rem;
  cursor: pointer;
  list-style: none;
}
.nav-inner summary::-webkit-details-marker {
  display: none;
}
.nav-inner details {
  position: relative;
}
.nav-submenu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 220px;
  background: var(--p-surface);
  color: var(--p-ink);
  border: 1px solid var(--p-border);
  box-shadow: 0 8px 30px #0002;
  border-radius: 0 0 0.6rem 0.6rem;
  display: grid;
  padding: 0.5rem;
}
.nav-submenu a {
  padding: 0.65rem 0.85rem;
  text-decoration: none;
  color: inherit;
  white-space: nowrap;
}
.nav-submenu a:hover {
  background: var(--p-soft);
}
.menu-toggle {
  display: none;
}
.mobile-grupo{border-bottom:1px solid var(--p-border)}
.mobile-grupo summary{display:flex;align-items:center;justify-content:space-between;padding:.9rem;font-weight:600;cursor:pointer;list-style:none;gap:1rem;}
.mobile-grupo summary::-webkit-details-marker{display:none}
.mobile-grupo[open] summary .mdi{transform:rotate(180deg)}
.mobile-grupo > div{padding-left:.75rem;border-left:3px solid var(--p-teal);margin:0 .8rem 1rem;}
.portal-access {
  color: var(--p-ink);
}
@media (max-width: 900px) {
  .header-inner {
    gap: 1rem;
    flex-wrap: wrap;
  }
  .portal-brand img {
    width: 220px;
  }
  .header-search {
    max-width: none;
    order: 3;
    flex-basis: 100%;
  }
  .menu-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem;
  }
  .portal-nav {
    display: none;
  }
  .portal-nav.aberto {
    display: block;
  }
  .nav-inner {
    display: grid;
    gap: 0;
    padding-bottom: 1rem;
  }
  .nav-submenu {
    position: static;
    box-shadow: none;
    min-width: 0;
  }
  .nav-inner > a,
  .nav-inner summary {
    font-size: 1rem;
    padding: 0.65rem;
  }
  .nav-submenu a {
    white-space: normal;
  }
}
</style>
