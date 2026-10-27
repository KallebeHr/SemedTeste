<template>
  <section
    class="p-card p-stack comunicado"
    aria-labelledby="titulo-controle-comunicado"
  >
    <h2 id="titulo-controle-comunicado">Comunicado de atualização</h2>
    <EstadoConsulta :consulta="consulta" />
    <p>
      Controle a mensagem “Nosso portal está em atualização” exibida aos
      visitantes. A alteração vale para todo o site e mantém a exceção das
      páginas de editais e inscrições.
    </p>
    <p class="p-small">
      Situação publicada:
      <strong>{{ publicado ? "Ativado" : "Desativado" }}</strong>
    </p>
    <form @submit.prevent="salvar" class="p-stack">
      <label class="p-check"
        ><input
          v-model="ativo"
          type="checkbox"
          :disabled="
            ocupado || consulta.carregando.value || !!consulta.erro.value
          "
        />Exibir comunicado de atualização</label
      >
      <button
        class="p-button primary"
        :disabled="
          ocupado ||
          consulta.carregando.value ||
          !!consulta.erro.value ||
          ativo === publicado
        "
      >
        {{ ocupado ? "Salvando…" : "Salvar comunicado" }}
      </button>
    </form>
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
  </section>
</template>
<script setup>
import { ref, computed, watch } from "vue";
import { doc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import EstadoConsulta from "../portal/EstadoConsulta.vue";
const consulta = useColecao(() =>
  doc(db, "publicacoes", "config-aviso-portal"),
);
const registro = computed(() => consulta.dados.value[0] || {}),
  publicado = computed(() => registro.value.avisoAtualizacaoAtivo === true);
const ativo = ref(false),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref("");
watch(
  () => registro.value.versao,
  () => {
    if (!ocupado.value) ativo.value = publicado.value;
  },
  { immediate: true },
);
async function salvar() {
  if (ocupado.value) return;
  ocupado.value = true;
  erro.value = "";
  mensagem.value = "";
  try {
    if (!auth.currentUser) throw Error("Entre novamente para continuar.");
    const r = await fetch("/api/aviso-portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (await auth.currentUser.getIdToken()),
      },
      body: JSON.stringify({
        ativo: ativo.value,
        versao: registro.value.versao || 0,
      }),
      signal: AbortSignal.timeout(35000),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.erro || "Não foi possível salvar o comunicado.");
    mensagem.value = d.ativo
      ? "Comunicado ativado no site."
      : "Comunicado desativado no site.";
  } catch (e) {
    erro.value =
      e.name === "TimeoutError"
        ? "O servidor não confirmou. Confira a situação publicada antes de repetir."
        : e.message;
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
.comunicado {
  margin-bottom: 1.5rem;
  min-width: 0;
}
.comunicado h2 {
  font-size: 1.3rem;
}
.comunicado .p-button {
  min-height: 44px;
  width: fit-content;
  max-width: 100%;
}
</style>
