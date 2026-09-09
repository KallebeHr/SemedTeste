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
        >Escola<select aria-label="Escola" v-model="escolaId">
          <option value="">Selecione uma escola</option>
          <option v-for="e in escolas.dados.value" :key="e.id" :value="e.id">
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
    <template v-if="escolaId"
      ><section class="p-section">
        <div class="p-section-head">
          <div>
            <p class="p-eyebrow">O QUE TEM NO PRATO</p>
            <h2>Cardápio mensal</h2>
          </div>
        </div>
        <EstadoConsulta :consulta="publicacoes" />
        <div v-for="c in cardapios" :key="c.id" class="p-card p-stack">
          <h3>{{ c.titulo }}</h3>
          <p>{{ c.resumo }}</p>
          <p class="p-prose">{{ c.texto }}</p>
          <p v-if="c.local" class="p-small">
            Responsável técnico: {{ c.local }}
          </p>
          <div class="p-actions">
            <button
              class="p-button primary"
              :disabled="baixando"
              @click="baixar(c)"
            >
              Baixar cardápio em PDF</button
            ><router-link class="p-button" :to="'/publicacao/' + c.id"
              >Abrir publicação</router-link
            >
          </div>
        </div>
        <p
          v-if="!cardapios.length && !publicacoes.carregando.value"
          class="p-empty"
        >
          Ainda não há cardápio publicado para esta escola neste mês. Você pode
          consultar outros meses no filtro acima.
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
  mes = ref(dataHoje().slice(0, 7)),
  baixando = ref(false),
  erro = ref("");
const vistorias = useColecao(
    () =>
      escolaId.value
        ? collection(db, "escolasPublicas", escolaId.value, "vistorias")
        : null,
    escolaId,
  ),
  cardapios = computed(() =>
    conteudos.value.filter(
      (c) =>
        c.tipo === "cardapio" &&
        c.escolaId === escolaId.value &&
        c.numero === mes.value,
    ),
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
watch(escolaId, (id) => router.replace({ query: id ? { escola: id } : {} }));
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
