<template>
  <main class="p-container p-page p-stack inscricao">
    <router-link class="voltar" :to="'/publicacao/' + id">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M15 5l-7 7 7 7"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Voltar ao edital
    </router-link>

    <header class="p-page-head cabecalho">
      <img
        class="brasao"
        :src="brasao"
        alt="Brasão da Prefeitura Municipal de Pedro II"
      />
      <div class="cabecalho-texto">
        <p class="p-eyebrow">PREFEITURA MUNICIPAL DE PEDRO II · SEMED</p>
        <h1>{{ config?.nome || "Inscrição online" }}</h1>
        <p v-if="config?.modelo === 'anexo-ii-2026'" class="subtitulo">
          Anexo II — Ficha de inscrição da boa prática
        </p>
      </div>
    </header>

    <p v-if="carregando" role="status" class="carregando">
      <span class="spinner" aria-hidden="true"></span>
      Carregando edital…
    </p>
    <p v-if="erro" class="p-alert error alerta-erro" role="alert">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".15" />
        <path
          d="M12 7v6M12 16.5v.5"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          fill="none"
        />
      </svg>
      <span>{{ erro }}</span>
    </p>

    <!-- SUCESSO -->
    <section
      v-if="resultado"
      class="p-card p-stack cartao sucesso-card"
      aria-labelledby="sucesso"
    >
      <div class="selo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="38" height="38">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <h2 id="sucesso" tabindex="-1" ref="sucesso">
        Inscrição recebida com sucesso!
      </h2>
      <p class="protocolo-label">Seu número de protocolo</p>
      <p class="protocolo">
        <strong>{{ resultado.protocolo }}</strong>
      </p>
      <dl class="resumo">
        <div>
          <dt>Edital</dt>
          <dd>{{ config.nome }}</dd>
        </div>
        <div>
          <dt>Inscrição</dt>
          <dd>
            {{ resultado.dados.responsavel }} · {{ resultado.dados.titulo }}
          </dd>
        </div>
        <div>
          <dt>Enviada em</dt>
          <dd>{{ dataHora(resultado.criadoEm) }}</dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>
            <span
              class="selo-status"
              :class="{ ok: resultado.status === 'confirmada' }"
            >
              {{
                resultado.status === "confirmada"
                  ? "Confirmada"
                  : "Recebida — aguardando conferência"
              }}
            </span>
          </dd>
        </div>
      </dl>
      <p class="nota">
        O recebimento não representa confirmação ou homologação administrativa.
      </p>
      <button class="p-button primary btn-grande" @click="pdf(resultado)">
        Baixar ficha e comprovante em PDF / imprimir
      </button>
      <p class="nota destaque-aviso">
        Guarde o comprovante antes de encerrar esta sessão, especialmente em
        computador compartilhado.
      </p>
      <button class="p-button" @click="encerrar" :disabled="ocupado">
        Encerrar sessão / nova inscrição
      </button>
    </section>

    <p v-else-if="aviso" role="status" class="p-alert alerta-aviso">
      {{ aviso }}
    </p>

    <!-- FORMULÁRIO -->
    <form
      v-else-if="config"
      @submit.prevent="avancar"
      class="p-card p-stack cartao"
    >
      <div class="progresso">
        <ol class="passos" aria-hidden="true">
          <li
            v-for="(nome, i) in [
              'Identificação',
              'Experiência',
              'Declaração',
              'Revisão',
            ]"
            :key="nome"
            :class="{ feito: etapa > i + 1, atual: etapa === i + 1 }"
          >
            <span class="bolinha">
              <svg v-if="etapa > i + 1" viewBox="0 0 24 24" width="16" height="16">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span class="passo-nome">{{ nome }}</span>
          </li>
        </ol>
        <p role="status" class="etapa-texto">
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
      </div>

      <p class="dica-geral">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".15" />
          <path
            d="M12 11v6M12 7.5v.5"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
        <span>
          Os dados permanecem nesta tela ao avançar ou voltar. Evite fechar ou
          recarregar durante o preenchimento.
        </span>
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

        <p class="intro-etapa">
          {{
            [
              "Comece contando quem você é e qual prática está inscrevendo.",
              "Agora conte a experiência com suas palavras. Pode ser simples e direto.",
              "Leia com calma e confirme que está de acordo.",
              "Confira tudo antes de enviar. Se algo estiver errado, volte e corrija.",
            ][etapa - 1]
          }}
        </p>

        <div v-if="etapa < 4" class="p-stack">
          <template
            v-for="f in campos(config).filter((f) => f.etapa === etapa)"
            :key="f.id"
          >
            <label class="p-field campo"
              ><span class="campo-rotulo"
                >{{ f.label }}
                <em v-if="f.obrigatorio" class="obrig" title="Obrigatório"
                  >*</em
                >
                <em v-else class="opcional">(opcional)</em></span
              >
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
                :placeholder="
                  f.id === 'email'
                    ? 'nome@exemplo.com'
                    : f.id === 'telefone'
                      ? '(86) 90000-0000'
                      : ''
                "
              />
              <small v-if="etapa === 2" class="contador"
                >{{ dados[f.id]?.length || 0 }} / {{ f.max }} caracteres (limite
                técnico por campo).</small
              >
            </label>
          </template>

          <template v-if="etapa === 3">
            <div class="bloco-leitura">
              <p class="p-prose">{{ config.instrucoes }}</p>
            </div>
            <p class="dica-geral sem-arquivo">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>
                Esta inscrição é feita somente com os dados preenchidos. Não é
                necessário enviar arquivos.
              </span>
            </p>
            <div class="bloco-leitura declaracao">
              <p class="p-prose">{{ declaracao }}</p>
            </div>
            <label class="p-check aceite"
              ><input type="checkbox" v-model="dados.aceite" required /><span
                >Li e aceito expressamente a declaração acima.</span
              ></label
            >
            <details class="privacidade">
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
          <dl class="revisao">
            <template v-for="f in campos(config)" :key="f.id"
              ><div class="revisao-item">
                <dt>
                  <strong>{{ f.label }}</strong>
                </dt>
                <dd class="p-prose">
                  {{ dados[f.id] || "Não informado" }}
                </dd>
              </div></template
            >
          </dl>
          <div class="bloco-leitura declaracao">
            <p class="p-prose">{{ declaracao }}</p>
          </div>
          <p class="aceite-resumo" :class="{ sim: dados.aceite }">
            Aceite: {{ dados.aceite ? "Sim" : "Não" }}
          </p>
          <p class="nota">A inscrição será recebida para conferência pelo Master.</p>
        </div>

        <label class="armadilha" aria-hidden="true"
          >Não preencha<input
            v-model="website"
            tabindex="-1"
            autocomplete="off"
        /></label>

        <div class="p-actions acoes">
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
      <p v-if="ocupado" role="status" class="carregando">
        <span class="spinner" aria-hidden="true"></span>
        Aguarde a confirmação do servidor…
      </p>
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
/* ───────── Tokens (usam as variáveis do projeto, com fallback) ───────── */
.inscricao {
  --c-teal: var(--p-teal, #0f766e);
  --c-teal-escuro: #0b4f4a;
  --c-opala: #e3f4f0;
  --c-lilas: #efeafc;
  --c-sol: #f2b84b;
  --c-borda: var(--p-border, #d5dfdd);
  --c-erro: #b42318;
  --c-texto: #1c2b2a;
  --c-suave: #52625f;
  --raio-g: 1.25rem;
  --raio-m: 0.8rem;
  --raio-p: 0.5rem;
  max-width: 46rem;
  margin-inline: auto;
  padding-inline: clamp(0.75rem, 4vw, 1.5rem);
  color: var(--c-texto);
  overflow-wrap: anywhere;
}

/* ───────── Voltar ───────── */
.voltar {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  align-self: flex-start;
  padding: 0.5rem 0.9rem 0.5rem 0.6rem;
  border-radius: 999px;
  background: var(--c-opala);
  color: var(--c-teal-escuro);
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
}
.voltar:hover {
  background: #cdebe5;
}
.voltar:focus-visible,
.p-button:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--c-sol);
  outline-offset: 2px;
}

