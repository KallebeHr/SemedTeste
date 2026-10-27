<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">ALIMENTAÇÃO ESCOLAR</p>
      <h1>Cuidado que chega à mesa.</h1>
      <p>
        Acompanhe os cardápios e as vistorias publicadas da sua escola. A
        consulta é pública e não exige login.
      </p>
    </header>
    <EstadoConsulta :consulta="escolas" />
    <div class="p-card p-grid two">
      <label class="p-field"
        >Pesquisar escola<input
          v-model="buscaEscola"
          type="search"
          placeholder="Digite o nome da escola"
      /></label>
      <label class="p-field"
        >Escola<select aria-label="Escola" v-model="escolaId">
          <option value="">Selecione uma escola</option>
          <option v-for="e in escolasFiltradas" :key="e.id" :value="e.id">
            {{ e.nome }}
          </option>
        </select></label
      ><label class="p-field"
        >Mês do cardápio<input
          aria-label="Mês do cardápio"
          v-model="mes"
          type="month"
      /></label>
    </div>
    <p
      v-if="
        !escolas.dados.value.length &&
        !escolas.carregando.value &&
        !escolas.erro.value
      "
      class="p-empty"
    >
      As escolas e os cardápios aparecerão aqui após a publicação pela
      Secretaria.
    </p>
    <template v-if="escolaId && escolaPublica"
      ><section class="p-section">
        <div class="p-section-head">
          <div>
            <p class="p-eyebrow">O QUE TEM NO PRATO</p>
            <h2>Cardápio mensal</h2>
            <p>{{ escolaPublica?.nome }}</p>
          </div>
        </div>
        <div v-if="etapas.length > 1 || turnos.length > 1" class="p-grid two">
          <label v-if="etapas.length > 1" class="p-field"
            >Etapa de ensino<select v-model="etapa">
              <option value="">Todas as etapas</option>
              <option v-for="v in etapas" :key="v">{{ v }}</option>
            </select></label
          ><label v-if="turnos.length > 1" class="p-field"
            >Turno<select v-model="turno">
              <option value="">Todos os turnos</option>
              <option v-for="v in turnos" :key="v">{{ v }}</option>
            </select></label
          >
        </div>
        <EstadoConsulta :consulta="publicacoes" />
        <div v-for="c in cardapios" :key="c.id" class="p-card p-stack">
          <h3>{{ c.titulo }}</h3>
          <p v-if="c.resumo">{{ c.resumo }}</p>
          <p>
            {{ c.numero }} ·
            {{ c.etapa || c.gradeCardapio?.etapa || c.categoria }} ·
            {{ c.turno || c.gradeCardapio?.turno }}
            <span v-if="c.programa">· {{ c.programa }}</span>
          </p>
          <details v-if="c.arquivoId" class="pdf-oficial">
            <summary>Visualizar PDF oficial</summary>
            <iframe
              :src="pdfUrl(c)"
              title="Cardápio oficial em PDF"
              loading="lazy"
            />
            <p>Se o PDF não abrir no celular, use os botões abaixo.</p>
          </details>
          <CardapioFolha
            v-if="gradeValida(c.gradeCardapio, c.numero)"
            :cardapio="c.gradeCardapio"
            :escola="
              escolas.dados.value.find((e) => e.id === escolaId)?.nome || ''
            "
            :responsavel="c.local"
          />
          <p v-else-if="c.texto" class="p-prose">{{ c.texto }}</p>
          <p v-if="c.observacoes" class="p-prose">{{ c.observacoes }}</p>
          <p
            v-if="c.local && !gradeValida(c.gradeCardapio, c.numero)"
            class="p-small"
          >
            Responsável técnico: {{ c.local }}
          </p>
          <div class="p-actions">
            <a
              v-if="c.arquivoId"
              class="p-button primary"
              :href="pdfUrl(c) + '&baixar=1'"
              >Baixar Cardápio em PDF</a
            ><a
              v-if="c.arquivoId"
              class="p-button"
              :href="pdfUrl(c)"
              target="_blank"
              rel="noopener"
              >Abrir PDF original</a
            >
            <button
              v-else
              class="p-button primary"
              :disabled="baixando"
              @click="baixar(c)"
            >
              {{ baixando ? "Gerando PDF…" : "Baixar cardápio em PDF" }}</button
            ><router-link class="p-button" :to="'/publicacao/' + c.id"
              >Abrir publicação</router-link
            >
          </div>
        </div>
        <p
          v-if="!cardapios.length && !publicacoes.carregando.value"
          class="p-empty"
        >
          Não há cardápio publicado para esta escola no período selecionado.
        </p>
      </section>
      <section class="p-section">
        <div class="p-section-head">
          <div>
            <p class="p-eyebrow">ACOMPANHAMENTO DA REDE</p>
            <h2>Vistorias concluídas</h2>
          </div>
          <span class="p-badge"
            >{{ vistorias.dados.value.length }} publicada(s)</span
          >
        </div>
        <EstadoConsulta :consulta="vistorias" />
        <div v-if="ordenadas.length" class="p-table-wrap">
          <table class="p-table">
            <caption class="sr-only">
              Resumos públicos de vistorias da escola selecionada
            </caption>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Resultado</th>
                <th>Responsável pela vistoria</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in ordenadas" :key="v.id">
                <td>{{ dataTexto(v.data) }}</td>
                <td>{{ tipos[v.tipo] || v.tipo }}</td>
                <td>
                  {{ resultados[v.status] || v.status
                  }}<span v-if="v.nota !== null"> · {{ v.nota }}/10</span>
                </td>
                <td>{{ v.responsavelNome }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p
          v-else-if="!vistorias.carregando.value && !vistorias.erro.value"
          class="p-empty"
        >
          Nenhuma vistoria foi publicada para esta escola.
        </p>
        <p class="p-small p-muted">
          Esta página apresenta os resumos publicados pela equipe responsável. A
          ausência de publicação não indica ausência de vistoria. Dados de
          identificação e registros internos são restritos.
        </p>
      </section></template
    >
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <router-link to="/fale-conosco"
      >Dúvidas sobre a alimentação escolar? Fale conosco.</router-link
    >
  </div>
</template>
<script setup>
import { filtrarCardapios } from "../../../shared/cardapios.mjs";
import CardapioFolha from "../../components/cardapio/CardapioFolha.vue";
import { gradeValida } from "../../portal/cardapioMensal";

import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { collection } from "firebase/firestore";
import { db } from "../../firebase";
import { usePortal } from "../../composables/usePortal";
import { useColecao } from "../../composables/useColecao";
import { dataHoje, dataTexto, mensagemErro } from "../../portal/validacao";
import { baixarPublicacao } from "../../portal/downloads";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const route = useRoute(),
  router = useRouter(),
  { escolas, conteudos, publicacoes } = usePortal(),
  escolaId = ref(String(route.query.escola || "")),
  mes = ref(
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(route.query.mes || ""))
      ? String(route.query.mes)
      : dataHoje().slice(0, 7),
  ),
  buscaEscola = ref(""),
  etapa = ref(""),
  turno = ref(""),
  baixando = ref(false),
  erro = ref("");
