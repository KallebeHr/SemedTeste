<template>
  <main class="p-container p-page p-stack">
    <router-link :to="'/publicacao/' + id">← Voltar ao edital</router-link>
    <header class="p-page-head">
      <img
        class="brasao"
        :src="brasao"
        alt="Brasão da Prefeitura Municipal de Pedro II"
      />
      <p class="p-eyebrow">PREFEITURA MUNICIPAL DE PEDRO II · SEMED</p>
      <h1>{{ config?.nome || "Inscrição online" }}</h1>
      <p v-if="config?.modelo === 'anexo-ii-2026'">
        Anexo II — Ficha de inscrição da boa prática
      </p>
    </header>
    <p v-if="carregando" role="status">Carregando edital…</p>
    <p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
    <section v-if="resultado" class="p-card p-stack" aria-labelledby="sucesso">
      <h2 id="sucesso" tabindex="-1" ref="sucesso">
        Inscrição recebida com sucesso!
      </h2>
      <p>
        <strong>{{ resultado.protocolo }}</strong>
      </p>
      <p>{{ config.nome }}</p>
      <p>{{ resultado.dados.responsavel }} · {{ resultado.dados.titulo }}</p>
      <p>{{ dataHora(resultado.criadoEm) }}</p>
      <p>
        Situação:
        {{
          resultado.status === "confirmada"
            ? "Confirmada"
            : "Recebida — aguardando conferência"
        }}
      </p>
      <p>
        O recebimento não representa confirmação ou homologação administrativa.
      </p>
      <button class="p-button primary" @click="pdf(resultado)">
        Baixar ficha e comprovante em PDF / imprimir
      </button>
      <p>
        Guarde o comprovante antes de encerrar esta sessão, especialmente em
        computador compartilhado.
      </p>
      <button class="p-button" @click="encerrar" :disabled="ocupado">
        Encerrar sessão / nova inscrição
      </button>
    </section>
    <p v-else-if="aviso" role="status" class="p-alert">{{ aviso }}</p>
    <form v-else-if="config" @submit.prevent="avancar" class="p-card p-stack">
      <p role="status">
        Etapa {{ etapa }} de 4 —
        {{
          [
            "Identificação da prática",
            "Síntese da experiência",
            "Declaração e ciência",
            "Revisão e envio",
          ][etapa - 1]
        }}
      </p>
      <progress :value="etapa" max="4" aria-label="Progresso do formulário" />
      <p>
        Os dados permanecem nesta tela ao avançar ou voltar. Evite fechar ou
        recarregar durante o preenchimento.
      </p>
      <fieldset :disabled="ocupado">
        <legend>
          {{
            [
              "Identificação",
              "Síntese da experiência",
              "Declaração",
              "Revisão",
            ][etapa - 1]
          }}
        </legend>
        <div v-if="etapa < 4" class="p-stack">
          <template
            v-for="f in campos(config).filter((f) => f.etapa === etapa)"
            :key="f.id"
          >
            <label class="p-field"
              >{{ f.label }}{{ f.obrigatorio ? " *" : " (opcional)" }}
              <select
                v-if="f.id === 'categoria' && config.categorias.length"
                v-model="dados[f.id]"
                required
              >
                <option value="">Selecione</option>
                <option v-for="c in config.categorias" :key="c">{{ c }}</option>
              </select>
              <textarea
                v-else-if="
                  etapa === 2 || f.id === 'coautores' || f.id === 'periodo'
                "
                v-model="dados[f.id]"
                :required="f.obrigatorio"
                :maxlength="f.max"
                :rows="etapa === 2 ? 8 : 3"
              />
              <input
                v-else
                v-model="dados[f.id]"
                :required="f.obrigatorio"
                :maxlength="f.max"
                :type="
                  f.id === 'email'
                    ? 'email'
                    : f.id === 'telefone'
                      ? 'tel'
                      : 'text'
                "
                :autocomplete="
                  f.id === 'email'
                    ? 'email'
                    : f.id === 'telefone'
                      ? 'tel'
                      : f.id === 'responsavel'
                        ? 'name'
                        : 'off'
                "
              />
              <small v-if="etapa === 2"
                >{{ dados[f.id]?.length || 0 }} / {{ f.max }} caracteres (limite
                técnico por campo).</small
              >
            </label>
          </template>
          <template v-if="etapa === 3">
            <p class="p-prose">{{ config.instrucoes }}</p>
            <p>
              Esta inscrição é feita somente com os dados preenchidos. Não é
              necessário enviar arquivos.
            </p>
            <p class="p-prose">{{ declaracao }}</p>
            <label class="p-check"
              ><input type="checkbox" v-model="dados.aceite" required />Li e
              aceito expressamente a declaração acima.</label
            >
            <details>
              <summary>Privacidade dos dados</summary>
              <p class="p-prose">{{ config.privacidade }}</p>
              <p>
                Os dados não são públicos. O acesso é restrito ao Master e à
                sessão que enviou esta inscrição.
              </p>
            </details>
          </template>
        </div>
        <div v-else class="p-stack">
          <dl>
            <template v-for="f in campos(config)" :key="f.id"
              ><dt>
                <strong>{{ f.label }}</strong>
              </dt>
              <dd class="p-prose">
                {{ dados[f.id] || "Não informado" }}
              </dd></template
            >
          </dl>
          <p class="p-prose">{{ declaracao }}</p>
          <p>Aceite: {{ dados.aceite ? "Sim" : "Não" }}</p>
          <p>A inscrição será recebida para conferência pelo Master.</p>
        </div>
        <label class="armadilha" aria-hidden="true"
          >Não preencha<input
            v-model="website"
            tabindex="-1"
            autocomplete="off"
        /></label>
        <div class="p-actions">
          <button
            v-if="etapa > 1"
            type="button"
            class="p-button"
            @click="etapa--"
          >
            Voltar e corrigir</button
          ><button class="p-button primary">
            {{
              ocupado
                ? "Processando…"
                : etapa === 4
                  ? "Enviar inscrição"
                  : "Avançar"
            }}
          </button>
        </div>
      </fieldset>
      <p v-if="ocupado" role="status">Aguarde a confirmação do servidor…</p>
    </form>
  </main>
