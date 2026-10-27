<template>
  <section class="p-stack cardapios-admin">
    <header class="p-section-head">
      <div>
        <p class="p-eyebrow">MERENDA ESCOLAR</p>
        <h1>Gerenciar cardápios</h1>
        <p>
          PDF oficial compartilhado entre escolas, com editor mensal opcional.
        </p>
      </div>
      <button class="p-button primary" :disabled="ocupado" @click="novo">
        + Novo cardápio
      </button>
    </header>
    <EstadoConsulta :consulta="escolas" /><EstadoConsulta
      :consulta="registros"
    />
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <p v-if="ocupado" role="status">{{ operacao || "Salvando…" }}</p>
    <form v-if="form" class="p-card p-stack" @submit.prevent="salvar(false)">
      <div class="p-section-head">
        <h2>{{ form.versao ? "Editar cardápio" : "Novo cardápio" }}</h2>
        <button
          type="button"
          class="p-button"
          :disabled="ocupado"
          @click="fechar"
        >
          Fechar editor
        </button>
      </div>
      <fieldset :disabled="ocupado" class="p-stack sem-borda">
        <legend>Identificação e período</legend>
        <div class="p-grid two">
          <label class="p-field"
            >Título<input
              v-model="form.titulo"
              required
              minlength="3"
              maxlength="200" /></label
          ><label class="p-field"
            >Mês e ano<input
              v-model="form.numero"
              type="month"
              required
              @change="alterarMes" /></label
          ><label class="p-field"
            >Etapa de ensino<input
              v-model="form.etapa"
              required
              maxlength="100"
              list="etapas-cardapio"
            /><datalist id="etapas-cardapio">
              <option>Educação Infantil</option>
              <option>Ensino Fundamental</option>
              <option>Educação de Jovens e Adultos</option>
            </datalist></label
          ><label class="p-field"
            >Turno<input
              v-model="form.turno"
              required
              maxlength="60"
              list="turnos-cardapio"
            /><datalist id="turnos-cardapio">
              <option>Parcial</option>
              <option>Integral</option>
              <option>Matutino</option>
              <option>Vespertino</option>
            </datalist></label
          ><label class="p-field"
            >Programa<input v-model="form.programa" maxlength="100" /></label
          ><label class="p-field"
            >Responsável técnico (opcional)<input
              v-model="form.local"
              maxlength="200"
          /></label>
        </div>
        <fieldset class="p-stack">
          <legend>Escolas que utilizarão este cardápio</legend>
          <label class="p-field"
            >Pesquisar escola<input
              v-model="buscaEscola"
              type="search"
              maxlength="100"
          /></label>
          <div class="selecao-escolas">
            <label v-for="e in escolasFiltradas" :key="e.id" class="p-check"
              ><input
                v-model="form.escolaIds"
                type="checkbox"
                :value="e.id"
              />{{ e.nome
              }}<small v-if="e.ativo === false || e.arquivada">
                — inativa; disponível para rascunho</small
              ></label
            >
          </div>
          <p v-if="!escolasFiltradas.length">
            Nenhuma escola encontrada. Cadastre a unidade no módulo Escolas.
          </p>
          <p>{{ form.escolaIds.length }} escola(s) selecionada(s)</p>
          <ul class="previa-escolas">
            <li v-for="id in form.escolaIds" :key="id">
              {{ nome(id) }} <small>({{ id }})</small
              ><span v-if="!escolasPublicadas.has(id)">
                · cadastro ainda não publicado</span
              >
            </li>
          </ul>
          <p class="p-small">
            Usamos os IDs existentes. Para publicar, as escolas precisam estar
            ativas e autorizadas na seção pública.
          </p>
          <button type="button" class="p-button" @click="prepararExemplo">
            Preparar exemplo de Outubro/2026 — conferir duas escolas
          </button>
          <p v-if="avisoExemplo" role="status" class="p-alert">
            {{ avisoExemplo }}
          </p>
        </fieldset>
        <fieldset class="p-stack">
          <legend>Documento original e conteúdo</legend>
          <label class="p-field"
            >Modo do cardápio<select v-model="modo" @change="alterarModo">
              <option value="pdf">
                PDF oficial (sem preenchimento diário)
              </option>
              <option value="grade">Editor mensal estruturado</option>
              <option value="texto">Texto de publicação anterior</option>
            </select></label
          ><label class="p-field"
            >Enviar ou substituir PDF original (até 2 MB)<input
              type="file"
              accept="application/pdf,.pdf"
              @change="selecionarPdf"
          /></label>
          <p v-if="arquivo">
            Selecionado: {{ arquivo.name }}. Envio será feito ao salvar ou
            publicar.
          </p>
          <p v-else-if="form.arquivoId">
            PDF confirmado: {{ form.arquivoNome || "documento original" }}. O
            mesmo arquivo será utilizado pelas escolas selecionadas.
          </p>
          <button
            v-if="arquivo || form.arquivoId"
            type="button"
            class="p-button"
            @click="visualizar"
          >
            Visualizar PDF original</button
          ><CardapioEditor
            v-if="modo === 'grade' && form.gradeCardapio"
            :model-value="form.gradeCardapio"
            :escola="form.escolaIds.map(nome).join(' · ')"
            :responsavel="form.local"
            @update:model-value="atualizarGrade"
          /><label v-if="modo === 'texto'" class="p-field"
            >Cardápio completo<textarea
              v-model="form.texto"
              maxlength="30000"
              rows="8"
            /></label
          ><label class="p-field"
            >Observações oficiais (opcional)<textarea
              v-model="form.observacoes"
              maxlength="3000"
              rows="3"
            />
          </label>
          <p class="p-small">
            O PDF mantém o conteúdo original. A seleção de escolas e os dados
            acima devem ser conferidos antes da publicação.
          </p>
        </fieldset>
        <details>
          <summary>Apresentação e opções da publicação</summary>
          <div class="p-stack">
            <label class="p-field"
              >Resumo<textarea v-model="form.resumo" maxlength="800" rows="2" />
            </label>
            <label class="p-field"
              >Link complementar<input v-model="form.url" maxlength="2000"
            /></label>
            <FotoPublicacao
              :key="form.id"
              v-model="form.imagemUrl"
              :conteudo-id="form.id"
              tipo="cardapio"
              :alt="form.imagemAlt"
              :disabled="ocupado"
              @ocupado="fotoOcupada = $event"
              @pendente="fotoPendente = $event"
            />
            <label class="p-field"
              >Descrição da imagem<input
                v-model="form.imagemAlt"
                maxlength="200"
            /></label>
            <div class="p-grid two">
              <label class="p-field"
                >Data inicial<input
                  v-model="form.dataInicio"
                  type="date" /></label
              ><label class="p-field"
                >Data final<input
                  v-model="form.dataFim"
                  type="date"
                  :min="form.dataInicio" /></label
              ><label class="p-field"
                >Ordem de exibição<input
                  v-model.number="form.ordem"
                  type="number"
                  min="0"
                  max="9999" /></label
              ><label class="p-check"
                ><input
                  v-model="form.destaque"
                  type="checkbox"
                />Destaque</label
              >
            </div>
          </div>
        </details>
        <details>
          <summary>Prévia da publicação</summary>
          <h3>{{ form.titulo }}</h3>
          <p>
            {{ form.numero }} · {{ form.etapa }} · {{ form.turno }} ·
            {{ form.programa }}
          </p>
          <ul>
            <li v-for="id in form.escolaIds" :key="id">{{ nome(id) }}</li>
          </ul>
          <p class="p-prose">{{ form.observacoes }}</p>
        </details>
        <label class="p-check"
          ><input v-model="revisado" type="checkbox" />Conferi o período, as
          escolas selecionadas e o conteúdo oficial.</label
        >
        <div v-if="conflitos.length" role="alert" class="p-alert">
          <h3>Publicações conflitantes</h3>
          <ul>
            <li v-for="c in conflitos" :key="c.id">
              {{ c.titulo }} — {{ c.escolaIds.map(nome).join(", ") }}
            </li>
          </ul>
          <p>
            A substituição retira apenas os vínculos conflitantes. As demais
            escolas continuam com o cardápio anterior.
          </p>
          <div class="p-actions">
            <button
              type="button"
              class="p-button danger"
              :disabled="!revisado"
              @click="salvar(true, true)"
            >
              Confirmar substituição dos vínculos</button
            ><button type="button" class="p-button" @click="conflitos = []">
              Revisar formulário</button
            ><button
              type="button"
              class="p-button"
              @click="
                conflitos = [];
                erro = '';
              "
            >
              Cancelar substituição
            </button>
          </div>
        </div>
        <div class="p-actions">
          <button class="p-button" type="submit">Salvar rascunho</button
          ><button
            type="button"
            class="p-button primary"
            :disabled="!revisado || !!conflitos.length"
            @click="salvar(true)"
          >
            Publicar
          </button>
        </div>
      </fieldset>
    </form>
    <template v-else
      ><div class="p-card p-grid two">
        <label class="p-field"
          >Filtrar por escola<select v-model="filtroEscola">
            <option value="">Todas</option>
            <option v-for="e in ordenadas" :key="e.id" :value="e.id">
              {{ e.nome }}
            </option>
          </select></label
        ><label class="p-field"
          >Filtrar por mês<input v-model="filtroMes" type="month" /></label
        ><label class="p-field"
          >Situação<select v-model="filtroStatus">
            <option value="">Todas</option>
            <option value="publicado">Tem versão pública</option>
            <option value="rascunho">Rascunho</option>
          </select></label
        ><button
          class="p-button"
          @click="
            filtroEscola = '';
            filtroMes = '';
            filtroStatus = '';
          "
        >
          Limpar filtros
        </button>
      </div>
      <article v-for="c in filtrados" :key="c.id" class="p-card p-stack">
        <div class="p-section-head">
          <div>
            <span class="p-badge">{{
              c.publicado ? "Tem versão pública" : "Rascunho"
            }}</span>
            <h2>{{ c.titulo }}</h2>
            <p>
              {{ c.numero }} ·
              {{ c.etapa || c.gradeCardapio?.etapa || c.categoria }} ·
              {{ c.turno || c.gradeCardapio?.turno }}
            </p>
            <p>
              {{
                idsEscolas(c).map(nome).join(" · ") ||
                "Sem vínculo — selecione uma escola para republicar"
              }}
            </p>
          </div>
          <div class="p-actions">
            <button class="p-button" :disabled="ocupado" @click="editar(c)">
              Editar informações e vínculos</button
            ><button class="p-button" :disabled="ocupado" @click="duplicar(c)">
              Duplicar para outro mês</button
            ><button class="p-button" :disabled="ocupado" @click="historico(c)">
              Histórico</button
            ><router-link
              v-if="c.publicado"
              class="p-button"
              :to="{
                path: '/merenda-escolar',
                query: { escola: idsEscolas(c)[0], mes: c.numero },
              }"
              >Ver publicação</router-link
            ><button
              v-if="c.publicado"
              class="p-button danger"
              :disabled="ocupado"
              @click="retirar(c)"
            >
              Retirar publicação
            </button>
          </div>
        </div>
      </article>
      <p v-if="!filtrados.length && !registros.carregando.value">
        Nenhum cardápio encontrado.
      </p></template
    >
    <dialog ref="dialogo" class="pdf-dialog" @close="limparPrevia">
      <header class="p-section-head">
        <h2>{{ tituloDialogo }}</h2>
        <button
          type="button"
          class="p-button"
          aria-label="Fechar visualização"
          @click="dialogo.close()"
        >
          Fechar ×
        </button>
      </header>
      <iframe v-if="previa" :src="previa" title="Prévia do PDF oficial" />
      <p v-if="previa">
        <a :href="previa" target="_blank" rel="noopener"
          >Abrir PDF em outra aba</a
        >
      </p>
      <ul v-else>
        <li v-for="h in eventos" :key="h.id">
          {{ h.em ? new Date(h.em).toLocaleString("pt-BR") : "" }} ·
          {{ h.nome }} · {{ h.acao }}
        </li>
      </ul>
      <p v-if="!previa && !eventos.length">
        Nenhum registro de histórico encontrado.
      </p>
    </dialog>
  </section>
