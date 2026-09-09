<template>
  <section>
    <header class="p-page-head">
      <h1>Solicitações e atendimento</h1>
      <p>
        {{
          geral
            ? "Matrículas, transporte, manifestações e pedidos de informação."
            : "Matrículas e transporte das escolas vinculadas ao seu perfil."
        }}
      </p>
    </header>
    <EstadoConsulta :consulta="escolas" />
    <div class="p-grid two">
      <label class="p-field"
        >Escola<select aria-label="Escola" v-model="escolaId">
          <option value="">
            {{ geral ? "Toda a rede" : "Selecione uma escola" }}
          </option>
          <option v-for="e in escolas.dados.value" :key="e.id" :value="e.id">
            {{ e.nome }}
          </option>
        </select></label
      ><label class="p-field"
        >Situação<select aria-label="Situação" v-model="filtro">
          <option value="">Todas</option>
          <option v-for="(r, k) in STATUS_ATENDIMENTO" :key="k" :value="k">
            {{ r }}
          </option>
        </select></label
      >
    </div>
    <EstadoConsulta :consulta="consulta" />
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <div class="p-stack">
      <article v-for="s in filtradas" :key="s.id" class="p-card">
        <span class="p-badge"
          >{{ TIPOS_ATENDIMENTO[s.tipo] }} ·
          {{ STATUS_ATENDIMENTO[s.status] }}</span
        >
        <h2>{{ s.assunto }}</h2>
        <p class="p-small">
          {{ dataTexto(s.criadoEm) }} · Protocolo {{ s.id }}
        </p>
        <p>{{ s.nome }} · {{ s.email }}</p>
        <p v-if="s.alunoNome">Aluno: {{ s.alunoNome }} · {{ s.serie }}</p>
        <p class="p-prose">{{ s.mensagem }}</p>
        <template v-if="editando === s.id"
          ><form class="p-stack" @submit.prevent="salvar(s)">
            <label class="p-field"
              >Situação<select aria-label="Situação" v-model="status">
                <option
                  v-for="(r, k) in STATUS_ATENDIMENTO"
                  :key="k"
                  :value="k"
                >
                  {{ r }}
                </option>
              </select></label
            ><label class="p-field"
              >Resposta visível ao solicitante<textarea
                aria-label="Resposta visível ao solicitante"
                v-model="resposta"
                maxlength="5000"
                :required="
                  ['deferida', 'indeferida', 'respondida'].includes(status)
                "
              />
            </label>
            <div class="p-actions">
              <button class="p-button primary" :disabled="ocupado">
                {{
                  ocupado ? "Salvando…" : "Salvar andamento e resposta"
                }}</button
              ><button
                class="p-button"
                type="button"
                :disabled="ocupado"
                @click="editando = ''"
              >
                Cancelar
              </button>
            </div>
          </form></template
        ><template v-else
          ><p v-if="s.resposta" class="p-alert p-prose">{{ s.resposta }}</p>
          <button class="p-button" @click="editar(s)">
            Atender solicitação
          </button></template
        >
      </article>
      <p v-if="!filtradas.length && !consulta.carregando.value" class="p-empty">
        {{
          !geral && !escolaId
            ? "Selecione uma escola para consultar."
            : "Nenhuma solicitação corresponde ao filtro."
        }}
      </p>
    </div>
  </section>
</template>
<script setup>
import { transacaoConfirmada } from "../../portal/transacao";
import { ref, computed, watch } from "vue";
import {
  collection,
  query,
  where,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { useEscolasAcesso } from "../../composables/useEscolasAcesso";
import { useAuth } from "../../composables/useAuth";
import { cargoAtual } from "../../portal/permissoes";
import {
  TIPOS_ATENDIMENTO,
  STATUS_ATENDIMENTO,
} from "../../portal/atendimentos";
import { mensagemErro, dataTexto } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { usuario } = useAuth(),
  geral = computed(() =>
    ["master", "alimentador"].includes(cargoAtual(usuario.value.papel)),
  ),
  escolas = useEscolasAcesso(),
  escolaId = ref(""),
  filtro = ref(""),
  editando = ref(""),
  status = ref(""),
  resposta = ref(""),
  versao = ref(0),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  consulta = useColecao(
    () => {
      if (!geral.value && !escolaId.value) return null;
      const q = [];
      if (escolaId.value) q.push(where("escolaId", "==", escolaId.value));
      if (!geral.value)
        q.push(where("tipo", "in", ["matricula", "transporte"]));
      return query(collection(db, "solicitacoes"), ...q);
    },
    () => [escolaId.value, usuario.value.papel],
  ),
  filtradas = computed(() =>
    consulta.dados.value
      .filter((s) => !filtro.value || s.status === filtro.value)
      .sort(
        (a, b) =>
          (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0),
      ),
  );
watch(escolaId, () => (editando.value = ""));
function editar(s) {
  editando.value = s.id;
  status.value = s.status;
  resposta.value = s.resposta;
  versao.value = s.versao;
}
async function salvar(s) {
  ocupado.value = true;
  erro.value = "";
  try {
    const r = doc(db, "solicitacoes", s.id);
    await transacaoConfirmada(async (t) => {
      const atual = await t.get(r);
      if (!atual.exists() || atual.data().versao !== versao.value)
        throw new Error(
          "Outro usuário atualizou este protocolo. Reabra o atendimento.",
        );
      t.update(r, {
        status: status.value,
        resposta: resposta.value.trim(),
        versao: versao.value + 1,
        atendidoPor: usuario.value.uid,
        atualizadoEm: serverTimestamp(),
      });
    });
    editando.value = "";
    mensagem.value =
      "Andamento salvo. A resposta já está disponível na conta do solicitante.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
</script>
