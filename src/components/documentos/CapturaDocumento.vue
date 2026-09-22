<template>
  <section class="captura af-card" aria-label="Digitalizar documento">
    <div class="af-titulo">
      <div>
        <h3>Fotografar e digitalizar</h3>
        <p>
          Uma página por foto. Apoie o papel, evite sombras e enquadre todas as
          bordas.
        </p>
      </div>
      <span class="af-selo">Arquivo privado</span>
    </div>
    <div class="af-acoes">
      <label class="botao"
        >Tirar foto<input
          class="af-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          :disabled="ocupado"
          @change="escolher" /></label
      ><label class="botao"
        >Escolher foto ou PDF<input
          class="af-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          :disabled="ocupado"
          @change="escolher"
      /></label>
    </div>
    <template v-if="preparado">
      <div class="af-grade captura-grade">
        <div>
          <img
            v-if="preview"
            :src="preview"
            alt="Prévia da página que será enviada"
            class="preview"
          />
          <p v-else>
            PDF selecionado: {{ preparado.name }}. Confira o documento no seu
            leitor antes de enviar.
          </p>
          <p>{{ Math.ceil(preparado.size / 1024) }} KB após preparação</p>
          <div v-if="preview" class="af-acoes">
            <button class="botao" :disabled="ocupado || enviado" @click="girar">
              Girar 90°</button
            ><button
              class="botao"
              :disabled="ocupado || enviado"
              @click="recortar"
            >
              {{ corte ? "Restaurar margens" : "Cortar 4% das margens" }}
            </button>
          </div>
          <p class="af-nota">
            Confira se o texto ficou legível. A avaliação automática não garante
            ausência de desfoque ou perda de informação.
          </p>
          <ul v-if="avisos.length" class="af-aviso">
            <li v-for="a in avisos" :key="a">{{ a }}</li>
          </ul>
        </div>
        <div class="af-campos">
          <label class="campo"
            >Título do documento<input
              v-model="titulo"
              :readonly="enviado"
              maxlength="160"
              :disabled="ocupado"
              placeholder="Ex.: Visita AF — página 1"
          /></label>
          <button
            v-if="preview"
            class="botao"
            :disabled="ocupado || enviado"
            @click="ler"
          >
            Ler texto desta página
          </button>
          <div v-if="lendo" role="status">
            <p>Lendo no aparelho... {{ progresso }}%</p>
            <progress
              :value="progresso"
              max="100"
              aria-label="Progresso da leitura"
            /><button class="botao" @click="cancelarLeitura">
              Cancelar leitura
            </button>
          </div>
          <p v-if="confianca !== null" class="af-nota">
            Indicador do OCR: {{ Math.round(confianca) }}%. Não representa
            certeza sobre os campos. Revise números, nomes e marcações.
          </p>
          <label class="campo"
            >Texto lido / transcrição revisada<textarea
              v-model="texto"
              :readonly="enviado"
              rows="9"
              maxlength="30000"
              :disabled="ocupado"
              placeholder="A leitura aparecerá aqui. Você também pode transcrever manualmente."
            />
          </label>
          <p v-if="!preview" class="af-nota">
            Nesta versão, o PDF pode ser anexado. Para leitura automática,
            fotografe ou exporte suas páginas como imagens.
          </p>
          <button
            class="botao"
            :disabled="ocupado || !texto.trim()"
            @click="$emit('texto', texto)"
          >
            Usar texto revisado no formulário
          </button>
          <label class="af-check"
            ><input
              v-model="revisado"
              type="checkbox"
              :disabled="ocupado"
            />Conferi a legibilidade da página e revisei o texto
            informado.</label
          >
        </div>
      </div>
      <div class="af-acoes">
        <button
          class="botao botao-primario"
          :disabled="ocupado || !revisado || !titulo.trim() || enviado"
          @click="salvar"
        >
          {{
            enviando
              ? "Enviando e confirmando..."
              : enviado
                ? "Arquivo salvo"
                : "Salvar arquivo privado"
          }}</button
        ><button class="botao" :disabled="ocupado" @click="limpar">
          Outra página / limpar
        </button>
      </div>
    </template>
    <p v-if="erro" role="alert" class="mensagem-erro">{{ erro }}</p>
    <p v-if="sucesso" role="status" class="mensagem-sucesso">{{ sucesso }}</p>
  </section>
</template>
<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import {
  prepararImagem,
  base64Arquivo,
  criarLeitor,
} from "../../utils/digitalizacao";
import { alimentacaoApi } from "../../services/alimentacaoApi";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
const props = defineProps({
    escolaId: { type: String, required: true },
    vinculo: { type: Object, default: null },
  }),
  emit = defineEmits(["texto", "salvo", "ocupado"]);