/* ───────── Cabeçalho ───────── */
.cabecalho {
  display: flex;
  align-items: center;
  gap: clamp(0.9rem, 3vw, 1.5rem);
  padding: clamp(1rem, 4vw, 1.75rem);
  border-radius: var(--raio-g);
  background:
    radial-gradient(circle at 100% 0%, var(--c-lilas) 0, transparent 55%),
    var(--c-opala);
  border: 1px solid #c6e6df;
}
.brasao {
  width: clamp(54px, 14vw, 78px);
  height: auto;
  float: none;
  margin: 0;
  flex-shrink: 0;
}
.cabecalho-texto {
  min-width: 0;
}
.cabecalho .p-eyebrow {
  margin: 0 0 0.25rem;
  font-size: clamp(0.72rem, 2.4vw, 0.82rem);
  font-weight: 600;
  color: var(--c-teal-escuro);
  letter-spacing: 0.02em;
}
.cabecalho h1 {
  margin: 0;
  font-size: clamp(1.35rem, 5.5vw, 2rem);
  line-height: 1.2;
  color: var(--c-teal-escuro);
}
.subtitulo {
  margin: 0.4rem 0 0;
  color: var(--c-suave);
  font-size: clamp(0.92rem, 3vw, 1.02rem);
}

/* ───────── Cartão principal ───────── */
.cartao {
  background: #fff;
  border: 1px solid var(--c-borda);
  border-radius: var(--raio-g);
  padding: clamp(1rem, 4vw, 2rem);
  box-shadow: 0 6px 24px -12px rgba(11, 79, 74, 0.25);
}

