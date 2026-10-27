<template>
  <section>
    <AgendaMensal
      v-if="!anual"
      :calendario="dados"
      @anual="abrirAnual"
      @pdf="exportar($event, false)"
      @imprimir="exportar($event, true)"
    />
    <section
      v-else
      class="p-container p-page p-stack anual"
      aria-labelledby="cal-anual-titulo"
    >
      <header class="anual-cabecalho">
        <div>
          <p class="p-eyebrow">SEMED · PEDRO II</p>
          <h1 id="cal-anual-titulo" ref="tituloAnual" tabindex="-1">
            Calendário anual {{ ano }}
          </h1>
          <p>
            O ano completo em uma visão. Selecione uma data para consultar seus
            eventos.
          </p>
        </div>
        <button class="p-button" @click="voltar">
          ← Voltar ao calendário mensal
        </button>
      </header>
      <section
        class="anual-exportar"
        aria-label="Baixar ou imprimir calendário"
      >
        <label class="p-field"
          >Ano<select
            v-model.number="ano"
            :disabled="ocupado"
            @change="carregar"
          >
            <option v-for="a in anos" :key="a" :value="a">{{ a }}</option>
          </select></label
        ><label class="p-field"
          >Período para baixar ou imprimir<select v-model="periodo">
            <option value="">Ano inteiro</option>
            <option
              v-for="(nome, i) in MESES"
              :key="nome"
              :value="String(i + 1)"
            >
              {{ nome }}
            </option>
          </select></label
        ><button
          class="p-button primary"
          :disabled="ocupado || !dados || gerando"
          @click="exportar(null, false)"
        >
          Baixar PDF</button
        ><button
          class="p-button"
          :disabled="ocupado || !dados || gerando"
          @click="exportar(null, true)"
        >
          Imprimir
        </button>
      </section>
      <p class="anual-nota">
        O PDF anual organiza os 12 meses em duas páginas A4, com legenda. O PDF
        mensal inclui os eventos do mês. A impressão abre esse mesmo PDF.
      </p>
      <GradeCalendario v-if="dados" :key="ano" :calendario="dados" />
    </section>
    <div
      v-if="erro || mensagem || gerando"
      class="p-container retorno"
      :class="{ 'p-alert': erro }"
      role="status"
    >
      {{ erro || (gerando ? "Preparando calendário…" : mensagem) }}
    </div>
  </section>
</template>
<script setup>
import { ref, onMounted, nextTick } from "vue";
import GradeCalendario from "../../components/calendario/GradeCalendario.vue";
import AgendaMensal from "../../components/OneCalendario.vue";
import original from "../../data/calendario2026.json";
import { MESES, validarCalendario } from "../../../shared/calendario.mjs";
import { anosPublicados, lerCalendario } from "../../services/calendarios";
const anual = ref(false),
  ano = ref(2026),
  anos = ref([2026]),
  dados = ref(validarCalendario(original)),
  erro = ref(""),
  mensagem = ref(""),
  ocupado = ref(false),
  gerando = ref(false),
  periodo = ref(""),
  tituloAnual = ref(null);
let consulta = 0;
async function carregar() {
  const atual = ++consulta,
    alvo = ano.value;
  ocupado.value = true;
  erro.value = "";
  dados.value = alvo === 2026 ? validarCalendario(original) : null;
  try {
    const r = await lerCalendario(alvo);
    if (atual !== consulta) return;
    if (r) dados.value = r.dados;
    else if (alvo !== 2026)
      erro.value = "Este calendário ainda não foi publicado.";
  } catch {
    if (atual === consulta)
      erro.value =
        alvo === 2026
          ? "Versão de referência 2026. Não foi possível consultar revisões online."
          : "Não foi possível consultar o calendário. Tente novamente.";
  } finally {
    if (atual === consulta) ocupado.value = false;
  }
}
async function abrirAnual() {
  anual.value = true;
  await nextTick();
  tituloAnual.value?.focus();
}
async function voltar() {
  anual.value = false;
  await nextTick();
  document
    .querySelector(".calendar-controls")
    ?.scrollIntoView({ block: "start" });
}
async function exportar(mesMensal, imprimir) {
  if (gerando.value || !dados.value) return;
  const mes = mesMensal
    ? Number(mesMensal.slice(5, 7))
    : periodo.value
      ? Number(periodo.value)
      : null;
  const copia = JSON.parse(JSON.stringify(dados.value));
  let janela;
  if (imprimir) {
    janela = window.open("", "_blank");
    if (!janela) {
      erro.value =
        "Permita abrir o PDF em uma nova aba ou use Baixar PDF para imprimir o arquivo.";
      return;
    }
    janela.opener = null;
  }
  gerando.value = true;
  mensagem.value = "";
  erro.value = "";
  try {
    const { gerarCalendarioPdf } =
      await import("../../components/calendario/calendarioPdf.mjs");
    const pdf = gerarCalendarioPdf(copia, mes);
    if (imprimir) {
      pdf.autoPrint();
      const url = URL.createObjectURL(pdf.output("blob"));
      janela.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 300000);
      mensagem.value =
        "PDF aberto para impressão. Se a janela de impressão não abrir, use o botão de imprimir do visualizador.";
    } else {
      pdf.save(
        `calendario-escolar-${copia.ano}${mes ? "-" + String(mes).padStart(2, "0") : "-anual"}.pdf`,
      );
      mensagem.value = "PDF gerado. Confira os downloads do navegador.";
    }
  } catch (e) {
    janela?.close();
    erro.value = e.message || "Não foi possível gerar o PDF.";
  } finally {
    gerando.value = false;
  }
}
onMounted(async () => {
  await carregar();
  try {
    anos.value = [...new Set([2026, ...(await anosPublicados())])].sort(
      (a, b) => b - a,
    );
  } catch {
    /* Base de referência disponível. */
  }
});
</script>
<style scoped>
.anual-cabecalho {
  display: flex;
  align-items: start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.anual-cabecalho h1 {
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  margin: 0.3rem 0 0.5rem;
}
.anual-exportar {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  align-items: end;
  padding: 1rem;
  border: 1px solid var(--p-border);
  border-radius: 12px;
  background: var(--p-surface);
}
.anual-exportar label {
  flex: 1 1 160px;
}
.anual-nota {
  font-size: 0.82rem;
  color: var(--p-muted);
}
.retorno {
  padding-block: 0.8rem;
  overflow-wrap: anywhere;
}
@media (max-width: 560px) {
  .anual-exportar > .p-button {
    flex: 1;
  }
  .anual-cabecalho > .p-button {
    width: 100%;
  }
}
</style>
