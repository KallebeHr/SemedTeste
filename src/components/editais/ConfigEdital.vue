<template>
  <section class="p-card p-stack" aria-labelledby="config-edital">
    <h3 id="config-edital">PDF oficial e inscrições online</h3>
    <p v-if="!salvo">Salve primeiro o rascunho para configurar o edital.</p>
    <template v-else>
      <p>
        Estas configurações são salvas separadamente do texto e entram em vigor
        imediatamente se o edital já estiver publicado.
      </p>
      <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
      <p role="status">{{ mensagem }}</p>
      <fieldset :disabled="ocupado || !carregado" class="p-stack">
        <label class="p-field"
          >Nome do processo<input v-model="form.nome" maxlength="5000"
        /></label>
        <label class="p-field"
          >Formulário<select v-model="form.modelo">
            <option value="anexo-ii-2026">Anexo II — Boas Práticas 2026</option>
            <option value="personalizado">
              Formulário de texto personalizado
            </option>
          </select></label
        >
        <label v-if="form.modelo === 'personalizado'" class="p-field"
          >Campos obrigatórios, um título por linha<textarea
            v-model="extras"
            rows="5"
          /><small
            >Nome e e-mail já estão incluídos. Até 15 campos; títulos de até 150
            caracteres.</small
          ></label
        >
        <label class="p-field"
          >Categorias previstas no regulamento, uma por linha<textarea
            v-model="categorias"
            rows="3"
          /><small
            >Sem opções cadastradas, a categoria será preenchida como texto
            livre.</small
          ></label
        >
        <div class="p-grid two">
          <label class="p-field"
            >Abertura (horário de Brasília)<input
              type="datetime-local"
              v-model="inicio" /></label
          ><label class="p-field"
            >Encerramento (horário de Brasília)<input
              type="datetime-local"
              v-model="fim"
          /></label>
        </div>
        <p>Datas opcionais. Use somente os prazos do regulamento completo.</p>
        <label class="p-field"
          >Orientações para o preenchimento<textarea
            v-model="form.instrucoes"
            maxlength="5000"
            rows="4"
          />
        </label>
        <label class="p-field"
          >Aviso de privacidade e contato institucional<textarea
            v-model="form.privacidade"
            maxlength="5000"
            rows="4"
          /><small
            >Informe finalidade, acesso aos dados, retenção e canal
            institucional para dúvidas.</small
          ></label
        >
        <label class="p-check"
          ><input type="checkbox" v-model="form.validado" />Conferi as regras do
          regulamento completo, os prazos e o procedimento de assinaturas e
          ciências.</label
        >
        <label class="p-check"
          ><input type="checkbox" v-model="form.ativo" />Permitir inscrições
          online para este edital</label
        >
        <button type="button" class="p-button primary" @click="salvar">
          Salvar configurações do edital
        </button>
        <p v-if="versao">PDF oficial: {{ pdfNome || "Ainda não enviado" }}</p>
        <label v-if="versao" class="p-field"
          >Enviar ou substituir PDF oficial (até 2 MB)<input
            type="file"
            accept="application/pdf,.pdf"
            @change="upload"
        /></label>
        <router-link v-if="versao" :to="'/inscricao/' + editalId"
          >Abrir formulário (disponível após publicação e abertura)</router-link
        >
      </fieldset>
    </template>
  </section>
</template>
<script setup>
import { ref, reactive, watch } from "vue";
import { configuracao } from "../../../shared/editais.mjs";
import { editaisApi, arquivoBase64 } from "../../services/editaisApi";
const props = defineProps({ editalId: String, salvo: Boolean }),
  emit = defineEmits(["busy"]);
const form = reactive(configuracao()),
  versao = ref(0),
  carregado = ref(false),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  categorias = ref(""),
  extras = ref(""),
  inicio = ref(""),
  fim = ref(""),
  pdfNome = ref("");
function localBrasilia(v) {
  if (!v) return "";
  const d = new Date(Date.parse(v) - 3 * 3600000);
  return d.toISOString().slice(0, 16);
}
async function carregar() {
  carregado.value = false;
  erro.value = "";
  try {
    const { config } = await editaisApi(
      { acao: "config", editalId: props.editalId },
      true,
    );
    Object.assign(form, configuracao(config || {}));
    versao.value = config?.versao || 0;
    pdfNome.value = config?.pdf?.nome || "";
    categorias.value = form.categorias.join("\n");
    extras.value = form.camposExtras.join("\n");
    inicio.value = localBrasilia(form.inicio);
    fim.value = localBrasilia(form.fim);
    carregado.value = true;
  } catch (e) {
    erro.value = e.message;
  }
}
watch(
  () => [props.editalId, props.salvo],
  () => {
    if (props.salvo) carregar();
  },
  { immediate: true },
);
async function operar(fn) {
  ocupado.value = true;
  emit("busy", true);
  erro.value = "";
  mensagem.value = "";
  try {
    await fn();
    await carregar();
    mensagem.value = "Configuração salva no servidor.";
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
    emit("busy", false);
  }
}
async function salvar() {
  await operar(async () => {
    const config = configuracao({
      ...form,
      obrigatorios: [],
      categorias: categorias.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      camposExtras: extras.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      inicio: inicio.value
        ? new Date(inicio.value + ":00-03:00").toISOString()
        : "",
      fim: fim.value ? new Date(fim.value + ":00-03:00").toISOString() : "",
    });
    await editaisApi(
      {
        acao: "configurar",
        editalId: props.editalId,
        config,
        versao: versao.value,
      },
      true,
    );
  });
}
async function upload(e) {
  const f = e.target.files[0];
  if (!f) return;
  await operar(async () => {
    if (f.size > 2 * 1024 * 1024) throw Error("PDF deve ter até 2 MB.");
    try {
      await editaisApi(
        {
          acao: "pdf",
          editalId: props.editalId,
          versao: versao.value,
          nome: f.name,
          mime: "application/pdf",
          base64: await arquivoBase64(f),
        },
        true,
      );
    } catch (e) {
      throw Error(
        "PDF oficial não enviado: " +
          e.message +
          " As inscrições de texto usam o Firebase e não dependem deste upload.",
      );
    }
  });
  e.target.value = "";
}
</script>
