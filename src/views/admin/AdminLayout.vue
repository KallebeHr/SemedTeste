<template>
  <div v-if="usuario" class="admin-layout">
    <aside class="admin-sidebar" @keydown.esc="fecharMenu">
      <router-link class="admin-brand" to="/administracao"
        ><span class="p-eyebrow">SEDUC · PEDRO II</span
        ><strong>Administração</strong></router-link
      >
      <p class="admin-name">
        {{ usuario.nome }}<br /><span>{{
          CARGOS[cargoAtual(usuario.papel)]
        }}</span>
      </p>
      <button v-if="compacto" ref="botaoMenu" class="p-button" :aria-expanded="menuAberto" aria-controls="menu-admin-mobile" @click="menuAberto=!menuAberto"><i class="mdi mdi-menu" aria-hidden="true" /> Menu da administração</button>
      <nav v-if="!compacto" id="menu-admin" aria-label="Administração">
        <router-link to="/administracao">Visão geral</router-link
        ><router-link v-for="n in menu" :key="n.path" :to="n.path">{{
          n.nome
        }}</router-link>
      </nav>
      <div v-if="!compacto" class="admin-bottom">
        <router-link to="/">Abrir portal público ↗</router-link
        ><button class="p-button" @click="sair">Sair da conta</button>
      </div>
    </aside>
    <MenuTelaInteira v-if="compacto" :aberto="menuAberto" titulo="Administração" @fechar="fecharMenu"><nav id="menu-admin-mobile" aria-label="Administração"><router-link to="/administracao" @click="fecharMenu">Visão geral</router-link><router-link v-for="n in menu" :key="n.path" :to="n.path" @click="fecharMenu">{{n.nome}}</router-link><router-link to="/administracao/notificacoes" @click="fecharMenu">Notificações ({{caixa.naoLidas.value.length}})</router-link><router-link to="/" @click="fecharMenu">Abrir portal público</router-link><button class="p-button" @click="sair">Sair da conta</button></nav></MenuTelaInteira>
    <div class="admin-content">
      <div class="p-actions admin-top-actions"><router-link to="/administracao/notificacoes" class="p-button" :aria-label="'Notificações: '+caixa.naoLidas.value.length+' não lidas'">Notificações <span class="p-badge" aria-hidden="true">{{caixa.naoLidas.value.length}}</span></router-link></div>
      <p
        v-if="manutencao.dados.value[0]?.bloqueado"
        class="p-alert"
        role="status"
      >
        Manutenção em andamento. Os dados continuam disponíveis para consulta;
        aguarde a liberação antes de salvar alterações.
      </p>
      <router-view
        :key="
          route.path + usuario.papel + JSON.stringify(usuario.escolasVinculadas)
        "
      />
    </div>
  </div>
  <div v-else class="p-container p-page">
    <p role="status">Verificando acesso…</p>
  </div>
</template>
<script setup>
import { computed, watch, ref } from "vue";
import { useMediaQuery } from '@vueuse/core';
import MenuTelaInteira from '../../components/portal/MenuTelaInteira.vue';
import { confirmarAlteracoes } from '../../composables/useSaidaSegura';
import { fornecerCaixaEntrada } from '../../composables/useCaixaEntrada';
import { doc } from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { useRouter, useRoute } from "vue-router";
import { useAuth } from "../../composables/useAuth";
import { CARGOS, cargoAtual } from "../../portal/permissoes";
const auth = useAuth(),
  { usuario, pode } = auth,
  router = useRouter(),
  route = useRoute();
const caixa = fornecerCaixaEntrada();
const compacto=useMediaQuery('(max-width: 1000px)'),menuAberto=ref(false),botaoMenu=ref(null);
function fecharMenu(){menuAberto.value=false;botaoMenu.value?.focus();}
watch(()=>route.path,()=>{menuAberto.value=false;});
watch(compacto,()=>{menuAberto.value=false;});
const manutencao = useColecao(
  () => (usuario.value ? doc(db, "operacao", "estado") : null),
  () => usuario.value?.uid,
);
const links = [
  ['parametros','Parâmetros do sistema','parametros'],
  ['merenda', 'Indicadores e relatórios', 'relatorios'],
  ["conteudo", "Conteúdos e serviços", "conteudos"],
  ["configuracao", "Página inicial e contatos", "configuracao"],
  ["escolas", "Escolas e publicação", "escolas"],
  ["merenda", "Alimentação escolar", "merenda"],
  ["nutricao", "Cardápios mensais", "cardapios"],
  ["nutricao", "Publicar vistorias", "vistorias"],
  ["atendimentos", "Solicitações", "solicitacoes"],
  ["alunos", "Alunos e vínculos", "alunos"],
  ["notas", "Notas e frequência", "notas"],
  ["usuarios", "Usuários e cargos", "usuarios"],
  ["auditoria", "Auditoria do sistema", "auditoria"],
  ["recuperacao", "Recuperação e ambiente", "recuperacao"],
];
const menu = computed(() =>
  links
    .filter((n) => pode(n[0]) && !(n[2] === "cardapios" && pode("conteudo")))
    .map((n) => ({ nome: n[1], path: "/administracao/" + n[2] })),
);
async function sair() {
  if(!confirmarAlteracoes())return;
  await auth.sair();
  await router.replace("/login");
}
watch(
  () => [
    usuario.value?.papel,
    usuario.value?.ativo,
    usuario.value?.uid,
    JSON.stringify(usuario.value?.escolasVinculadas),
  ],
  () => {
    if (!usuario.value) router.replace("/login");
    else if (route.meta.permissao && !pode(route.meta.permissao))
      router.replace("/administracao");
  },
);
</script>
<style scoped>
.admin-layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  min-height: 100vh;
}
.admin-sidebar {
  background: var(--p-surface);
  padding: 2rem 1.2rem;
  border-right: 1px solid var(--p-border);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.admin-brand {
  text-decoration: none;
  display: grid;
  gap: 0.4rem;
  color: var(--p-ink);
}
.admin-brand strong {
  font-size: 1.35rem;
}
.admin-name {
  font-size: 0.9rem;
}
.admin-name span {
  color: var(--p-teal);
  font-size: 0.8rem;
}
.admin-sidebar nav {
  display: grid;
  gap: 0.2rem;
}
.admin-sidebar nav a {
  padding: 0.65rem 0.8rem;
  text-decoration: none;
  border-radius: 0.5rem;
  color: var(--p-muted);
  font-size: 0.87rem;
  font-weight: 600;
}
.admin-sidebar nav .router-link-exact-active {
  background: var(--p-soft);
  color: var(--p-teal);
}
.admin-bottom {
  margin-top: auto;
  display: grid;
  gap: 0.8rem;
  font-size: 0.85rem;
}
.admin-content {
  padding: 2.5rem;
  min-width: 0;
}
.admin-content :deep(h1) {
  font-size: 2rem;
}
@media (max-width: 1000px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }
  .admin-sidebar {
    padding: 1rem;
    border-right: 0;
    border-bottom: 1px solid var(--p-border);
    gap: 0.8rem;
  }
  .admin-sidebar nav {
    display: flex;
    flex-wrap: wrap;
  }
  .admin-brand,
  .admin-name {
    display: inline-block;
  }
  .admin-bottom {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .admin-content {
    padding: 1.5rem 1rem;
  }
}
</style>