const original = ref(null),
  preparado = ref(null),
  preview = ref(""),
  titulo = ref(""),
  texto = ref(""),
  avisos = ref([]),
  revisado = ref(false),
  erro = ref(""),
  sucesso = ref(""),
  lendo = ref(false),
  enviando = ref(false),
  processando = ref(false),
  progresso = ref(0),
  confianca = ref(null),
  rotacao = ref(0),
  corte = ref(false),
  enviado = ref(false);
let id = crypto.randomUUID(),
  leitor;
let geracaoLeitura = 0;
const ocupado = computed(
  () => lendo.value || enviando.value || processando.value,
);
watch(ocupado, (v) => emit("ocupado", v), { flush: "sync" });
watch([texto, titulo], () => {
  revisado.value = false;
});
useSaidaSegura(() => ocupado.value || (!!preparado.value && !enviado.value));
function revogar() {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
}
function limpar() {
  revogar();
  original.value = null;
  preparado.value = null;
  texto.value = "";
  titulo.value = "";
  revisado.value = false;
  enviado.value = false;
  sucesso.value = "";
  erro.value = "";
  confianca.value = null;
  avisos.value = [];
  id = crypto.randomUUID();
  rotacao.value = 0;
  corte.value = false;
}
async function preparar() {
  processando.value = true;
  erro.value = "";
  try {
    const p = await prepararImagem(original.value, rotacao.value, corte.value);
    revogar();
    preparado.value = p.file;
    preview.value = URL.createObjectURL(p.file);
    avisos.value = p.avisos;
    revisado.value = false;
    enviado.value = false;
    id = crypto.randomUUID();
  } catch (e) {
    erro.value = e.message;
  } finally {
    processando.value = false;
  }
}
async function escolher(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  if (
    preparado.value &&
    !enviado.value &&
    !window.confirm("Substituir a página ainda não salva?")
  )
    return;
  limpar();
  original.value = f;
  titulo.value = f.name.replace(/\.[^.]+$/, "").slice(0, 160);
  if (f.type === "application/pdf") {
    if (f.size > 2 * 1024 * 1024) {
      erro.value =
        "O PDF deve ter até 2 MB. Fotografe as páginas separadamente se necessário.";
      return;
    }
    preparado.value = f;
  } else await preparar();
}
async function girar() {
  rotacao.value = (rotacao.value + 90) % 360;
  texto.value = "";
  confianca.value = null;
  await preparar();
}
async function recortar() {
  corte.value = !corte.value;
  texto.value = "";
  confianca.value = null;
  await preparar();
}
async function ler() {
  const geracao = ++geracaoLeitura;
  lendo.value = true;
  erro.value = "";
  progresso.value = 0;
  leitor = criarLeitor();
  try {
    const r = await leitor.ler(preparado.value, (v) => (progresso.value = v));
    if (geracao !== geracaoLeitura) return;
    texto.value = r.texto;
    confianca.value = r.confianca;
    if (!texto.value.trim())
      erro.value =
        "Não foi possível reconhecer texto. Tire outra foto ou transcreva os campos.";
  } catch {
    if (geracao !== geracaoLeitura) return;
    erro.value =
      "Leitura interrompida ou indisponível. Você pode tentar novamente ou transcrever manualmente.";
  } finally {
    if (geracao === geracaoLeitura) lendo.value = false;
  }
}
async function cancelarLeitura() {
  geracaoLeitura++;
  await leitor?.cancelar();
  lendo.value = false;
}
async function salvar() {
  if (ocupado.value || !revisado.value || enviado.value) return;
  enviando.value = true;
  erro.value = "";
  try {
    const r = await alimentacaoApi({
      acao: "enviar",
      escolaId: props.escolaId,
      id,
      nome: preparado.value.name,
      mime: preparado.value.type,
      base64: await base64Arquivo(preparado.value),
      titulo: titulo.value,
      texto: texto.value,
      revisado: true,
      vinculo: props.vinculo,
    });
    enviado.value = true;
    sucesso.value = "Arquivo confirmado no B2 e registrado no histórico.";
    emit("salvo", { id: r.id, texto: texto.value, titulo: titulo.value });
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
onBeforeUnmount(() => {
  geracaoLeitura++;
  leitor?.cancelar();
  revogar();
});
</script>
<style scoped>
.preview {
  display: block;
  max-height: 520px;
  max-width: 100%;
  object-fit: contain;
  margin: auto;
  border: 1px solid #cadbd6;
  background: #f5f7f6;
}
.af-file {
  display: block;
  max-width: 210px;
  margin-top: 6px;
  font-size: 0.75rem;
}
.captura-grade {
  align-items: start;
}
.captura progress {
  width: 100%;
}
</style>
