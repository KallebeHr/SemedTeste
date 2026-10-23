<template>
<<<<<<< HEAD
  <section class="ei-admin" aria-labelledby="ei-titulo" :aria-busy="ocupado">
    <header class="ei-header">
      <div>
        <h1 id="ei-titulo">Editais e inscrições</h1>
        <p class="ei-muted">
          Conferência e acompanhamento do Administrador Master.
        </p>
      </div>
      <button
        type="button"
        class="ei-btn"
        :disabled="ocupado"
        @click="atualizar"
      >
        {{ ocupado ? "Aguarde…" : "Atualizar dados" }}
      </button>
    </header>

    <div class="ei-feedback" aria-live="polite" role="status">
      <span v-if="ocupado">{{ atividade }}</span>
      <span v-else-if="aviso">{{ aviso }}</span>
      <span v-else-if="atualizadoEm" class="ei-muted"
        >Última consulta: {{ dataHora(atualizadoEm) }}</span
      >
    </div>
    <p v-if="erro && !selecionada" class="ei-alert" role="alert">{{ erro }}</p>

    <div class="ei-stats" aria-label="Resumo de todos os editais">
      <div class="ei-stat">
        <span>Editais configurados</span
        ><strong>{{ numero(globais.editais) }}</strong>
      </div>
      <div class="ei-stat">
        <span>Inscrições recebidas</span
        ><strong>{{ numero(globais.recebidas) }}</strong>
      </div>
      <div class="ei-stat">
        <span>Aguardando conferência</span
        ><strong>{{ numero(pendentes(globais)) }}</strong>
      </div>
      <div class="ei-stat">
        <span>Confirmadas</span
        ><strong>{{ numero(globais.confirmadas) }}</strong>
      </div>
    </div>

    <section class="ei-panel" aria-labelledby="ei-selecao">
      <h2 id="ei-selecao">Consultar inscrições</h2>
      <div class="ei-selector">
        <label class="ei-field"
          >Selecione o edital
          <select v-model="editalId" :disabled="ocupado" @change="trocarEdital">
            <option value="">Selecione um edital</option>
            <option v-for="e in editais" :key="e.id" :value="e.id">
              {{ e.nome || e.id }}
            </option>
          </select>
        </label>
        <button
          v-if="cursorEditais"
          type="button"
          class="ei-btn"
          :disabled="ocupado"
          @click="catalogo"
        >
          Carregar mais editais
        </button>
      </div>
      <form v-if="editalId" class="ei-filters" @submit.prevent="buscar">
        <label class="ei-field"
          >Pesquisar por
          <select v-model="campoBusca" :disabled="ocupado">
            <option value="dados.responsavel">Responsável</option>
            <option value="dados.escola">Escola</option>
            <option value="dados.titulo">Título da prática</option>
            <option value="protocolo">Protocolo completo</option>
          </select>
        </label>
        <label class="ei-field ei-search"
          >Texto da busca
          <input
            v-model="busca"
            type="search"
            maxlength="96"
            :disabled="ocupado"
            :placeholder="
              campoBusca === 'protocolo'
                ? 'Cole o protocolo completo'
                : 'Digite o início do texto'
            "
            aria-describedby="ei-ajuda-busca"
          />
        </label>
        <label class="ei-field"
          >Situação
          <select v-model="status" :disabled="ocupado">
            <option value="">Todas</option>
            <option value="recebida">Aguardando conferência</option>
            <option value="confirmada">Confirmada</option>
          </select>
        </label>
        <div class="ei-actions">
          <button type="submit" class="ei-btn ei-primary" :disabled="ocupado">
            Buscar
          </button>
          <button
            type="button"
            class="ei-btn"
            :disabled="ocupado"
            @click="limpar"
          >
            Limpar
          </button>
        </div>
        <p id="ei-ajuda-busca" class="ei-help">
          A busca por nome, escola ou título considera o início do texto,
          maiúsculas e acentos. Protocolo exige o código completo. Clique em
          Buscar para aplicar.
        </p>
      </form>
    </section>

    <section
      v-if="editalId"
      class="ei-panel ei-results"
      aria-labelledby="ei-resultados"
    >
      <header class="ei-result-header">
        <div>
          <h2 id="ei-resultados" ref="tituloResultados" tabindex="-1">
            Inscrições do edital
          </h2>
          <p class="ei-muted">{{ nomeEdital }}</p>
        </div>
        <button
          type="button"
          class="ei-btn"
          :disabled="ocupado || !linhas.length"
          @click="exportar"
        >
          Exportar esta página (CSV)
        </button>
      </header>
      <div v-if="carregou" class="ei-summary">
        <span>{{ numero(totais.recebidas) }} recebidas</span>
        <span>{{ numero(pendentes(totais)) }} aguardando</span>
        <span>{{ numero(totais.confirmadas) }} confirmadas</span>
      </div>
      <p v-if="carregou" class="ei-help">
        {{ resumoFiltro }} · {{ linhas.length }} nesta página. Os totais acima
        abrangem todo o edital.
      </p>
      <div
        v-if="linhas.length"
        class="ei-table-wrap"
        role="region"
        aria-label="Lista de inscrições"
        tabindex="0"
      >
        <table class="ei-table">
          <caption class="ei-sr">
            Inscrições da página
            {{
              historico.length + 1
            }}. Abra a ficha para consultar todos os dados.
          </caption>
          <thead>
            <tr>
              <th scope="col">Protocolo</th>
              <th scope="col">Responsável / escola</th>
              <th scope="col">Prática / categoria</th>
              <th scope="col">Recebimento</th>
              <th scope="col">Situação</th>
              <th scope="col">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in linhas" :key="r.id">
              <td data-label="Protocolo">
                <span class="ei-code" :title="r.protocolo">{{
                  protocoloCurto(r.protocolo)
                }}</span
                ><span class="ei-sr">Protocolo completo na ficha.</span>
              </td>
              <td data-label="Responsável / escola">
                <strong>{{ r.dados?.responsavel || "Não informado" }}</strong
                ><span class="ei-cell-secondary">{{
                  r.dados?.escola || "Escola não informada"
                }}</span>
              </td>
              <td data-label="Prática / categoria">
                <span>{{ r.dados?.titulo || "Não informado" }}</span
                ><span class="ei-cell-secondary">{{
                  r.dados?.categoria || "Categoria não informada"
                }}</span>
              </td>
              <td data-label="Recebimento">{{ dataHora(r.criadoEm) }}</td>
              <td data-label="Situação">
                <span
                  class="ei-badge"
                  :class="{ 'ei-confirmed': r.status === 'confirmada' }"
                  >{{ situacao(r.status) }}</span
                >
              </td>
              <td data-label="Ação">
                <button
                  type="button"
                  class="ei-btn ei-open"
                  :disabled="ocupado"
                  :aria-label="`Abrir ficha de ${r.dados?.responsavel || 'participante'}`"
                  aria-haspopup="dialog"
                  @click="abrir(r.id, $event)"
                >
                  Abrir ficha
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="!ocupado" class="ei-empty">
        <strong>{{
          carregou
            ? "Nenhuma inscrição encontrada"
            : "Não foi possível carregar a lista"
        }}</strong>
        <p>
          {{
            carregou
              ? "Confira o edital selecionado ou limpe os filtros para tentar novamente."
              : "Use Atualizar dados para tentar novamente."
          }}
        </p>
      </div>
      <nav
        v-if="carregou && linhas.length"
        class="ei-pagination"
        aria-label="Páginas de inscrições"
      >
        <span
          >Página {{ historico.length + 1 }} · até 25 inscrições por
          página</span
        >
        <div class="ei-actions">
          <button
            type="button"
            class="ei-btn"
            :disabled="ocupado || !historico.length"
            @click="anterior"
          >
            Anterior
          </button>
          <button
            type="button"
            class="ei-btn"
            :disabled="ocupado || !proximo"
            @click="seguinte"
          >
            Próxima
          </button>
        </div>
      </nav>
      <p v-if="linhas.length" class="ei-help">
        O CSV inclui somente esta página e os filtros aplicados, com os
        protocolos completos.
      </p>
    </section>
    <div v-else class="ei-empty">
      <strong>Escolha um edital para começar</strong>
      <p>Consulte participantes, confira fichas e confirme as inscrições.</p>
    </div>

    <Teleport to="body">
      <dialog
        ref="dialogo"
        class="ei-modal"
        aria-labelledby="ei-ficha-titulo"
        @cancel.prevent="fechar"
        @close="aoFechar"
      >
        <div v-if="selecionada" class="ei-modal-layout">
          <header class="ei-modal-header">
            <div>
              <h2 id="ei-ficha-titulo" ref="tituloFicha" tabindex="-1">
                Ficha de inscrição
              </h2>
              <p class="ei-muted">
                {{ selecionada.config?.nome || nomeEdital }}
              </p>
            </div>
            <button
              type="button"
              class="ei-btn"
              aria-label="Fechar ficha"
              @click="fechar"
            >
              Fechar ×
            </button>
          </header>
          <div class="ei-modal-body">
            <p v-if="erro" class="ei-alert" role="alert">{{ erro }}</p>
            <p v-if="ocupado || aviso" class="ei-help" role="status">
              {{ ocupado ? atividade : aviso }}
            </p>
            <div class="ei-record-bar">
              <div>
                <span class="ei-label">Protocolo completo</span>
                <p class="ei-code ei-full-code">{{ selecionada.protocolo }}</p>
              </div>
              <button type="button" class="ei-btn" @click="copiarProtocolo">
                Copiar protocolo
              </button>
            </div>
            <div class="ei-summary">
              <span
                class="ei-badge"
                :class="{ 'ei-confirmed': selecionada.status === 'confirmada' }"
                >{{ situacao(selecionada.status) }}</span
              ><span>Recebida em {{ dataHora(selecionada.criadoEm) }}</span>
            </div>
            <dl class="ei-details">
              <div
                v-for="f in campos(selecionada.config || {})"
                :key="f.id"
                class="ei-detail"
                :class="{
                  'ei-wide':
                    f.id === 'sintese' ||
                    String(selecionada.dados?.[f.id] ?? '').length > 180,
                }"
              >
                <dt>{{ f.label }}</dt>
                <dd>{{ valor(selecionada.dados?.[f.id]) }}</dd>
              </div>
            </dl>
            <section class="ei-declaration" aria-labelledby="ei-declaracao">
              <h3 id="ei-declaracao">Declaração e aceite</h3>
              <p>{{ selecionada.declaracao || "Declaração não informada." }}</p>
              <p class="ei-help">
                Aceite registrado em {{ dataHora(selecionada.aceiteEm) }}. Não
                substitui assinatura ou ciência formal.
              </p>
            </section>
            <p v-if="selecionada.confirmadoEm" class="ei-help">
              Confirmada em {{ dataHora(selecionada.confirmadoEm)
              }}<template v-if="selecionada.confirmadoPor">
                por {{ selecionada.confirmadoPor }}</template
              >.
            </p>
            <section
              v-if="pedindoConfirmacao && selecionada.status === 'recebida'"
              ref="caixaConfirmacao"
              class="ei-confirm-box"
              tabindex="-1"
              aria-labelledby="ei-conferir"
            >
              <h3 id="ei-conferir">Concluiu a conferência?</h3>
              <p>
                A confirmação será registrada na auditoria com sua
                identificação. Os dados enviados pelo participante serão
                preservados.
              </p>
              <div class="ei-actions">
                <button
                  type="button"
                  class="ei-btn ei-primary"
                  :disabled="ocupado"
                  @click="confirmar"
                >
                  Sim, confirmar inscrição</button
                ><button
                  type="button"
                  class="ei-btn"
                  :disabled="ocupado"
                  @click="pedindoConfirmacao = false"
                >
                  Continuar conferindo
                </button>
              </div>
            </section>
          </div>
          <footer class="ei-modal-footer">
            <button
              type="button"
              class="ei-btn"
              :disabled="ocupado"
              @click="pdf"
            >
              Baixar ficha em PDF
            </button>
            <button
              v-if="selecionada.status === 'recebida' && !pedindoConfirmacao"
              type="button"
              class="ei-btn ei-primary"
              :disabled="ocupado"
              @click="pedirConfirmacao"
            >
              Confirmar inscrição
            </button>
            <button type="button" class="ei-btn" @click="fechar">
              Fechar ficha
            </button>
          </footer>
        </div>
      </dialog>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { editaisApi } from "../../services/editaisApi";