</template>
<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
import { cardapiosApi } from "../../services/cardapiosApi";
import { arquivoBase64 } from "../../services/editaisApi";
import { idsEscolas, conferirExemplo } from "../../../shared/cardapios.mjs";
import { novoCardapio, validarCardapio } from "../../portal/cardapioMensal";
import { dataHoje } from "../../portal/validacao";
import CardapioEditor from "../../components/cardapio/CardapioEditor.vue";
import FotoPublicacao from "../../components/admin/FotoPublicacao.vue";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const escolas = useColecao(() => collection(db, "escolas")),
  publicas = useColecao(() => collection(db, "escolasPublicas")),
  registros = useColecao(() =>
    query(collection(db, "conteudos"), where("tipo", "==", "cardapio")),
  );
const form = ref(null),
  modo = ref("pdf"),
  arquivo = ref(null),
  revisado = ref(false),
  ocupado = ref(false),
  operacao = ref(""),
  erro = ref(""),
  mensagem = ref(""),
  buscaEscola = ref(""),
  filtroEscola = ref(""),
  filtroMes = ref(""),
  filtroStatus = ref(""),
  conflitos = ref([]),
  avisoExemplo = ref(""),
  dialogo = ref(null),
  previa = ref(""),
  eventos = ref([]),
  tituloDialogo = ref("");
