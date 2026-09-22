<template>
  <section class="af-card">
    <div class="af-titulo">
      <div>
        <h2>Documentos da unidade</h2>
        <p>
          Fotografias, protocolos, notas e comprovantes com acesso restrito.
        </p>
      </div>
    </div>
    <details>
      <summary>Adicionar documento</summary>
      <CapturaDocumento
        :escola-id="escolaId"
        :vinculo="vinculo"
        @ocupado="capturando = $event"
        @texto="textoRecebido = $event"
      />
      <p v-if="textoRecebido" class="af-nota">
        A transcrição fica salva junto ao arquivo. Dados de saldo, valores ou
        resultados devem ser conferidos no formulário correspondente; a leitura
        não altera registros automaticamente.
      </p>
    </details>
    <label class="campo"
      >Buscar nos últimos 100 documentos<input
        v-model="busca"
        type="search"
        placeholder="Título, nome ou texto digitalizado"
    /></label>
    <label class="af-check"
      ><input v-model="arquivados" type="checkbox" />Mostrar arquivados</label
    >
    <p v-if="erro" role="alert" class="mensagem-erro">{{ erro }}</p>
    <p v-if="loading" role="status">Carregando documentos...</p>
    <p v-else-if="!filtrados.length">
      Nenhum documento encontrado para este filtro.
    </p>
    <article v-for="d in filtrados" :key="d.id" class="af-item">
      <h4>{{ d.titulo }}</h4>
      <p>
        {{ d.criadoPorNome }} · {{ data(d.criadoEm) }} ·
        {{
          d.estado === "pronto"
            ? "Confirmado"
            : d.estado === "falhou"
              ? "Envio não confirmado"
              : "Envio em andamento"
        }}{{ d.arquivado ? " · Arquivado" : "" }}
      </p>
      <p>
        {{
          d.vinculo
            ? "Vinculado a " + d.vinculo.tipo + " / " + d.vinculo.id
            : "Sem vínculo com um registro"
        }}
      </p>
      <details v-if="d.texto">
        <summary>Ver transcrição revisada</summary>
        <p class="af-scroll">{{ d.texto }}</p>
      </details>
      <div class="af-acoes">
        <button
          class="botao"
          :disabled="bloqueado || d.estado !== 'pronto'"
          @click="baixar(d)"
        >
          {{ ocupado === d.id ? "Aguarde..." : "Baixar arquivo" }}</button
        ><button
          v-if="!d.arquivado && podeOrganizar(d)"
          class="botao"
          :disabled="bloqueado || d.estado !== 'pronto'"
          @click="arquivar(d)"
        >
          Arquivar</button
        ><button
          v-if="!d.vinculo && !d.arquivado && podeOrganizar(d)"
          class="botao"
          :disabled="bloqueado || d.estado !== 'pronto'"
          @click="abrirVinculo(d)"
        >
          Vincular a registro
        </button>
      </div>
      <form
        v-if="selecionado === d.id"
        @submit.prevent="vincular(d)"
        class="af-campos"
      >
        <label class="campo"
          >Área<select v-model="tipoAlvo" @change="carregarAlvos">
            <option value="estoque">Item de estoque</option>
            <option value="movimentacoes">Movimentação</option>
            <option value="vistorias">Vistoria</option>
            <option value="visitasAF">Visita AF</option>
            <option value="cardapios">Cardápio interno antigo</option>
            <option v-if="ehGestao" value="conteudos">
              Cardápio mensal da escola
            </option>
          </select></label
        ><label class="campo"
          >Registro (até 100 recentes)<select v-model="alvoId" required>
            <option value="">Selecione</option>
            <option v-for="a in alvos" :key="a.id" :value="a.id">
              {{
                a.titulo ||
                a.nome ||
                a.itemNome ||
                a.dataVisita ||
                a.tipo ||
                a.id
              }}
              ·
              {{ a.id.slice(0, 8) }}
            </option>
          </select></label
        ><button class="botao" :disabled="bloqueado || !alvoId">
          Confirmar vínculo</button
        ><button type="button" class="botao" @click="selecionado = ''">
          Cancelar
        </button>
      </form>
    </article>
  </section>
