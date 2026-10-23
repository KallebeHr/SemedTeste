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
    </section>
    <p v-else-if="aviso" role="status" class="p-alert">{{ aviso }}</p>
    <form v-else-if="config" @submit.prevent="avancar" class="p-card p-stack">
      <p role="status">
        Etapa {{ etapa }} de 4 —
        {{
          [
            "Identificação da prática",
            "Síntese da experiência",
            "Declarações, documentos e ciências",
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
              "Declarações e documentos",
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
              O preenchimento digital e o aceite não substituem assinaturas ou
              ciências exigidas. Baixe a ficha, providencie as assinaturas
              conforme o regulamento e anexe o documento quando necessário.
            </p>
            <button
              type="button"
              class="p-button"
              @click="pdf({ config, dados, arquivos }, { rascunho: true })"
            >
              Baixar ficha para assinatura
            </button>
            <p>
              Documentos obrigatórios:
              {{
                config.obrigatorios.map((t) => TIPOS_ANEXO[t]).join("; ") ||
                "Consulte o regulamento e as orientações acima."
              }}
            </p>
            <label class="p-field"
              >Tipo de documento<select v-model="tipo">
                <option v-for="(nome, k) in TIPOS_ANEXO" :key="k" :value="k">
                  {{ nome }}
                </option>
              </select></label
            >
            <label class="p-field"
              >Adicionar PDF ou imagem<input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                @change="selecionar"
              /><small
                >Até {{ config.maxArquivos }} arquivos de {{ config.maxMB }} MB
                cada.</small
              ></label
            >
            <ul>
              <li v-for="a in arquivos" :key="a.id">
                {{ TIPOS_ANEXO[a.tipo] }} — {{ a.nome }} · Envio confirmado
              </li>
            </ul>
            <ul>
              <li v-for="a in pendentes" :key="a.id">
                {{ a.file.name }} — {{ a.erro || "Aguardando envio" }}
                <button
                  type="button"
                  class="p-button"
                  @click="enviarArquivo(a)"
                >
                  Enviar / tentar novamente</button
                ><button
                  v-if="!a.tentado"
                  type="button"
                  class="p-button"
                  @click="pendentes = pendentes.filter((p) => p.id !== a.id)"
                >
                  Remover seleção
                </button>
              </li>
            </ul>
            <p class="p-prose">{{ declaracao }}</p>
            <label class="p-check"
              ><input type="checkbox" v-model="dados.aceite" required />Li e
              aceito expressamente a declaração acima.</label
            >
            <details>
              <summary>Privacidade dos dados</summary>
              <p class="p-prose">{{ config.privacidade }}</p>
              <p>
                Os anexos não são públicos. O acesso é restrito ao Master e à
                sessão que iniciou esta inscrição.
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
          <h2>Anexos</h2>
          <ul>
            <li v-for="a in arquivos" :key="a.id">
              {{ TIPOS_ANEXO[a.tipo] }} — {{ a.nome }}
            </li>
          </ul>
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
          ><button class="p-button primary" :disabled="pendentes.length > 0">
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
  editaisApi,
  arquivoBase64,
} from "../../services/editaisApi";
import {
  campos,
  validarFicha,
  DECLARACAO,
  TIPOS_ANEXO,
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
  arquivos = ref([]),
  pendentes = ref([]),
  tipo = ref("relato"),
  website = ref(""),
  sucesso = ref(null),
  dados = reactive({ aceite: false });
let identificacao = null,
  iniciado = false,
  offset = 0;
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
function chave() {
  if (!identificacao)
    identificacao = {
      id: crypto.randomUUID(),
      chave: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
    };
  return identificacao;
}
async function chamada(acao, extra = {}) {
  return editaisApi({ acao, editalId: id, ...chave(), ...extra });
}
async function iniciar() {
  if (!iniciado) {
    await chamada("iniciar", { website: website.value });
    iniciado = true;
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
function selecionar(e) {
  for (const file of e.target.files) {
    if (
      arquivos.value.length + pendentes.value.length >=
      config.value.maxArquivos
    ) {
      erro.value = "Limite de arquivos atingido.";
      break;
    }
    if (file.size > config.value.maxMB * 1024 * 1024) {
      erro.value = file.name + " excede o limite.";
      continue;
    }
    pendentes.value.push({
      id: crypto.randomUUID(),
      file,
      tipo: tipo.value,
      erro: "",
      tentado: false,
    });
  }
  e.target.value = "";
}
async function enviarArquivo(a) {
  ocupado.value = true;
  erro.value = "";
  try {
    await iniciar();
    a.tentado = true;
    const r = await chamada("upload", {
      arquivoId: a.id,
      tipo: a.tipo,
      nome: a.file.name,
      mime:
        a.file.type || (/\.pdf$/i.test(a.file.name) ? "application/pdf" : ""),
      base64: await arquivoBase64(a.file),
    });
    arquivos.value = r.arquivos;
    pendentes.value = pendentes.value.filter((p) => p.id !== a.id);
  } catch (e) {
    a.erro = e.message;
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
async function avancar() {
  erro.value = "";
  if (etapa.value < 3) {
    etapa.value++;
    return;
  }
  try {
    validarFicha(
      dados,
      config.value,
      arquivos.value.map((a) => ({ ...a, estado: "pronto" })),
    );
    if (pendentes.value.length) throw Error("Conclua todos os anexos.");
    if (etapa.value === 3) {
      etapa.value = 4;
      return;
    }
    ocupado.value = true;
    await iniciar();
    resultado.value = await chamada("enviar", { dados });
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