const fotoOcupada = ref(false),
  fotoPendente = ref(false);
const normalizar = (v) =>
  String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const ordenadas = computed(() =>
    escolas.dados.value
      .filter((e) => e.id !== "deposito-municipal")
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  ),
  escolasFiltradas = computed(() =>
    ordenadas.value.filter((e) =>
      normalizar(e.nome).includes(normalizar(buscaEscola.value)),
    ),
  ),
  escolasPublicadas = computed(
    () => new Set(publicas.dados.value.map((e) => e.id)),
  ),
  filtrados = computed(() =>
    registros.dados.value
      .filter(
        (c) =>
          (!filtroEscola.value || idsEscolas(c).includes(filtroEscola.value)) &&
          (!filtroMes.value || c.numero === filtroMes.value) &&
          (!filtroStatus.value ||
            (filtroStatus.value === "publicado") === !!c.publicado),
      )
      .slice()
      .sort((a, b) => b.numero.localeCompare(a.numero)),
  );
const nome = (id) =>
  escolas.dados.value.find((e) => e.id === id)?.nome || `Unidade ${id}`;
watch(
  form,
  () => {
    revisado.value = false;
    conflitos.value = [];
  },
  { deep: true },
);
useSaidaSegura(() => !!form.value);
function novo() {
  if (ocupado.value || fotoOcupada.value) return;
  if (form.value && !window.confirm("Descartar o formulário aberto?")) return;
  form.value = {
    id: crypto.randomUUID(),
    titulo: "",
    numero: dataHoje().slice(0, 7),
    etapa: "",
    turno: "",
    escolaIds: [],
    programa: "",
    texto: "",
    observacoes: "",
    local: "",
  };
  modo.value = "pdf";
  arquivo.value = null;
  fotoPendente.value = false;
  fotoOcupada.value = false;
  erro.value = "";
  mensagem.value = "";
  avisoExemplo.value = "";
}
function fechar() {
  if (ocupado.value || fotoOcupada.value) return;
  if (window.confirm("Fechar o editor e descartar alterações não salvas?")) {
    form.value = null;
    arquivo.value = null;
  }
}
function editar(c) {
  form.value = {
    ...c,
    escolaIds: idsEscolas(c),
    etapa: c.etapa || c.gradeCardapio?.etapa || c.categoria || "",
    turno: c.turno || c.gradeCardapio?.turno || "",
    ...(c.gradeCardapio
      ? { gradeCardapio: validarCardapio(c.gradeCardapio) }
      : {}),
  };
  modo.value = c.gradeCardapio ? "grade" : c.arquivoId ? "pdf" : "texto";
  arquivo.value = null;
  fotoPendente.value = false;
  fotoOcupada.value = false;
  erro.value = "";
  mensagem.value = "";
  avisoExemplo.value = "";
}
function duplicar(c) {
  const mes = window.prompt("Mês do novo rascunho (AAAA-MM):", "");
  if (!mes) return;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes) || mes === c.numero) {
    erro.value = "Escolha outro mês válido (AAAA-MM).";
    return;
  }
  editar(c);
  delete form.value.versao;
  form.value.id = crypto.randomUUID();
  form.value.numero = mes;
  form.value.publicado = false;
  if (form.value.gradeCardapio) {
    form.value.gradeCardapio = novoCardapio(mes);
    form.value.gradeCardapio.etapa = form.value.etapa;
    form.value.gradeCardapio.turno = form.value.turno;
  }
  mensagem.value =
    "Cópia ainda não salva. Revise o PDF, as escolas e o mês: o documento original pode conter o período anterior. A grade diária foi reiniciada.";
}
function alterarModo() {
  if (modo.value === "grade" && !form.value.gradeCardapio)
    form.value.gradeCardapio = {
      ...novoCardapio(form.value.numero),
      etapa: form.value.etapa,
      turno: form.value.turno,
    };
}
function alterarMes() {
  if (
    form.value.gradeCardapio &&
    form.value.gradeCardapio.mes !== form.value.numero
  ) {
    if (!window.confirm("Alterar o mês reinicia a grade diária. Continuar?")) {
      form.value.numero = form.value.gradeCardapio.mes;
      return;
    }
    form.value.gradeCardapio = {
      ...novoCardapio(form.value.numero),
      etapa: form.value.etapa,
      turno: form.value.turno,
    };
  }
}
function atualizarGrade(g) {
  form.value.gradeCardapio = g;
  form.value.numero = g.mes;
  form.value.etapa = g.etapa;
  form.value.turno = g.turno;
}
function prepararExemplo() {
  const correspondencias = conferirExemplo(ordenadas.value);
  avisoExemplo.value =
    "O arquivo usa “Maria de Lourdes Viana”; o cadastro utiliza “E. de E. Infantil Maria de Lurdes Viana dos Santos”. Confira a correspondência das duas unidades abaixo e selecione o PDF original.";
  if (correspondencias.some((c) => c.registros.length !== 1)) {
    erro.value =
      "Não foi possível identificar unicamente as duas escolas. Cadastre ou confira os registros existentes; nenhum vínculo foi escolhido automaticamente.";
    return;
  }
  form.value.titulo = "Educação Infantil — Outubro 2026";
  form.value.numero = "2026-10";
  form.value.etapa = "Educação Infantil";
  form.value.turno = "Parcial";
  form.value.programa = "PNAE";
  form.value.escolaIds = correspondencias.map((c) => c.registros[0].id);
  modo.value = "pdf";
  erro.value = "";
}
function selecionarPdf(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024 || !f.size || !/\.pdf$/i.test(f.name)) {
    erro.value = "Selecione um PDF válido de até 2 MB.";
    e.target.value = "";
    return;
  }
  arquivo.value = f;
  revisado.value = false;
  erro.value = "";
}
async function executar(fn) {
  if (ocupado.value) return;
  ocupado.value = true;
  erro.value = "";
  try {
    await fn();
  } catch (e) {
    erro.value = e.message;
    if (e.conflitos) conflitos.value = e.conflitos;
  } finally {
    ocupado.value = false;
    operacao.value = "";
  }
}
async function salvar(publicar, substituir = false) {
  if (fotoOcupada.value || fotoPendente.value) {
    erro.value = "Envie ou remova a foto selecionada antes de salvar.";
    return;
  }
  if (publicar && !revisado.value) {
    erro.value = "Confira as informações antes de publicar.";
    return;
  }
  await executar(async () => {
    if (arquivo.value) {
      operacao.value = "Enviando PDF original ao B2…";
      const r = await cardapiosApi({
        acao: "upload",
        nome: arquivo.value.name,
        mime: "application/pdf",
        base64: await arquivoBase64(arquivo.value),
      });
      form.value.arquivoId = r.arquivoId;
      form.value.arquivoNome = r.nome;
      arquivo.value = null;
    }
    operacao.value = "Confirmando cardápio…";
    const dados = { ...form.value };
    if (modo.value !== "grade") delete dados.gradeCardapio;
    await cardapiosApi({
      acao: "salvar",
      id: form.value.id,
      versao: form.value.versao,
      form: dados,
      publicar,
      substituir,
    });
    form.value = null;
    conflitos.value = [];
    mensagem.value = publicar
      ? "Cardápio publicado para as escolas selecionadas."
      : "Rascunho salvo. A versão pública anterior foi preservada.";
  });
}
async function retirar(c) {
  if (
    !window.confirm(
      "Retirar o cardápio de todas as escolas vinculadas? O rascunho e o PDF serão preservados.",
    )
  )
    return;
  await executar(async () => {
    await cardapiosApi({ acao: "retirar", id: c.id, versao: c.versao });
    mensagem.value = "Publicação retirada. Histórico e PDF preservados.";
  });
}
function limparPrevia() {
  if (previa.value) URL.revokeObjectURL(previa.value);
  previa.value = "";
  eventos.value = [];
}
async function visualizar() {
  await executar(async () => {
    limparPrevia();
    const blob =
      arquivo.value ||
      (await cardapiosApi(
        { acao: "visualizar", arquivoId: form.value.arquivoId },
        true,
      ));
    previa.value = URL.createObjectURL(blob);
    tituloDialogo.value = "PDF original — conferência";
    dialogo.value.showModal();
  });
}
async function historico(c) {
  await executar(async () => {
    limparPrevia();
    eventos.value = (
      await cardapiosApi({ acao: "historico", id: c.id })
    ).linhas;
    tituloDialogo.value = "Histórico do cardápio — últimas 100 alterações";
    dialogo.value.showModal();
  });
}
onBeforeUnmount(limparPrevia);
</script>
<style scoped>
.cardapios-admin {
  min-width: 0;
}
.cardapios-admin h1 {
  font-size: clamp(1.5rem, 3vw, 2.1rem);
}
.cardapios-admin h2 {
  font-size: 1.2rem;
}
.sem-borda {
  border: 0;
  padding: 0;
}
fieldset {
  min-width: 0;
  border: 1px solid var(--p-border, #ccd9d6);
  border-radius: 12px;
  padding: 1rem;
}
legend {
  font-weight: 700;
  padding: 0.3rem;
}
input,
select,
textarea {
  max-width: 100%;
  min-width: 0;
}
.selecao-escolas {
  max-height: 17rem;
  overflow: auto;
  display: grid;
  gap: 0.7rem;
}
.selecao-escolas label {
  margin: 0;
  align-items: start;
}
.previa-escolas {
  padding-left: 1.2rem;
  overflow-wrap: anywhere;
}
.pdf-dialog {
  width: min(960px, 94vw);
  max-height: 92dvh;
  border: 1px solid #ccd9d6;
  border-radius: 16px;
  padding: 1rem;
  box-sizing: border-box;
}
.pdf-dialog::backdrop {
  background: #001e2d99;
}
.pdf-dialog iframe {
  width: 100%;
  height: 65dvh;
  border: 0;
}
.p-actions {
  flex-wrap: wrap;
}
.p-button {
  min-height: 44px;
  white-space: normal;
}
.p-card {
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .p-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
  .p-section-head {
    align-items: stretch;
    gap: 0.8rem;
  }
  .p-section-head > .p-actions {
    width: 100%;
  }
  fieldset {
    padding: 0.75rem;
  }
  .pdf-dialog header {
    display: flex;
    flex-wrap: wrap;
  }
}
</style>
