<template>
  <section class="historico">
    <header>
      <h2>
        {{
          tipo === "movimentacoes"
            ? "Últimas movimentações"
            : "Últimas vistorias"
        }}
      </h2>
      <button
        v-if="tipo === 'movimentacoes'"
        class="botao"
        :disabled="!filtrados.length || exportando"
        @click="exportar()"
      >
        Exportar PDF
      </button>
    </header>
    <label v-if="registros.length" class="busca"
      >Buscar no histórico carregado<input
        v-model="busca"
        type="search"
        placeholder="Nome, item ou tipo"
    /></label>
    <p v-if="carregando" role="status">Carregando histórico...</p>
    <p v-if="erro || erroPdf" class="mensagem-erro" role="alert">
      {{ erro || erroPdf }}
    </p>
    <p v-if="!carregando && !erro && !registros.length">
      Nenhum registro para esta escola.
    </p>
    <p v-else-if="registros.length && !filtrados.length">
      Nenhum resultado para essa busca.
    </p>
    <div v-if="filtrados.length" class="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>{{ tipo === "movimentacoes" ? "Item / tipo" : "Vistoria" }}</th>
            <th>{{ tipo === "movimentacoes" ? "Quantidade" : "Resultado" }}</th>
            <th>Responsável</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in filtrados" :key="r.id">
            <tr>
              <td>{{ data(r.data) }}</td>
              <td>
                {{ r.itemNome ? r.itemNome + " · " : "" }}{{ rotulo(r.tipo) }}
              </td>
              <td>
                {{
                  tipo === "movimentacoes"
                    ? r.quantidade
                    : (r.notaGeral == null
                        ? "Não se aplica"
                        : r.notaGeral + "/10") +
                      " · " +
                      rotulo(r.status)
                }}
              </td>
              <td>
                {{
                  r.identificacaoResponsavel?.nome ||
                  r.responsavelNome ||
                  "Não informado"
                }}
              </td>
              <td class="acoes">
                <button
                  class="botao"
                  :aria-expanded="detalheId === r.id"
                  @click="detalheId = detalheId === r.id ? '' : r.id"
                >
                  {{ detalheId === r.id ? "Fechar" : "Detalhes" }}</button
                ><button
                  v-if="tipo === 'vistorias'"
                  class="botao"
                  :disabled="exportando"
                  @click="exportar(r)"
                >
                  PDF
                </button>
              </td>
            </tr>
            <tr v-if="detalheId === r.id">
              <td colspan="5" class="detalhes">
                <p v-if="r.identificacaoResponsavel">
                  <strong>Responsável:</strong>
                  {{ r.identificacaoResponsavel.nome }} · CPF
                  {{ r.identificacaoResponsavel.cpfMascarado }}
                </p>
                <p v-if="r.identificacaoTestemunha">
                  <strong>Testemunha:</strong>
                  {{ r.identificacaoTestemunha.nome }} · CPF
                  {{ r.identificacaoTestemunha.cpfMascarado }}
                </p>
                <p v-if="!r.metodoConfirmacao">
                  Registro anterior à identificação por nome e CPF.
                </p>
                <p v-if="r.planoDeAcao">
                  <strong>Plano de ação:</strong> {{ r.planoDeAcao }}
                </p>
                <p v-if="r.motivo"><strong>Motivo:</strong> {{ r.motivo }}</p>
                <p v-if="r.observacoes">
                  <strong>Observações:</strong> {{ r.observacoes }}
                </p>
                <p v-if="r.quantidadeAnterior != null">
                  <strong>Saldo:</strong> {{ r.quantidadeAnterior }} →
                  {{ r.quantidadeResultante }}
                </p>
                <ul v-if="r.checklist?.length">
                  <li v-for="(c, i) in r.checklist" :key="i">
                    {{ c.item }} — {{ rotulo(c.status)
                    }}<span v-if="c.observacao">: {{ c.observacao }}</span>
                  </li>
                </ul>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <p v-if="registros.length" class="limite">
      {{ filtrados.length }} de {{ registros.length }} registros carregados.
      {{
        tipo === "movimentacoes"
          ? "Até 200 movimentações recentes."
          : "Até 100 vistorias recentes."
      }}
    </p>
  </section>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useMovimentacoes } from "../../composables/useMovimentacoes";
import { useVistorias } from "../../composables/useVistorias";
const props = defineProps({
  escolaId: { type: String, required: true },
  escolaNome: { type: String, required: true },
  tipo: { type: String, required: true },
});
const api =
  props.tipo === "movimentacoes"
    ? useMovimentacoes(props.escolaId)
    : useVistorias(props.escolaId);
const registros = api.movimentacoes || api.vistorias;
const { carregando, erro } = api;
const erroPdf = ref(""),
  busca = ref(""),
  detalheId = ref(""),
  exportando = ref(false);
const normalizarBusca = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const filtrados = computed(() =>
  registros.value.filter((r) =>
    normalizarBusca(
      [
        r.itemNome,
        r.tipo,
        r.responsavelNome,
        r.identificacaoResponsavel?.nome,
        r.identificacaoTestemunha?.nome,
      ].join(" "),
    ).includes(normalizarBusca(busca.value)),
  ),
);
onMounted(() => api.escutar());
onUnmounted(api.parar);
function rotulo(valor) {
  return (
    {
      nao_conforme: "Não conforme",
      conforme_com_ressalvas: "Conforme com ressalvas",
      conforme: "Conforme",
      nao_aplicavel: "Não se aplica",
      sanitaria: "Sanitária",
      saida: "Saída",
    }[valor] || String(valor || "Não informado").replaceAll("_", " ")
  );
}
function data(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("pt-BR") : "—";
}
async function exportar(registro) {
  if (exportando.value) return;
  exportando.value = true;
  erroPdf.value = "";
  try {
    const { useRelatorios } = await import("../../composables/useRelatorios");
    const relatorios = useRelatorios();
    if (registro) relatorios.gerarRelatorioVistoria(registro, props.escolaNome);
    else
      relatorios.gerarRelatorioMovimentacoes(filtrados.value, props.escolaNome);
  } catch {
    erroPdf.value = "Não foi possível gerar o PDF. Tente novamente.";
  } finally {
    exportando.value = false;
  }
}
</script>
<style scoped>
.historico {
  margin-top: 30px;
  border-top: 1px solid #dfe9e6;
  padding-top: 24px;
}
header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}
h2 {
  font-size: 1.25rem;
}
.busca {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 15px;
  font-size: 0.8125rem;
}
.busca input {
  padding: 10px;
  border: 1px solid #dfe9e6;
  border-radius: 8px;
  font: inherit;
}
.tabela-wrap {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid #dfe9e6;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  font-size: 0.8125rem;
  text-align: left;
}
th,
td {
  padding: 14px;
  border-bottom: 1px solid #edf2f0;
  min-width: 110px;
}
th,
.detalhes {
  background: #edf5f1;
}
.detalhes {
  white-space: normal;
  overflow-wrap: anywhere;
}
.detalhes li {
  margin: 6px 0;
}
.acoes {
  display: flex;
  gap: 8px;
}
.limite {
  font-size: 0.75rem;
  margin-top: 10px;
  color: #526b65;
}
</style>
