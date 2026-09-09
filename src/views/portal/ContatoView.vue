<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">ESTAMOS AQUI PARA AJUDAR</p>
      <h1>Fale conosco</h1>
      <p>
        Envie dúvidas, manifestações e solicitações e acompanhe as respostas na
        sua conta.
      </p>
    </header>
    <div class="p-grid two">
      <section class="p-card">
        <h2>Atendimento digital</h2>
        <p>Abra um protocolo e consulte o andamento sempre que precisar.</p>
        <div class="p-actions">
          <router-link to="/atendimento" class="p-button primary"
            >Enviar ou acompanhar solicitação</router-link
          >
        </div>
      </section>
      <section class="p-card">
        <h2>Canais da Secretaria</h2>
        <EstadoConsulta :consulta="config" />
        <p v-if="configuracao.endereco">{{ configuracao.endereco }}</p>
        <p v-if="configuracao.telefone">
          Telefone: {{ configuracao.telefone }}
        </p>
        <p v-if="configuracao.email">E-mail: {{ configuracao.email }}</p>
        <p v-if="configuracao.horario">{{ configuracao.horario }}</p>
        <p
          v-if="
            !configuracao.endereco &&
            !configuracao.email &&
            !configuracao.telefone
          "
        >
          Os contatos presenciais e telefônicos ainda não foram publicados.
        </p>
      </section>
    </div>
  </div>
</template>
<script setup>
import { usePortal } from "../../composables/usePortal";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { configuracao, config } = usePortal();
</script>
