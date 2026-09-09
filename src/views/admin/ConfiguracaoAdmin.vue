<template>
  <section>
    <header class="p-page-head">
      <h1>Página inicial e contatos</h1>
      <p>
        Estas informações serão públicas. Os serviços e notícias são editados em
        Conteúdos.
      </p>
    </header>
    <EstadoConsulta :consulta="consulta" />
    <p v-if="mensagem" class="p-alert success" role="status">{{ mensagem }}</p>
    <p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
    <form class="p-card p-stack" @submit.prevent="salvar">
      <fieldset
        :disabled="salvando || consulta.carregando.value"
        class="p-stack"
      >
        <label class="p-field"
          >Título da página inicial<input
            aria-label="Título da página inicial"
            v-model="form.heroTitulo"
            maxlength="200"
            required /></label
        ><label class="p-field"
          >Texto de apresentação<textarea
            aria-label="Texto de apresentação"
            v-model="form.heroTexto"
            maxlength="800"
            required
          />
        </label>
        <div class="p-grid two">
          <label class="p-field"
            >E-mail público<input
              aria-label="E-mail público"
              v-model="form.email"
              type="email"
              maxlength="200" /></label
          ><label class="p-field"
            >Telefone público<input
              aria-label="Telefone público"
              v-model="form.telefone"
              maxlength="100" /></label
          ><label class="p-field"
            >Endereço de atendimento<input
              aria-label="Endereço de atendimento"
              v-model="form.endereco"
              maxlength="300" /></label
          ><label class="p-field"
            >Horário de atendimento<input
              aria-label="Horário de atendimento"
              v-model="form.horario"
              maxlength="200"
          /></label>
        </div>
        <button class="p-button primary">
          {{ salvando ? "Publicando…" : "Salvar e publicar informações" }}
        </button>
      </fieldset>
    </form>
  </section>
</template>
<script setup>
import { transacaoConfirmada } from "../../portal/transacao";
import { reactive, ref, watch } from "vue";
import { doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { useAuth } from "../../composables/useAuth";
import { mensagemErro } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const consulta = useColecao(() => doc(db, "portalPublico", "configuracao")),
  form = reactive({
    heroTitulo: "Informação e serviços para toda a nossa comunidade.",
    heroTexto:
      "Acompanhe a educação de Pedro II. Encontre serviços, conheça nossas escolas e participe da vida da rede municipal.",
    email: "",
    telefone: "",
    endereco: "",
    horario: "",
  }),
  versao = ref(0),
  salvando = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  carregado = ref(false);
watch(consulta.dados, (d) => {
  if (!carregado.value && d.length) {
    for (const k in form) form[k] = d[0][k] || "";
    versao.value = d[0].versao || 0;
    carregado.value = true;
  }
});
async function salvar() {
  salvando.value = true;
  erro.value = "";
  try {
    useAuth().exigirUsuario();
    const r = doc(db, "portalPublico", "configuracao");
    await transacaoConfirmada(async (t) => {
      const s = await t.get(r);
      if ((s.data()?.versao || 0) !== versao.value)
        throw new Error(
          "As informações foram alteradas por outra pessoa. Recarregue a página antes de editar.",
        );
      t.set(r, {
        ...form,
        versao: versao.value + 1,
        publicadoEm: serverTimestamp(),
      });
    });
    versao.value++;
    mensagem.value = "Informações publicadas.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>
<style scoped>
fieldset {
  border: 0;
}
</style>
