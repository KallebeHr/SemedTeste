<template>
  <main class="p-container p-page p-stack">
    <header>
      <p class="p-eyebrow">SEMED · Pedro II</p>
      <h1>Calendário Escolar</h1>
      <p>Consulte o ano completo, filtre as categorias e selecione uma data.</p>
    </header>
    <label class="p-field"
      >Ano<select v-model.number="ano" :disabled="ocupado" @change="carregar">
        <option v-for="a in anos" :key="a" :value="a">{{ a }}</option>
      </select></label
    >
    <p v-if="erro" class="p-alert" role="status">{{ erro }}</p>
    <p v-if="ocupado" role="status">Consultando calendário publicado…</p>
    <GradeCalendario v-if="dados" :key="ano" :calendario="dados" />
    <details>
      <summary>Outros eventos e publicações do portal</summary>
      <AgendaAnterior />
    </details>
  </main>
</template>
<script setup>
import { ref, onMounted } from "vue";
import GradeCalendario from "../../components/calendario/GradeCalendario.vue";
import AgendaAnterior from "../../components/OneCalendario.vue";
import original from "../../data/calendario2026.json";
import { validarCalendario } from "../../../shared/calendario.mjs";
import { anosPublicados, lerCalendario } from "../../services/calendarios";
const ano = ref(2026),
  anos = ref([2026]),
  dados = ref(validarCalendario(original)),
  erro = ref(""),
  ocupado = ref(false);
async function carregar() {
  ocupado.value = true;
  erro.value = "";
  dados.value = ano.value === 2026 ? validarCalendario(original) : null;
  try {
    const r = await lerCalendario(ano.value);
    if (r) dados.value = r.dados;
    else if (ano.value !== 2026)
      erro.value = "Este calendário ainda não foi publicado.";
  } catch {
    erro.value =
      ano.value === 2026
        ? "Exibindo a versão 2026 importada do documento oficial. Não foi possível consultar revisões online."
        : "Não foi possível consultar o calendário. Tente novamente.";
  } finally {
    ocupado.value = false;
  }
}
onMounted(async () => {
  await carregar();
  try {
    anos.value = [...new Set([2026, ...(await anosPublicados())])].sort(
      (a, b) => b - a,
    );
  } catch {
    /* A versão oficial incluída permanece consultável. */
  }
});
</script>
