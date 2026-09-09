<template>
  <section>
    <router-link to="/administracao/alunos">← Voltar aos alunos</router-link>
    <h1>Boletim do aluno</h1>
    <BoletimAluno
      :aluno-id="String(route.params.id)"
      :editar="pode('usuarios')"
    />
  </section>
</template>
<script setup>
import { useRoute } from "vue-router";
import { useAuth } from "../../composables/useAuth";
import BoletimAluno from "../../components/portal/BoletimAluno.vue";
const route = useRoute(),
  { pode } = useAuth();
</script>
