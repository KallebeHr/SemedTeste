<template>
  <section>
    <header class="p-section-head">
      <div>
        <h1>Escolas da rede</h1>
        <p>O cadastro interno é separado da ficha pública da escola.</p>
      </div>
      <button class="p-button primary" @click="editar()">
        + Cadastrar escola
      </button>
    </header>
    <EstadoConsulta :consulta="consulta" />
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <form v-if="aberto" class="p-card p-stack" @submit.prevent="salvar">
      <h2>{{ form.id ? "Editar escola" : "Nova escola" }}</h2>
      <fieldset :disabled="ocupado" class="p-stack">
        <label class="p-field"
          >Nome da escola<input
            aria-label="Nome da escola"
            v-model="form.nome"
            required
            maxlength="160"
        /></label>
        <div class="p-grid two">
          <label class="p-field"
            >Endereço público<input
              aria-label="Endereço público"
              v-model="form.endereco"
              maxlength="300" /></label
          ><label class="p-field"
            >Contato público<input
              aria-label="Contato público"
              v-model="form.contato"
              maxlength="200" /></label
          ><label class="p-field"
            >Etapas de ensino<input
              aria-label="Etapas de ensino"
              v-model="form.etapas"
              maxlength="300"
              placeholder="Ex.: Educação infantil e ensino fundamental" /></label
          ><label class="p-field"
            >Horário de atendimento<input
              aria-label="Horário de atendimento"
              v-model="form.horario"
              maxlength="200"
          /></label>
        </div>
        <label class="p-field"
          >Apresentação pública<textarea
            aria-label="Apresentação pública"
            v-model="form.sobre"
            maxlength="3000"
          /></label
        ><label class="p-check"
          ><input v-model="form.ativo" type="checkbox" /> Escola ativa no
          sistema</label
        ><label class="p-check"
          ><input v-model="publicar" type="checkbox" :disabled="!form.ativo" />
          Exibir a ficha no portal público</label
        >
        <p class="p-small">
          Confirme que o contato e o texto podem ser divulgados. Desmarcar a
          publicação também retira os resumos públicos das vistorias da
          consulta.
        </p>
        <div class="p-actions">
          <button class="p-button primary">
            {{ ocupado ? "Salvando…" : "Salvar escola" }}</button
          ><button type="button" class="p-button" @click="aberto = false">
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
    <div class="p-stack">
      <article v-for="e in ordenadas" :key="e.id" class="p-card">
        <div class="p-section-head">
          <div>
            <h2>{{ e.nome }}</h2>
            <span class="p-badge"
              >{{ e.ativo ? "Ativa" : "Inativa" }} ·
              {{ publicadas.has(e.id) ? "Publicada" : "Uso interno" }}</span
            >
            <p class="p-small p-muted">Identificador: {{ e.id }}</p>
          </div>
          <button class="p-button" @click="editar(e)">Editar e publicar</button>
        </div>
      </article>
      <p v-if="!ordenadas.length && !consulta.carregando.value" class="p-empty">
        Nenhuma escola cadastrada.
      </p>
    </div>
  </section>
</template>
<script setup>
import { transacaoConfirmada } from "../../portal/transacao";
import { ref, reactive, computed } from "vue";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { usePortal } from "../../composables/usePortal";
import { useAuth } from "../../composables/useAuth";
import { mensagemErro } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const consulta = useColecao(() => collection(db, "escolas")),
  { escolas } = usePortal(),
  publicadas = computed(() => new Set(escolas.dados.value.map((e) => e.id))),
  ordenadas = computed(() =>
    [...consulta.dados.value].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    ),
  ),
  aberto = ref(false),
  ocupado = ref(false),
  publicar = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  form = reactive({});
function editar(e = {}) {
  const p = escolas.dados.value.find((p) => p.id === e.id) || {};
  Object.keys(form).forEach((k) => delete form[k]);
  Object.assign(form, {
    id: e.id || "",
    nome: e.nome || "",
    ativo: e.ativo !== false,
    versao: e.versao || 0,
    endereco: p.endereco || "",
    contato: p.contato || "",
    etapas: p.etapas || "",
    horario: p.horario || "",
    sobre: p.sobre || "",
  });
  publicar.value = publicadas.value.has(e.id);
  aberto.value = true;
  erro.value = "";
  window.scrollTo({ top: 0 });
}
async function salvar() {
  if (ocupado.value) return;
  ocupado.value = true;
  erro.value = "";
  try {
    useAuth().exigirUsuario();
    const r = form.id
      ? doc(db, "escolas", form.id)
      : doc(collection(db, "escolas"));
    form.id = r.id;
    await transacaoConfirmada(async (t) => {
      const s = await t.get(r);
      if (s.exists() && (s.data().versao || 0) !== form.versao)
        throw new Error(
          "A escola foi alterada por outra pessoa. Reabra o cadastro.",
        );
      t.set(r, {
        ...(s.data() || {}),
        nome: form.nome.trim(),
        ativo: form.ativo,
        versao: form.versao + 1,
        atualizadoEm: serverTimestamp(),
        ...(s.exists() ? {} : { criadoEm: serverTimestamp() }),
      });
      const p = doc(db, "escolasPublicas", r.id);
      if (publicar.value && form.ativo)
        t.set(p, {
          nome: form.nome.trim(),
          endereco: form.endereco.trim(),
          contato: form.contato.trim(),
          etapas: form.etapas.trim(),
          horario: form.horario.trim(),
          sobre: form.sobre.trim(),
          publicadoEm: serverTimestamp(),
        });
      else t.delete(p);
    });
    aberto.value = false;
    mensagem.value =
      "Escola salva. Os dados existentes de estoque e vistorias foram preservados.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
fieldset {
  border: 0;
}
form {
  margin-block: 1.5rem;
}
</style>