import { campos } from "../../../shared/editais.mjs";

const editalId = ref(""),
  editais = ref([]),
  cursorEditais = ref(null);
const globais = ref({}),
  totais = ref({}),
  erro = ref(""),
  aviso = ref("");
const ocupado = ref(false),
  atividade = ref(""),
  atualizadoEm = ref(null);
const busca = ref(""),
  campoBusca = ref("dados.responsavel"),
  status = ref("");
const linhas = ref([]),
  selecionada = ref(null),
  cursor = ref(null),
  proximo = ref(null);
const historico = ref([]),
  carregou = ref(false),
  aplicados = ref({});
const dialogo = ref(null),
  tituloFicha = ref(null),
  tituloResultados = ref(null);
const pedindoConfirmacao = ref(false),
  caixaConfirmacao = ref(null);
let acionador = null,
  desmontado = false;
const nomeEdital = computed(
  () =>
    editais.value.find((e) => e.id === editalId.value)?.nome ||
    "Edital selecionado",
);
const resumoFiltro = computed(() =>
  [
    aplicados.value.status
      ? situacao(aplicados.value.status)
      : "Todas as situações",
    aplicados.value.busca
      ? `Busca: “${aplicados.value.busca}”`
      : "Sem busca por texto",
  ].join(" · "),
);
const api = (acao, extra = {}) =>
  editaisApi({ acao, editalId: editalId.value || "catalogo", ...extra }, true);