/* ───────── Progresso / passos ───────── */
.progresso {
  display: grid;
  gap: 0.6rem;
}
.passos {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
}
.passos li {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  position: relative;
  text-align: center;
  color: var(--c-suave);
  font-size: 0.82rem;
  min-width: 0;
}
.passos li:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 1.1rem;
  left: calc(50% + 1.4rem);
  right: calc(-50% + 1.4rem);
  height: 3px;
  border-radius: 3px;
  background: var(--c-borda);
}
.passos li.feito:not(:last-child)::after {
  background: var(--c-teal);
}
.bolinha {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 2px solid var(--c-borda);
  background: #fff;
  font-weight: 700;
  transition: all 0.2s;
}
.passos li.feito .bolinha {
  background: var(--c-teal);
  border-color: var(--c-teal);
  color: #fff;
}
.passos li.atual .bolinha {
  border-color: var(--c-teal);
  background: var(--c-sol);
  color: #3a2a00;
  box-shadow: 0 0 0 5px rgba(242, 184, 75, 0.3);
}
.passos li.atual {
  color: var(--c-teal-escuro);
  font-weight: 700;
}
.passo-nome {
  line-height: 1.2;
}
.etapa-texto {
  margin: 0;
  font-weight: 700;
  color: var(--c-teal-escuro);
  font-size: clamp(0.95rem, 3vw, 1.05rem);
}
progress {
  width: 100%;
  height: 0.5rem;
  accent-color: var(--p-teal, #0f766e);
  border-radius: 999px;
  overflow: hidden;
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  background: #e4ecea;
}
progress::-webkit-progress-bar {
  background: #e4ecea;
  border-radius: 999px;
}
progress::-webkit-progress-value {
  background: linear-gradient(90deg, var(--c-teal), #2fb59f);
  border-radius: 999px;
  transition: width 0.3s;
}
progress::-moz-progress-bar {
  background: linear-gradient(90deg, var(--c-teal), #2fb59f);
  border-radius: 999px;
}

/* ───────── Dicas e avisos ───────── */
.dica-geral,
.alerta-erro,
.alerta-aviso {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.75rem 0.9rem;
  border-radius: var(--raio-m);
  font-size: 0.93rem;
  line-height: 1.45;
}
.dica-geral {
  background: var(--c-lilas);
  color: #3b2f77;
}
.dica-geral svg,
.alerta-erro svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}
.dica-geral.sem-arquivo {
  background: var(--c-opala);
  color: var(--c-teal-escuro);
}
.alerta-erro {
  background: #fdecea;
  color: var(--c-erro);
  border: 1px solid #f4c3bd;
  font-weight: 600;
}
.alerta-aviso {
  background: #fff6e0;
  border: 1px solid #f0d58f;
  color: #5c4300;
}
.carregando {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  color: var(--c-suave);
}
.spinner {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  border: 3px solid #cfe3df;
  border-top-color: var(--c-teal);
  animation: gira 0.8s linear infinite;
}
@keyframes gira {
  to {
    transform: rotate(360deg);
  }
}
.nota {
  margin: 0;
  color: var(--c-suave);
  font-size: 0.9rem;
  line-height: 1.5;
}

/* ───────── Fieldset / campos ───────── */
fieldset {
  min-width: 0;
  margin: 0;
  border: 1px solid var(--c-borda);
  padding: clamp(0.9rem, 3.5vw, 1.4rem);
  border-radius: var(--raio-m);
}
legend {
  padding: 0 0.5rem;
  font-weight: 800;
  font-size: clamp(1.05rem, 3.5vw, 1.25rem);
  color: var(--c-teal-escuro);
}
.intro-etapa {
  margin: 0 0 1.1rem;
  color: var(--c-suave);
  line-height: 1.5;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.campo-rotulo {
  font-weight: 700;
  line-height: 1.35;
}
.obrig {
  color: var(--c-erro);
  font-style: normal;
  margin-left: 0.15rem;
}
.opcional {
  font-style: normal;
  font-weight: 500;
  color: var(--c-suave);
  font-size: 0.86rem;
  margin-left: 0.25rem;
}
input:not([type="checkbox"]),
textarea,
select {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 1rem; /* evita zoom automático no iPhone */
  font-weight: 400;
  padding: 0.8rem 0.9rem;
  border: 2px solid var(--c-borda);
  border-radius: var(--raio-p);
  background: #fbfdfc;
  color: var(--c-texto);
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background 0.15s;
}
input:not([type="checkbox"]):hover,
textarea:hover,
select:hover {
  border-color: #9cc9c1;
}
input:not([type="checkbox"]):focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--c-teal);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.18);
}
input:not([type="checkbox"]):user-valid:not(:placeholder-shown),
textarea:user-valid:not(:placeholder-shown) {
  border-color: #4fae9f;
}
input:user-invalid,
textarea:user-invalid,
select:user-invalid {
  border-color: var(--c-erro);
  background: #fff8f7;
}
textarea {
  resize: vertical;
  line-height: 1.5;
  min-height: 6rem;
}
.contador {
  align-self: flex-end;
  color: var(--c-suave);
  font-size: 0.82rem;
  font-weight: 400;
}

