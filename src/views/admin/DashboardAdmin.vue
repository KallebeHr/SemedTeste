<template>
  <section>
    <header class="p-page-head">
      <p class="p-eyebrow">PAINEL DA SECRETARIA</p>
      <h1>Olá, {{ usuario.nome.split(" ")[0] }}.</h1>
      <p>
        {{ CARGOS[cargoAtual(usuario.papel)] }} ·
        {{
          todasEscolas(usuario)
            ? "Acesso conforme as atribuições do cargo em toda a rede."
            : "Acesso limitado às escolas e turmas vinculadas ao seu perfil."
        }}
      </p>
    </header>
    <div class="p-grid">
      <router-link
        v-if="pode('conteudo')"
        to="/administracao/conteudos"
        class="p-card p-card-link"
        ><span class="p-icon"
          ><i class="mdi mdi-file-document-edit-outline" aria-hidden="true"
        /></span>
        <h2>Publicar conteúdo</h2>
        <p>
          Notícias, serviços, calendário, editais, biblioteca e documentos.
        </p></router-link
      ><router-link
        v-if="pode('merenda')"
        to="/administracao/merenda"
        class="p-card p-card-link"
        ><span class="p-icon"
          ><i class="mdi mdi-food-apple-outline" aria-hidden="true"
        /></span>
        <h2>Alimentação escolar</h2>
        <p>
          Estoque, movimentos, vistorias e histórico das escolas autorizadas.
        </p></router-link
      ><router-link
        v-if="pode('atendimentos')"
        to="/administracao/solicitacoes"
        class="p-card p-card-link"
        ><span class="p-icon"
          ><i class="mdi mdi-inbox-outline" aria-hidden="true"
        /></span>
        <h2>Responder solicitações</h2>
        <p>
          Matrículas, transporte, manifestações e acesso à informação.
        </p></router-link
      ><router-link
        v-if="pode('notas')"
        to="/administracao/notas"
        class="p-card p-card-link"
        ><span class="p-icon"
          ><i class="mdi mdi-notebook-outline" aria-hidden="true"
        /></span>
        <h2>Notas e frequência</h2>
        <p>Registros dos alunos vinculados ao seu acesso.</p></router-link
      ><router-link
        v-if="pode('alunos')"
        to="/administracao/alunos"
        class="p-card p-card-link"
        ><span class="p-icon"
          ><i class="mdi mdi-account-school-outline" aria-hidden="true"
        /></span>
        <h2>Alunos e responsáveis</h2>
        <p>
          Organize turmas, professores e vínculos das famílias.
        </p></router-link
      ><router-link
        v-if="pode('usuarios')"
        to="/administracao/usuarios"
        class="p-card p-card-link"
        ><span class="p-icon"
          ><i class="mdi mdi-account-key-outline" aria-hidden="true"
        /></span>
        <h2>Usuários e permissões</h2>
        <p>
          Crie contas, defina cargos e ative ou suspenda acessos.
        </p></router-link
      >
    </div>
    <section class="p-card p-section">
      <h2>Portal público</h2>
      <p>
        {{ escolas.dados.value.length }} escola(s) publicada(s) ·
        {{ conteudos.length }} publicação(ões) disponíveis
      </p>
      <p class="p-small p-muted">
        Os números acima se referem ao conteúdo publicado neste portal.
      </p>
      <div class="p-actions">
        <router-link to="/" class="p-button">Ver página inicial</router-link
        ><router-link to="/merenda-escolar" class="p-button"
          >Ver Merenda pública</router-link
        >
      </div>
    </section>
    <ResumoRede v-if="pode('merenda')" />
    <NotificacoesAdmin v-if="pode('nutricao')" />
  </section>
</template>
<script setup>
import NotificacoesAdmin from "../../components/portal/NotificacoesAdmin.vue";
import ResumoRede from '../../components/dashboard/ResumoRede.vue';
import { useAuth } from "../../composables/useAuth";
import { usePortal } from "../../composables/usePortal";
import { CARGOS, cargoAtual, todasEscolas } from "../../portal/permissoes";
const { usuario, pode } = useAuth(),
  { escolas, conteudos } = usePortal();
</script>
