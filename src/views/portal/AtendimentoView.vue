<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">ATENDIMENTO À COMUNIDADE</p>
      <h1>Solicitar e acompanhar</h1>
      <p>
        Envie sua solicitação à Secretaria. O protocolo e a resposta ficam
        disponíveis nesta conta.
      </p>
    </header>
    <ContaForm /><template v-if="conta?.emailVerified"
      ><p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
      <p v-if="sucesso" class="p-alert success" role="status">{{ sucesso }}</p>
      <section class="p-card p-section">
        <h2>Nova solicitação</h2>
        <form class="p-stack" @submit.prevent="enviar">
          <p v-if="pendente" class="p-alert" role="status">
            A confirmação deste envio está pendente. Os dados estão preservados.
            Use “Verificar envio” para conferir o mesmo protocolo sem criar
            outro.
          </p>
          <fieldset class="p-stack" :disabled="ocupado || pendente">
            <div class="p-grid two">
              <label class="p-field"
                >Serviço<select aria-label="Serviço" v-model="form.tipo">
                  <option
                    v-for="(r, k) in TIPOS_ATENDIMENTO"
                    :key="k"
                    :value="k"
                  >
                    {{ r }}
                  </option>
                </select></label
              ><label class="p-field"
                >Seu nome completo<input
                  aria-label="Seu nome completo"
                  v-model="form.nome"
                  required
                  maxlength="160"
                  autocomplete="name" /></label
              ><label v-if="escolar" class="p-field"
                >Escola<select
                  aria-label="Escola"
                  v-model="form.escolaId"
                  required
                >
                  <option value="">Selecione uma escola</option>
                  <option
                    v-for="e in escolas.dados.value"
                    :key="e.id"
                    :value="e.id"
                  >
                    {{ e.nome }}
                  </option>
                </select></label
              ><label v-if="escolar" class="p-field"
                >Nome do aluno<input
                  aria-label="Nome do aluno"
                  v-model="form.alunoNome"
                  required
                  maxlength="160" /></label
              ><label v-if="escolar" class="p-field"
                >Etapa / série pretendida<input
                  aria-label="Etapa / série pretendida"
                  v-model="form.serie"
                  required
                  maxlength="100"
              /></label>
            </div>
            <label class="p-field"
              >Assunto<input
                aria-label="Assunto"
                v-model="form.assunto"
                required
                maxlength="200" /></label
            ><label class="p-field"
              >Solicitação<textarea
                aria-label="Solicitação"
                v-model="form.mensagem"
                required
                maxlength="5000"
              /><small
                >Não inclua CPF, dados de saúde ou documentos. Se necessário, a
                equipe indicará um canal adequado.</small
              ></label
            ><label class="p-check"
              ><input v-model="ciente" required type="checkbox" /> Confirmo os
              dados e entendo que o envio não garante vaga ou concessão do
              serviço.</label
            >
          </fieldset>
          <button class="p-button primary" :disabled="ocupado">
            {{
              ocupado
                ? "Enviando…"
                : pendente
                  ? "Verificar envio"
                  : "Enviar solicitação"
            }}
          </button>
        </form>
      </section>
      <section>
        <h2>Minhas solicitações</h2>
        <EstadoConsulta :consulta="solicitacoes" />
        <div class="p-stack">
          <article v-for="s in ordenadas" :key="s.id" class="p-card">
            <span class="p-badge">{{ STATUS_ATENDIMENTO[s.status] }}</span>
            <h3>{{ s.assunto }}</h3>
            <p class="p-small">
              {{ dataTexto(s.criadoEm) }} · Protocolo {{ s.id }}
            </p>
            <p class="p-prose">{{ s.mensagem }}</p>
            <div v-if="s.resposta" class="p-alert">
              <strong>Resposta da equipe</strong>
              <p class="p-prose">{{ s.resposta }}</p>
            </div>
          </article>
          <p
            v-if="!ordenadas.length && !solicitacoes.carregando.value"
            class="p-empty"
          >
            Você ainda não enviou solicitações.
          </p>
        </div>
      </section></template
    >
  </div>
</template>
<script setup>
import { ref, reactive, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { collection, query, where, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../composables/useAuth";
import { usePortal } from "../../composables/usePortal";
import { useColecao } from "../../composables/useColecao";
import {
  TIPOS_ATENDIMENTO,
  STATUS_ATENDIMENTO,
  enviarSolicitacao,
} from "../../portal/atendimentos";
import { dataTexto, mensagemErro } from "../../portal/validacao";
import ContaForm from "../../components/portal/ContaForm.vue";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { conta } = useAuth(),
  { escolas } = usePortal(),
  route = useRoute(),
  form = reactive({
    tipo: TIPOS_ATENDIMENTO[route.query.tipo] ? route.query.tipo : "ouvidoria",
    nome: "",
    assunto: "",
    mensagem: "",
    escolaId: "",
    alunoNome: "",
    serie: "",
  }),
  ocupado = ref(false),
  erro = ref(""),
  sucesso = ref(""),
  ciente = ref(false),
  pendente = ref(false);
let protocolo = "",
  envioPendente = null;
const escolar = computed(() => ["matricula", "transporte"].includes(form.tipo)),
  solicitacoes = useColecao(
    () =>
      conta.value?.emailVerified
        ? query(
            collection(db, "solicitacoes"),
            where("donoUid", "==", conta.value.uid),
          )
        : null,
    () => [conta.value?.uid, conta.value?.emailVerified],
  ),
  ordenadas = computed(() =>
    [...solicitacoes.dados.value].sort(
      (a, b) =>
        (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0),
    ),
  );
watch(
  () => form.tipo,
  () => {
    form.escolaId = "";
    form.alunoNome = "";
    form.serie = "";
    protocolo = "";
    envioPendente = null;
    pendente.value = false;
  },
);
watch(
  () => conta.value?.uid,
  () => {
    form.nome = "";
    form.assunto = "";
    form.mensagem = "";
    form.alunoNome = "";
    form.serie = "";
    protocolo = "";
    envioPendente = null;
    pendente.value = false;
    sucesso.value = "";
  },
);
async function enviar() {
  if (ocupado.value) return;
  ocupado.value = true;
  erro.value = "";
  try {
    protocolo ||= doc(collection(db, "solicitacoes")).id;
    envioPendente ||= { ...form };
    const id = await enviarSolicitacao(envioPendente, protocolo);
    sucesso.value = "Solicitação recebida. Seu protocolo é " + id + ".";
    form.assunto = "";
    form.mensagem = "";
    ciente.value = false;
    protocolo = "";
    envioPendente = null;
    pendente.value = false;
  } catch (e) {
    pendente.value = [
      "portal/timeout",
      "unavailable",
      "deadline-exceeded",
    ].includes(e.code);
    if (!pendente.value) {
      protocolo = "";
      envioPendente = null;
    }
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
fieldset {
  border: 0;
  min-width: 0;
}
</style>