</template>
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../composables/useAuth";
import { alimentacaoApi, baixarDocumento } from "../../services/alimentacaoApi";
import CapturaDocumento from "./CapturaDocumento.vue";
const props = defineProps({
    escolaId: { type: String, required: true },
    vinculo: { type: Object, default: null },
  }),
  emit = defineEmits(["ocupado"]);
const { usuario, ehGestao } = useAuth();
const capturando = ref(false);
const registros = ref([]),
  busca = ref(""),
  arquivados = ref(false),
  erro = ref(""),
  loading = ref(true),
  ocupado = ref(""),
  textoRecebido = ref(""),
  selecionado = ref(""),
  tipoAlvo = ref("estoque"),
  alvos = ref([]),
  alvoId = ref("");
let parar;
const bloqueado = computed(() => !!ocupado.value || capturando.value);
watch(bloqueado, (v) => emit("ocupado", v), { flush: "sync" });
const normal = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const filtrados = computed(() =>
  registros.value.filter(
    (d) =>
      (arquivados.value || !d.arquivado) &&
      (!props.vinculo ||
        (d.vinculo?.tipo === props.vinculo.tipo &&
          d.vinculo?.id === props.vinculo.id)) &&
      normal(d.titulo + " " + d.nome + " " + d.texto).includes(
        normal(busca.value),
      ),
  ),
);
const podeOrganizar = (d) =>
  ehGestao.value || d.criadoPor === usuario.value?.uid;
const data = (v) => v?.toDate?.().toLocaleString("pt-BR") || "";
onMounted(() => {
  parar = onSnapshot(
    query(
      collection(db, "escolas", props.escolaId, "documentos"),
      ...(props.vinculo
        ? [
            where("vinculo.tipo", "==", props.vinculo.tipo),
            where("vinculo.id", "==", props.vinculo.id),
          ]
        : []),
      orderBy("criadoEm", "desc"),
      limit(100),
    ),
    (s) => {
      registros.value = s.docs.map((d) => ({ ...d.data(), id: d.id }));
      loading.value = false;
    },
    () => {
      loading.value = false;
      erro.value =
        "Não foi possível carregar documentos. Confira as regras e sua conexão.";
    },
  );
});
onBeforeUnmount(() => parar?.());
async function executar(d, fn) {
  ocupado.value = d.id;

  erro.value = "";
  try {
    await fn();
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = "";
  }
}
const baixar = (d) => executar(d, () => baixarDocumento(props.escolaId, d));
const arquivar = (d) => {
  if (
    window.confirm(
      "Arquivar este documento? O arquivo e o histórico serão preservados.",
    )
  )
    return executar(d, () =>
      alimentacaoApi({ acao: "arquivar", escolaId: props.escolaId, id: d.id }),
    );
};
async function carregarAlvos() {
  alvoId.value = "";
  alvos.value = [];
  try {
    const campo =
      tipoAlvo.value === "estoque"
        ? "nome"
        : tipoAlvo.value === "visitasAF"
          ? "criadoEm"
          : tipoAlvo.value === "cardapios"
            ? "data"
            : "data";
    const s = await getDocs(
      tipoAlvo.value === "conteudos"
        ? query(
            collection(db, "conteudos"),
            where("tipo", "==", "cardapio"),
            where("escolaId", "==", props.escolaId),
            limit(100),
          )
        : query(
            collection(db, "escolas", props.escolaId, tipoAlvo.value),
            orderBy(campo, tipoAlvo.value === "estoque" ? "asc" : "desc"),
            limit(100),
          ),
    );
    alvos.value = s.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch {
    erro.value = "Não foi possível listar os registros de destino.";
  }
}
async function abrirVinculo(d) {
  selecionado.value = d.id;
  await carregarAlvos();
}
const vincular = (d) =>
  executar(d, async () => {
    await alimentacaoApi({
      acao: "vincular",
      escolaId: props.escolaId,
      id: d.id,
      vinculo: { tipo: tipoAlvo.value, id: alvoId.value },
    });
    selecionado.value = "";
  });
</script>