const numero = (v) => Number(v || 0).toLocaleString("pt-BR");
const pendentes = (t) =>
  Math.max(0, Number(t.recebidas || 0) - Number(t.confirmadas || 0));
const situacao = (s) =>
  s === "confirmada"
    ? "Confirmada"
    : s === "recebida"
      ? "Aguardando conferência"
      : s || "Não informada";
const valor = (v) =>
  v === null || v === undefined || v === "" ? "Não informado" : String(v);
function protocoloCurto(p) {
  return p?.length > 26 ? `${p.slice(0, 13)}…${p.slice(-8)}` : p || "—";
}
function dataHora(v) {
  if (v === null || v === undefined || v === "") return "Não informado";
  const d =
    typeof v?.toDate === "function"
      ? v.toDate()
      : v && typeof v === "object" && "seconds" in v
        ? new Date(v.seconds * 1000)
        : new Date(v);
  return Number.isNaN(d.getTime())
    ? "Data indisponível"
    : d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      });
}
async function executar(texto, fn) {
  if (ocupado.value || desmontado) return;
  erro.value = "";
  aviso.value = "";
  ocupado.value = true;
  atividade.value = texto;
  try {
    await fn();
  } catch (e) {
    erro.value = e?.message || "Não foi possível concluir. Tente novamente.";
  } finally {
    ocupado.value = false;
    atividade.value = "";
  }
}
function integrarCatalogo(r) {
  editais.value = [
    ...new Map([...editais.value, ...r.editais].map((e) => [e.id, e])).values(),
  ];
  globais.value = r.totais;
}
async function catalogo() {
  await executar("Carregando editais…", async () => {
    const r = await api("catalogo", { cursor: cursorEditais.value });
    integrarCatalogo(r);
    cursorEditais.value = r.cursor;
    atualizadoEm.value = Date.now();
  });
}
function receberLista(r) {
  linhas.value = r.linhas;
  proximo.value = r.cursor;
  totais.value = r.totais;
  carregou.value = true;
  atualizadoEm.value = Date.now();
}
async function carregarPagina(
  novoCursor,
  novoHistorico,
  filtros = aplicados.value,
) {
  const r = await api("listar", { ...filtros, cursor: novoCursor });
  receberLista(r);
  cursor.value = novoCursor;
  historico.value = novoHistorico;
  aplicados.value = { ...filtros };
}
async function buscar() {
  await executar("Consultando inscrições…", () =>
    carregarPagina(null, [], {
      busca: busca.value.trim(),
      campoBusca: campoBusca.value,
      status: status.value,
    }),
  );
}
async function trocarEdital() {
  linhas.value = [];
  totais.value = {};
  cursor.value = null;
  proximo.value = null;
  historico.value = [];
  carregou.value = false;
  busca.value = "";
  status.value = "";
  campoBusca.value = "dados.responsavel";
  aplicados.value = {};
  erro.value = "";
  if (editalId.value) await buscar();
}
async function limpar() {
  busca.value = "";
  status.value = "";
  campoBusca.value = "dados.responsavel";
  await buscar();
}
async function seguinte() {
  if (!proximo.value) return;
  await executar("Carregando próxima página…", () =>
    carregarPagina(proximo.value, [...historico.value, cursor.value]),
  );
}
async function anterior() {
  if (!historico.value.length) return;
  await executar("Carregando página anterior…", () =>
    carregarPagina(historico.value.at(-1), historico.value.slice(0, -1)),
  );
}
async function atualizar() {
  await executar("Atualizando dados…", async () => {
    // Cada consulta é aplicada independentemente: uma falha não apaga a lista.
    const tarefas = [api("catalogo")];
    if (editalId.value)
      tarefas.push(api("listar", { ...aplicados.value, cursor: cursor.value }));
    const resultados = await Promise.allSettled(tarefas);
    if (resultados[0].status === "fulfilled") {
      integrarCatalogo(resultados[0].value);
      if (!cursorEditais.value && editais.value.length <= 50)
        cursorEditais.value = resultados[0].value.cursor;
    }
    if (resultados[1]?.status === "fulfilled")
      receberLista(resultados[1].value);
    const falha = resultados.find((r) => r.status === "rejected");
    if (falha) throw falha.reason;
    atualizadoEm.value = Date.now();
    aviso.value = "Dados atualizados.";
  });
}
async function abrir(id, evento) {
  acionador = evento?.currentTarget;
  await executar("Abrindo ficha…", async () => {
    const ficha = await api("detalhe", { id });
    if (desmontado) return;
    selecionada.value = ficha;
    pedindoConfirmacao.value = false;
    await nextTick();
    dialogo.value?.showModal();
    tituloFicha.value?.focus();
  });
}
function fechar() {
  dialogo.value?.close();
}
function aoFechar() {
  selecionada.value = null;
  pedindoConfirmacao.value = false;
  nextTick(() => {
    if (desmontado) return;
    if (acionador?.isConnected && !acionador.disabled) acionador.focus();
    else tituloResultados.value?.focus();
  });
}
async function pedirConfirmacao() {
  pedindoConfirmacao.value = true;
  await nextTick();
  caixaConfirmacao.value?.focus();
}
async function confirmar() {
  const ficha = selecionada.value;
  if (!ficha || ficha.status !== "recebida" || !pedindoConfirmacao.value)
    return;
  await executar("Confirmando inscrição…", async () => {
    await api("confirmar", { id: ficha.id });
    // A gravação já ocorreu. Uma falha na consulta seguinte não pode parecer falha na confirmação.
    if (selecionada.value?.id === ficha.id)
      selecionada.value = { ...ficha, status: "confirmada" };
    const linha = linhas.value.find((r) => r.id === ficha.id);
    if (linha) linha.status = "confirmada";
    totais.value = {
      ...totais.value,
      confirmadas: Number(totais.value.confirmadas || 0) + 1,
    };
    globais.value = {
      ...globais.value,
      confirmadas: Number(globais.value.confirmadas || 0) + 1,
    };
    pedindoConfirmacao.value = false;
    const resultados = await Promise.allSettled([
      api("detalhe", { id: ficha.id }),
      api("listar", { ...aplicados.value, cursor: cursor.value }),
      api("catalogo"),
    ]);
    if (
      resultados[0].status === "fulfilled" &&
      selecionada.value?.id === ficha.id
    )
      selecionada.value = resultados[0].value;
    if (resultados[1].status === "fulfilled") receberLista(resultados[1].value);
    if (resultados[2].status === "fulfilled")
      integrarCatalogo(resultados[2].value);
    aviso.value = "Inscrição confirmada e registrada na auditoria.";
    if (resultados.some((r) => r.status === "rejected"))
      erro.value =
        "A inscrição foi confirmada, mas parte da consulta não pôde ser atualizada. Feche a ficha e use Atualizar dados.";
  });
}
async function pdf() {
  const ficha = selecionada.value;
  if (!ficha) return;
  await executar("Preparando PDF…", async () => {
    const { baixarFicha } =
      await import("../../components/editais/fichaPdf.mjs");
    await baixarFicha(ficha);
    aviso.value =
      "PDF gerado. Confira os downloads do navegador; você pode abrir o arquivo para imprimir.";
  });
}
async function copiarProtocolo() {
  const texto = selecionada.value?.protocolo;
  if (!texto) return;
  try {
    if (!navigator.clipboard?.writeText) throw Error("indisponivel");
    await navigator.clipboard.writeText(texto);
    aviso.value = "Protocolo copiado.";
  } catch {
    aviso.value =
      "Não foi possível copiar automaticamente. Selecione o protocolo completo acima e copie manualmente.";
  }
}
function celulaCsv(v) {
  let texto = String(v ?? "");
  if (/^\s*[=+@-]/u.test(texto) || /^[\t\r\n]/u.test(texto))
    texto = "'" + texto;
  return '"' + texto.replaceAll('"', '""') + '"';
}
function exportar() {
  if (!linhas.value.length || ocupado.value) return;
  const tabela = [
    [
      "Protocolo",
      "Responsável",
      "Escola",
      "Prática",
      "Categoria",
      "Recebimento (Brasília)",
      "Situação",
    ],
    ...linhas.value.map((r) => [
      r.protocolo,
      r.dados?.responsavel,
      r.dados?.escola,
      r.dados?.titulo,
      r.dados?.categoria,
      dataHora(r.criadoEm),
      situacao(r.status),
    ]),
  ];
  const blob = new Blob(
    ["\uFEFF" + tabela.map((l) => l.map(celulaCsv).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `inscricoes-${editalId.value.replace(/[^a-zA-Z0-9_-]/g, "_")}-pagina-${historico.value.length + 1}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  aviso.value = `CSV gerado com ${linhas.value.length} inscrições desta página.`;
}
onMounted(catalogo);
onBeforeUnmount(() => {
  desmontado = true;
  dialogo.value?.close();
});
</script>

<style scoped>
.ei-admin,
.ei-modal {
  color: var(--p-ink, #173c40);
  font-size: 0.9rem;
  line-height: 1.5;
}
.ei-admin {
  width: 100%;
  min-width: 0;
  display: grid;
  gap: 1rem;
}
.ei-admin *,
.ei-modal * {
  box-sizing: border-box;
}
.ei-admin h1 {
  margin: 0;
  font-size: clamp(1.3rem, 2.4vw, 1.75rem);
  letter-spacing: -0.025em;
}
.ei-admin h2,
.ei-modal h2 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.35;
  letter-spacing: -0.015em;
}
.ei-modal h3 {
  margin: 0;
  font-size: 0.95rem;
}
.ei-admin p,
.ei-modal p {
  margin: 0;
}
.ei-header,
.ei-result-header,
.ei-selector,
.ei-pagination,
.ei-modal-header,
.ei-modal-footer,
.ei-record-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}
.ei-header > div,
.ei-result-header > div,
.ei-modal-header > div,
.ei-record-bar > div {
  min-width: 0;
}
.ei-muted,
.ei-help,
.ei-label,
.ei-cell-secondary {
  color: var(--p-muted, #536b70);
}
.ei-header .ei-muted,
.ei-result-header .ei-muted {
  margin-top: 0.25rem;
}
.ei-help {
  font-size: 0.8rem;
  line-height: 1.5;
}
.ei-feedback {
  font-size: 0.8rem;
  min-height: 1.2em;
}
.ei-alert {
  border: 1px solid var(--p-error, #a9261b);
  border-radius: 0.5rem;
  padding: 0.7rem 0.85rem;
  color: var(--p-error, #a9261b);
  background: var(--p-surface, #fff);
  overflow-wrap: anywhere;
}
.ei-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}
.ei-stat {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.3rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.65rem;
  background: var(--p-surface, #fff);
}
.ei-stat span {
  color: var(--p-muted, #536b70);
  font-size: 0.8rem;
}
.ei-stat strong {
  font-size: 1.5rem;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.ei-panel {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.7rem;
  background: var(--p-surface, #fff);
  display: grid;
  gap: 0.85rem;
}
.ei-field {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
  font-size: 0.8rem;
  font-weight: 600;
}
.ei-selector {
  align-items: end;
  flex-wrap: wrap;
}
.ei-selector .ei-field {
  flex: 1 1 18rem;
}
.ei-field input,
.ei-field select {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.45rem;
  padding: 0.55rem 0.65rem;
  color: var(--p-ink, #173c40);
  background: var(--p-surface, #fff);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 400;
}
.ei-field input::placeholder {
  color: var(--p-muted, #536b70);
  opacity: 1;
}
.ei-filters {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) minmax(10rem, 1.5fr) minmax(
      9rem,
      1fr
    );
  align-items: end;
  gap: 0.75rem;
}
.ei-filters > .ei-actions,
.ei-filters > .ei-help {
  grid-column: 1 / -1;
}
.ei-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ei-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 44px;
  max-width: 100%;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.45rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  color: var(--p-ink, #173c40);
  background: var(--p-surface, #fff);
  cursor: pointer;
  overflow-wrap: anywhere;
}
.ei-btn:hover:not(:disabled) {
  background: var(--p-soft, #e7f3ef);
}
.ei-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ei-primary {
  color: var(--p-surface, #fff);
  background: var(--p-teal, #007a72);
  border-color: var(--p-teal, #007a72);
}
.ei-primary:hover:not(:disabled) {
  background: var(--p-teal, #007a72);
  filter: brightness(0.92);
}
.ei-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem 1rem;
  font-size: 0.8rem;
}
.ei-summary > span:not(.ei-badge) {
  overflow-wrap: anywhere;
}
.ei-table-wrap {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.5rem;
}
.ei-table {
  width: 100%;
  min-width: 660px;
  table-layout: fixed;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.82rem;
}
.ei-table th,
.ei-table td {
  padding: 0.7rem 0.6rem;
  border-bottom: 1px solid var(--p-border, #d5e3e2);
  vertical-align: top;
  overflow-wrap: anywhere;
}
.ei-table th {
  background: var(--p-soft, #e7f3ef);
  font-size: 0.75rem;
  font-weight: 700;
}
.ei-table th:nth-child(1) {
  width: 17%;
}
.ei-table th:nth-child(2),
.ei-table th:nth-child(3) {
  width: 22%;
}
.ei-table th:nth-child(4) {
  width: 13%;
}
.ei-table th:nth-child(5) {
  width: 14%;
}
.ei-table th:nth-child(6) {
  width: 12%;
}
.ei-table tbody tr:last-child td {
  border-bottom: 0;
}
.ei-table tbody tr:hover {
  background: var(--p-soft, #e7f3ef);
}
.ei-cell-secondary {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.78rem;
}
.ei-code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.ei-badge {
  display: inline-block;
  max-width: 100%;
  border: 1px solid currentColor;
  border-radius: 0.4rem;
  padding: 0.18rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--p-muted, #536b70);
  background: var(--p-surface, #fff);
}
.ei-confirmed {
  color: var(--p-teal, #007a72);
  background: var(--p-soft, #e7f3ef);
}
.ei-empty {
  display: grid;
  gap: 0.4rem;
  padding: 1.4rem 1rem;
  text-align: center;
  border: 1px dashed var(--p-border, #d5e3e2);
  border-radius: 0.6rem;
  color: var(--p-muted, #536b70);
  font-size: 0.85rem;
}
.ei-pagination {
  flex-wrap: wrap;
  padding-top: 0.3rem;
  font-size: 0.8rem;
}
.ei-modal {
  width: min(860px, calc(100% - 2rem));
  max-width: calc(100% - 2rem);
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: 0;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.85rem;
  background: var(--p-surface, #fff);
  box-shadow: 0 1.5rem 5rem #102c3c40;
  overflow: hidden;
}
.ei-modal::backdrop {
  background: #102c3c99;
}
.ei-modal-layout {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 2rem);
}
.ei-modal-header,
.ei-modal-footer {
  flex-shrink: 0;
  flex-wrap: wrap;
  padding: 0.85rem 1rem;
  background: var(--p-surface, #fff);
}
.ei-modal-header {
  border-bottom: 1px solid var(--p-border, #d5e3e2);
  align-items: start;
}
.ei-modal-header > div {
  flex: 1 1 10rem;
}
.ei-modal-header .ei-muted {
  margin-top: 0.25rem;
  font-size: 0.8rem;
}
.ei-modal-footer {
  border-top: 1px solid var(--p-border, #d5e3e2);
  justify-content: flex-end;
}
.ei-modal-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1rem;
  display: grid;
  gap: 1rem;
}
.ei-record-bar {
  flex-wrap: wrap;
  padding: 0.7rem;
  border-radius: 0.5rem;
  background: var(--p-soft, #e7f3ef);
}
.ei-record-bar > div {
  flex: 1 1 16rem;
}
.ei-label {
  font-size: 0.75rem;
  font-weight: 600;
}
.ei-full-code {
  user-select: all;
  margin-top: 0.25rem !important;
}
.ei-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem 1.1rem;
  margin: 0;
}
.ei-detail {
  min-width: 0;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--p-border, #d5e3e2);
}
.ei-detail dt {
  margin-bottom: 0.3rem;
  color: var(--p-muted, #536b70);
  font-size: 0.78rem;
  font-weight: 600;
}
.ei-detail dd {
  margin: 0;
  font-size: 0.875rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ei-wide {
  grid-column: 1 / -1;
}
.ei-declaration,
.ei-confirm-box {
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem;
  border: 1px solid var(--p-border, #d5e3e2);
  border-radius: 0.55rem;
}
.ei-declaration > p:not(.ei-help) {
  font-size: 0.85rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ei-confirm-box {
  border-color: var(--p-teal, #007a72);
  background: var(--p-soft, #e7f3ef);
  font-size: 0.85rem;
}
.ei-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
@media (min-width: 1200px) {
  .ei-filters {
    grid-template-columns: minmax(8rem, 1fr) minmax(10rem, 1.5fr) minmax(
        9rem,
        1fr
      ) auto;
  }
  .ei-filters > .ei-actions {
    grid-column: auto;
  }
}
@media (max-width: 760px) {
  .ei-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ei-header,
  .ei-result-header {
    align-items: start;
    flex-wrap: wrap;
  }
  .ei-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ei-search {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .ei-panel {
    padding: 0.8rem;
  }
  .ei-table-wrap {
    border: 0;
    overflow: visible;
  }
  .ei-table,
  .ei-table tbody {
    display: block;
    min-width: 0;
    width: 100%;
  }
  .ei-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
  .ei-table tr {
    display: block;
    margin-bottom: 0.75rem;
    border: 1px solid var(--p-border, #d5e3e2);
    border-radius: 0.6rem;
    padding: 0.65rem;
  }
  .ei-table tr:last-child {
    margin-bottom: 0;
  }
  .ei-table td {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr);
    gap: 0.2rem 0.6rem;
    border: 0;
    padding: 0.4rem 0;
    width: auto;
  }
  .ei-table td::before {
    content: attr(data-label);
    grid-column: 1;
    grid-row: 1 / span 2;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--p-muted, #536b70);
  }
  .ei-table td > * {
    grid-column: 2;
    min-width: 0;
  }
  .ei-table td .ei-cell-secondary {
    margin-top: 0;
  }
  .ei-table td .ei-btn {
    justify-self: start;
  }
  .ei-table td .ei-badge {
    justify-self: start;
  }
  .ei-details {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 440px) {
  .ei-stat {
    padding: 0.65rem;
  }
  .ei-stat strong {
    font-size: 1.3rem;
  }
  .ei-stat span {
    font-size: 0.75rem;
  }
  .ei-header > .ei-btn,
  .ei-result-header > .ei-btn {
    width: 100%;
  }
  .ei-pagination {
    flex-direction: column;
    align-items: stretch;
  }
  .ei-actions .ei-btn,
  .ei-pagination .ei-btn {
    flex: 1;
  }
  .ei-modal,
  .ei-modal-layout {
    max-height: calc(100dvh - 1rem);
  }
  .ei-modal {
    width: calc(100% - 1rem);
    max-width: calc(100% - 1rem);
    border-radius: 0.6rem;
  }
  .ei-modal-header,
  .ei-modal-footer,
  .ei-modal-body {
    padding: 0.75rem;
  }
  .ei-modal-footer .ei-btn {
    flex: 1 1 100%;
  }
}
=======
  <section class="p-stack">
    <h1>Editais e Inscrições</h1>
    <p>Conferência exclusiva do Administrador Master.</p>
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="ocupado" role="status">Consultando servidor…</p>
    <div class="p-grid">
      <div class="p-card">
        Editais configurados: <strong>{{ globais.editais || 0 }}</strong>
      </div>
      <div class="p-card">
        Inscrições recebidas: <strong>{{ globais.recebidas || 0 }}</strong>
      </div>
      <div class="p-card">
        Aguardando conferência:
        <strong>{{
          (globais.recebidas || 0) - (globais.confirmadas || 0)
        }}</strong>
      </div>
      <div class="p-card">
        Confirmadas: <strong>{{ globais.confirmadas || 0 }}</strong>
      </div>
    </div>
    <label class="p-field"
      >Selecione o edital<select
        v-model="editalId"
        @change="reiniciar"
        :disabled="ocupado"
      >
        <option value="">Selecione</option>
        <option v-for="e in editais" :key="e.id" :value="e.id">
          {{ e.nome }}
        </option>
      </select></label
    ><button
      v-if="cursorEditais"
      class="p-button"
      :disabled="ocupado"
      @click="catalogo"
    >
      Carregar mais editais
    </button>
    <form v-if="editalId" @submit.prevent="reiniciar" class="p-actions">
      <label class="p-field"
        >Pesquisar por<select v-model="campoBusca">
          <option value="dados.responsavel">Responsável</option>
          <option value="dados.escola">Escola</option>
          <option value="dados.titulo">Título</option>
          <option value="protocolo">Protocolo completo</option>
        </select></label
      >
      <label class="p-field"
        >Texto da busca<input
          v-model="busca"
          maxlength="96"
          placeholder="Início do texto, respeitando maiúsculas" /></label
      ><label class="p-field"
        >Situação<select v-model="status">
          <option value="">Todas</option>
          <option value="recebida">Aguardando conferência</option>
          <option value="confirmada">Confirmada</option>
        </select></label
      ><button class="p-button" :disabled="ocupado">Buscar / atualizar</button>
    </form>
    <p v-if="editalId">
      Neste edital: {{ totais.recebidas || 0 }} recebidas ·
      {{ totais.confirmadas || 0 }} confirmadas
    </p>
    <div
      v-if="editalId"
      class="tabela"
      tabindex="0"
      role="region"
      aria-label="Inscrições do edital"
    >
      <table>
        <thead>
          <tr>
            <th>Protocolo</th>
            <th>Responsável</th>
            <th>Escola</th>
            <th>Prática</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Situação</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in linhas" :key="r.id">
            <td>{{ r.protocolo }}</td>
            <td>{{ r.dados.responsavel }}</td>
            <td>{{ r.dados.escola }}</td>
            <td>{{ r.dados.titulo }}</td>
            <td>{{ r.dados.categoria }}</td>
            <td>{{ dataHora(r.criadoEm) }}</td>
            <td>{{ r.status }}</td>
            <td>
              <button class="p-button" :disabled="ocupado" @click="abrir(r.id)">
                Ver ficha
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="editalId && !ocupado && !linhas.length">
      Nenhuma inscrição encontrada.
    </p>
    <div class="p-actions">
      <button
        v-if="historico.length"
        class="p-button"
        :disabled="ocupado"
        @click="anterior"
      >
        Página anterior</button
      ><button
        v-if="proximo"
        class="p-button"
        :disabled="ocupado"
        @click="seguinte"
      >
        Próxima página
      </button>
    </div>
    <section
      v-if="selecionada"
      class="p-card p-stack"
      aria-labelledby="titulo-ficha"
    >
      <h2 id="titulo-ficha" tabindex="-1" ref="tituloFicha">
        {{ selecionada.protocolo }}
      </h2>
      <p>{{ selecionada.config.nome }}</p>
      <dl>
        <template v-for="f in campos(selecionada.config)" :key="f.id"
          ><dt>
            <strong>{{ f.label }}</strong>
          </dt>
          <dd class="p-prose">
            {{ selecionada.dados[f.id] || "Não informado" }}
          </dd></template
        >
      </dl>
      <p class="p-prose">{{ selecionada.declaracao }}</p>
      <p>
        Aceite: {{ dataHora(selecionada.aceiteEm) }}. Não substitui assinatura
        ou ciência formal.
      </p>
      <p>Situação: {{ selecionada.status }}</p>
      <p v-if="selecionada.confirmadoEm">
        Confirmada em {{ dataHora(selecionada.confirmadoEm) }} por
        {{ selecionada.confirmadoPor }}
      </p>
      <div class="p-actions">
        <button class="p-button" @click="pdf">
          Imprimir ficha de inscrição / baixar PDF</button
        ><button
          v-if="selecionada.status === 'recebida'"
          class="p-button primary"
          :disabled="ocupado"
          @click="confirmar"
        >
          Confirmar inscrição</button
        ><button class="p-button" @click="selecionada = null">
          Fechar ficha
        </button>
      </div>
    </section>
  </section>
</template>
<script setup>
import { ref, onMounted, nextTick } from "vue";
import { editaisApi } from "../../services/editaisApi";
import { campos } from "../../../shared/editais.mjs";
const editalId = ref(""),
  editais = ref([]),
  cursorEditais = ref(null),
  globais = ref({}),
  totais = ref({}),
  erro = ref(""),
  ocupado = ref(false),
  busca = ref(""),
  campoBusca = ref("dados.responsavel"),
  status = ref(""),
  linhas = ref([]),
  selecionada = ref(null),
  cursor = ref(null),
  proximo = ref(null),
  historico = ref([]),
  tituloFicha = ref(null);
const api = (acao, extra = {}) =>
  editaisApi({ acao, editalId: editalId.value || "catalogo", ...extra }, true);
function dataHora(v) {
  return v
    ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";
}
async function executar(fn) {
  erro.value = "";
  ocupado.value = true;
  try {
    await fn();
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
async function catalogo() {
  await executar(async () => {
    const r = await api("catalogo", { cursor: cursorEditais.value });
    editais.value.push(...r.editais);
    cursorEditais.value = r.cursor;
    globais.value = r.totais;
  });
}
async function listar() {
  const r = await api("listar", {
    busca: busca.value.trim(),
    campoBusca: campoBusca.value,
    status: status.value,
    cursor: cursor.value,
  });
  linhas.value = r.linhas;
  proximo.value = r.cursor;
  totais.value = r.totais;
}
async function reiniciar() {
  cursor.value = null;
  historico.value = [];
  selecionada.value = null;
  if (editalId.value) await executar(listar);
}
async function seguinte() {
  historico.value.push(cursor.value);
  cursor.value = proximo.value;
  await executar(listar);
}
async function anterior() {
  cursor.value = historico.value.pop();
  await executar(listar);
}
async function abrir(id) {
  await executar(async () => {
    selecionada.value = await api("detalhe", { id });
    await nextTick();
    tituloFicha.value?.focus();
  });
}
async function confirmar() {
  if (
    !window.confirm(
      "Confirma que conferiu os dados da ficha? Esta ação será registrada na auditoria.",
    )
  )
    return;
  await executar(async () => {
    await api("confirmar", { id: selecionada.value.id });
    selecionada.value = await api("detalhe", { id: selecionada.value.id });
    await listar();
    const r = await api("catalogo");
    globais.value = r.totais;
  });
}
async function pdf() {
  await executar(async () => {
    const { baixarFicha } =
      await import("../../components/editais/fichaPdf.mjs");
    baixarFicha(selecionada.value);
  });
}
onMounted(catalogo);
</script>
<style scoped>
.tabela {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
td,
th {
  text-align: left;
  padding: 0.7rem;
  border-bottom: 1px solid var(--p-border);
  vertical-align: top;
}
td:first-child {
  min-width: 13rem;
  overflow-wrap: anywhere;
}
dd {
  margin: 0 0 1rem;
  overflow-wrap: anywhere;
}
>>>>>>> 7898e76e059a38dfdb68c32fc0108a24b8e907e3
</style>