const vistorias = useColecao(
    () =>
      escolaId.value
        ? collection(db, "escolasPublicas", escolaId.value, "vistorias")
        : null,
    escolaId,
  ),
  escolaPublica = computed(() =>
    escolas.dados.value.find(
      (e) => e.id === escolaId.value && e.ativo !== false,
    ),
  ),
  escolasFiltradas = computed(() =>
    escolas.dados.value
      .filter(
        (e) =>
          e.ativo !== false &&
          (!buscaEscola.value ||
            normalizar(e.nome).includes(normalizar(buscaEscola.value)) ||
            e.id === escolaId.value),
      )
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  ),
  aplicaveis = computed(() =>
    escolaPublica.value
      ? filtrarCardapios(conteudos.value, escolaId.value, mes.value)
      : [],
  ),
  etapas = computed(() => [
    ...new Set(
      aplicaveis.value
        .map((c) => c.etapa || c.gradeCardapio?.etapa || c.categoria)
        .filter(Boolean),
    ),
  ]),
  turnos = computed(() => [
    ...new Set(
      aplicaveis.value
        .map((c) => c.turno || c.gradeCardapio?.turno)
        .filter(Boolean),
    ),
  ]),
  cardapios = computed(() =>
    escolaPublica.value
      ? filtrarCardapios(
          conteudos.value,
          escolaId.value,
          mes.value,
          etapa.value,
          turno.value,
        )
      : [],
  ),
  ordenadas = computed(() =>
    [...vistorias.dados.value].sort(
      (a, b) => (b.data?.toMillis?.() || 0) - (a.data?.toMillis?.() || 0),
    ),
  ),
  tipos = {
    recebimento: "Recebimento",
    sanitaria: "Sanitária",
    estrutural: "Estrutural",
    rotina: "Rotina",
  },
  resultados = {
    conforme: "Conforme",
    conforme_com_ressalvas: "Conforme com ressalvas",
    nao_conforme: "Não conforme",
    nao_aplicavel: "Não se aplica",
  };
function normalizar(v) {
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
const pdfUrl = (c) =>
  `/api/cardapios?acao=pdf&id=${encodeURIComponent(c.id)}&arquivo=${encodeURIComponent(c.arquivoId)}&escola=${encodeURIComponent(escolaId.value)}`;
watch([escolaId, mes], () => {
  etapa.value = "";
  turno.value = "";
  router.replace({
    query: {
      ...(escolaId.value ? { escola: escolaId.value } : {}),
      mes: mes.value,
    },
  });
});
watch(
  () => escolas.dados.value,
  (lista) => {
    if (!escolaId.value && lista.length === 1) escolaId.value = lista[0].id;
  },
);
async function baixar(c) {
  baixando.value = true;
  erro.value = "";
  try {
    await baixarPublicacao(
      c,
      escolas.dados.value.find((e) => e.id === escolaId.value)?.nome,
    );
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    baixando.value = false;
  }
}
</script>

<style scoped>
.pdf-oficial {
  min-width: 0;
}
.pdf-oficial summary {
  cursor: pointer;
  padding: 0.7rem 0;
  font-weight: 700;
}
.pdf-oficial iframe {
  width: 100%;
  height: 65vh;
  min-height: 280px;
  border: 1px solid var(--p-border, #ccd9d6);
  border-radius: 0.7rem;
}
.p-card {
  min-width: 0;
  overflow-wrap: anywhere;
}
.p-actions {
  flex-wrap: wrap;
}
.p-actions a {
  min-height: 44px;
  white-space: normal;
}
@media (max-width: 600px) {
  .p-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
  .pdf-oficial iframe {
    height: 55vh;
  }
}
</style>