</template>
<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
import {
  lerEdital,
  enviarInscricao,
  encerrarSessaoInscricao,
} from "../../services/editaisApi";
import {
  campos,
  validarFicha,
  DECLARACAO,
  abertura,
} from "../../../shared/editais.mjs";
import brasao from "../../components/editais/brasao.mjs";
const id = useRoute().params.id,
  config = ref(null),
  erro = ref(""),
  carregando = ref(true),
  aviso = ref(""),
  etapa = ref(1),
  ocupado = ref(false),
  resultado = ref(null),
  website = ref(""),
  sucesso = ref(null),
  dados = reactive({ aceite: false });
let offset = 0;
const declaracao = computed(() =>
  config.value?.modelo === "anexo-ii-2026"
    ? DECLARACAO
    : "Declaro que as informações prestadas são verdadeiras e que li o regulamento e o aviso de privacidade.",
);
useSaidaSegura(
  computed(
    () =>
      !resultado.value &&
      (ocupado.value ||
        Object.values(dados).some((v) => typeof v === "string" && v.length)),
  ),
);
async function encerrar() {
  if (
    !window.confirm(
      "Já guardou o comprovante? Esta ação encerra o acesso desta sessão à inscrição e permite iniciar outra.",
    )
  )
    return;
  ocupado.value = true;
  try {
    await encerrarSessaoInscricao();
    resultado.value = null;
    for (const key of Object.keys(dados)) delete dados[key];
    dados.aceite = false;
    for (const f of campos(config.value)) dados[f.id] = "";
    etapa.value = 1;
    erro.value = "";
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
function dataHora(v) {
  return (
    new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) +
    " (Brasília)"
  );
}
async function pdf(reg, opts) {
  try {
    const { baixarFicha } =
      await import("../../components/editais/fichaPdf.mjs");
    baixarFicha(reg, opts);
  } catch (e) {
    erro.value = "Não foi possível gerar a ficha: " + e.message;
  }
}
onMounted(async () => {
  try {
    const r = await lerEdital(id);
    config.value = r.config;
    offset = r.agora - Date.now();
    aviso.value = r.aviso;
    for (const f of campos(r.config)) dados[f.id] = "";
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
});
const timer = setInterval(() => {
  if (config.value && !resultado.value)
    aviso.value = abertura(config.value, Date.now() + offset);
}, 1000);
onUnmounted(() => clearInterval(timer));
async function avancar() {
  erro.value = "";
  if (etapa.value < 3) {
    etapa.value++;
    return;
  }
  try {
    validarFicha(dados, { ...config.value, obrigatorios: [] });
    if (etapa.value === 3) {
      etapa.value = 4;
      return;
    }
    ocupado.value = true;
    resultado.value = await enviarInscricao(
      id,
      dados,
      config.value.versao,
      website.value,
    );
    await nextTick();
    sucesso.value?.focus();
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
.brasao {
  width: 62px;
  height: auto;
  float: left;
  margin: 0 1.2rem 1rem 0;
}
fieldset {
  min-width: 0;
  border: 1px solid var(--p-border);
  padding: 1rem;
  border-radius: 0.8rem;
}
progress {
  width: 100%;
  accent-color: var(--p-teal);
}
dd {
  margin: 0 0 1rem;
  overflow-wrap: anywhere;
}
textarea {
  resize: vertical;
}
.armadilha {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.p-actions {
  margin-top: 1rem;
}
input,
textarea,
select {
  max-width: 100%;
}
</style>