/* ───────── Declaração / aceite ───────── */
.bloco-leitura {
  padding: 0.9rem 1rem;
  border-left: 5px solid var(--c-teal);
  background: #f6faf9;
  border-radius: 0 var(--raio-m) var(--raio-m) 0;
}
.bloco-leitura.declaracao {
  border-left-color: var(--c-sol);
  background: #fffaf0;
}
.bloco-leitura p {
  margin: 0;
  line-height: 1.65;
  max-width: 70ch;
}
.aceite {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 2px solid var(--c-borda);
  border-radius: var(--raio-m);
  cursor: pointer;
  font-weight: 600;
  line-height: 1.4;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.aceite:has(input:checked) {
  border-color: var(--c-teal);
  background: var(--c-opala);
}
.aceite input {
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
  margin: 0.05rem 0 0;
  accent-color: var(--p-teal, #0f766e);
  cursor: pointer;
}
.privacidade {
  border: 1px solid var(--c-borda);
  border-radius: var(--raio-m);
  padding: 0.2rem 1rem;
}
.privacidade summary {
  cursor: pointer;
  padding: 0.7rem 0;
  font-weight: 700;
  color: var(--c-teal-escuro);
}
.privacidade p {
  line-height: 1.6;
}

/* ───────── Revisão ───────── */
.revisao {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.7rem;
  margin: 0;
}
.revisao-item {
  padding: 0.8rem 1rem;
  background: #f6faf9;
  border: 1px solid #dcebe8;
  border-radius: var(--raio-m);
}
.revisao dt {
  color: var(--c-teal-escuro);
  font-size: 0.88rem;
  margin-bottom: 0.25rem;
}
.revisao dd {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  line-height: 1.55;
}
.aceite-resumo {
  margin: 0;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  align-self: flex-start;
  background: #fdecea;
  color: var(--c-erro);
  font-weight: 700;
  width: fit-content;
}
.aceite-resumo.sim {
  background: var(--c-opala);
  color: var(--c-teal-escuro);
}

/* ───────── Botões ───────── */
.p-actions,
.acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.4rem;
}
.p-button {
  min-height: 3rem;
  padding: 0.75rem 1.4rem;
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid var(--c-teal);
  background: #fff;
  color: var(--c-teal-escuro);
  transition:
    transform 0.1s,
    background 0.15s,
    box-shadow 0.15s;
}
.p-button:hover:not(:disabled) {
  background: var(--c-opala);
}
.p-button:active:not(:disabled) {
  transform: translateY(1px);
}
.p-button.primary {
  background: var(--c-teal);
  color: #fff;
  box-shadow: 0 6px 16px -8px rgba(11, 79, 74, 0.7);
}
.p-button.primary:hover:not(:disabled) {
  background: var(--c-teal-escuro);
}
.p-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-grande {
  width: 100%;
  padding-block: 0.9rem;
}

/* ───────── Sucesso ───────── */
.sucesso-card {
  text-align: center;
  align-items: center;
}
.sucesso-card h2 {
  margin: 0;
  color: var(--c-teal-escuro);
  font-size: clamp(1.3rem, 5vw, 1.8rem);
  outline: none;
}
.selo {
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  margin-inline: auto;
  border-radius: 50%;
  background: var(--c-teal);
  color: #fff;
  box-shadow: 0 0 0 10px var(--c-opala);
  animation: surge 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes surge {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
}
.protocolo-label {
  margin: 0;
  color: var(--c-suave);
  font-size: 0.9rem;
}
.protocolo {
  margin: 0;
  padding: 0.7rem 1.2rem;
  border: 2px dashed var(--c-teal);
  border-radius: var(--raio-m);
  background: var(--c-opala);
  font-size: clamp(1.15rem, 5vw, 1.6rem);
  color: var(--c-teal-escuro);
  letter-spacing: 0.03em;
  max-width: 100%;
}
.resumo {
  display: grid;
  gap: 0.6rem;
  width: 100%;
  margin: 0.3rem 0;
  text-align: left;
}
.resumo > div {
  padding: 0.7rem 1rem;
  background: #f6faf9;
  border-radius: var(--raio-m);
}
.resumo dt {
  font-size: 0.82rem;
  color: var(--c-suave);
}
.resumo dd {
  margin: 0.1rem 0 0;
  font-weight: 600;
}
.selo-status {
  display: inline-block;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: #fff1cf;
  color: #5c4300;
  font-size: 0.9rem;
}
.selo-status.ok {
  background: var(--c-opala);
  color: var(--c-teal-escuro);
}
.destaque-aviso {
  padding: 0.7rem 0.9rem;
  border-radius: var(--raio-m);
  background: #fff6e0;
  color: #5c4300;
  text-align: left;
}
.sucesso-card .p-button {
  width: 100%;
}

/* ───────── Armadilha anti-robô (mantida) ───────── */
.armadilha {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

/* ───────── Responsivo ───────── */
@media (min-width: 640px) {
  .revisao {
    grid-template-columns: repeat(2, 1fr);
  }
  .revisao-item:has(dd.p-prose:only-child) {
    min-width: 0;
  }
  .resumo {
    grid-template-columns: repeat(2, 1fr);
  }
  .sucesso-card .p-button {
    width: auto;
  }
  .btn-grande {
    width: auto;
  }
}
@media (max-width: 639px) {
  .cabecalho {
    flex-direction: column;
    align-items: flex-start;
  }
  /* no celular só o passo atual mostra o nome */
  .passos li:not(.atual) .passo-nome {
    display: none;
  }
  .passos li:not(:last-child)::after {
    left: calc(50% + 1.3rem);
    right: calc(-50% + 1.3rem);
  }
  .p-actions,
  .acoes {
    flex-direction: column-reverse;
  }
  .p-actions .p-button,
  .acoes .p-button {
    width: 100%;
  }
}
@media (max-width: 360px) {
  .bolinha {
    width: 1.9rem;
    height: 1.9rem;
    font-size: 0.85rem;
  }
  .passos li:not(:last-child)::after {
    top: 0.95rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .selo,
  .spinner {
    animation: none;
  }
  * {
    transition: none !important;
  }
}
</style>