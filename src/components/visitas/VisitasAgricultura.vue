<template>
  <section>
    <div class="af-card">
      <div class="af-titulo">
        <div>
          <h2>Visitas à Agricultura Familiar</h2>
          <p>
            Protocolo real da SEMED: recebimento, utilização e armazenamento dos
            alimentos.
          </p>
        </div>
        <a
          class="botao"
          href="/modelos/protocolo-agricultura-familiar.pdf"
          target="_blank"
          rel="noopener"
          >Baixar protocolo para imprimir</a
        >
      </div>
      <div class="af-painel">
        <p>
          <strong>{{ registros.length }}</strong
          >visitas recentes
        </p>
        <p>
          <strong>{{
            registros.filter(
              (v) =>
                v.resultado === "com_pendencias" &&
                v.acompanhamento?.estado !== "resolvida",
            ).length
          }}</strong
          >com acompanhamento em aberto
        </p>
      </div>
      <button
        class="botao botao-primario"
        :disabled="ocupado"
        @click="nova = !nova"
      >
        {{ nova ? "Recolher formulário" : "Nova visita" }}
      </button>
    </div>
    <div v-show="nova" class="af-card">
      <h3>Registrar visita</h3>
      <p>
        {{ escolaNome }} — as respostas podem ser digitadas ou sugeridas pela
        leitura das fotos.
      </p>
      <details>
        <summary>Digitalizar as páginas do protocolo</summary>
        <CapturaDocumento
          :key="chaveCaptura"
          :escola-id="escolaId"
          @texto="sugerir"
          @salvo="anexar"
          @ocupado="capturando = $event"
        />
        <p>
          {{ documentos.length }} de 10 páginas anexadas. Salve cada página
          antes de escolher a próxima.
        </p>
        <p v-if="documentos.length">
          Os arquivos permanecem em Documentos mesmo se a visita não for
          concluída.
        </p>
      </details>
      <p v-if="avisoOCR" class="af-aviso" role="status">{{ avisoOCR }}</p>
      <form @submit.prevent="salvar">
        <fieldset :disabled="salvando">
          <div class="af-grade">
            <label class="campo"
              >Data da visita<input
                v-model="form.dataVisita"
                type="date"
                required
                :max="hoje" /></label
            ><label class="campo"
              >Lanche do dia<input
                v-model="form.lanche"
                maxlength="500"
                required
            /></label>
          </div>
          <fieldset v-for="(pergunta, i) in PERGUNTAS" :key="i" class="af-item">
            <legend>{{ i + 1 }}. {{ pergunta }}</legend>
            <p v-if="i === 8" class="af-nota">
              Nesta pergunta, “Sim” aponta uma condição que precisa de atenção.
            </p>
            <div class="af-radio">
              <label
                ><input
                  v-model="form.respostas[i].resposta"
                  type="radio"
                  :name="'af-' + i"
                  value="sim"
                  required
                />Sim</label
              ><label
                ><input
                  v-model="form.respostas[i].resposta"
                  type="radio"
                  :name="'af-' + i"
                  value="nao"
                  required
                />{{ i === 5 ? "Não adequado" : "Não" }}</label
              >
            </div>
            <label class="campo"
              >Observações<textarea
                v-model="form.respostas[i].observacao"
                maxlength="2000"
                rows="2"
              />
            </label>
          </fieldset>
          <p class="af-aviso">
            {{ avaliacao.pendentes.length }} perguntas sem resposta ·
            {{ avaliacao.atencao.length }} pontos de atenção. Confira todos os
            campos; OCR pode errar mesmo em texto impresso.
          </p>
          <label class="campo"
            >Plano de ação
            {{ avaliacao.atencao.length ? "(obrigatório)" : "(opcional)"
            }}<textarea
              v-model="form.planoDeAcao"
              maxlength="5000"
              rows="3"
              :required="!!avaliacao.atencao.length"
              placeholder="O que precisa ser feito, responsável e prazo"
            />
          </label>
          <div class="af-grade">
            <fieldset>
              <legend>Responsável pela visita</legend>
              <label class="campo"
                >Nome e sobrenome<input
                  v-model.trim="form.responsavel.nome"
                  maxlength="160"
                  required
                  autocomplete="off" /></label
              ><label class="campo"
                >CPF<input
                  v-model="form.responsavel.cpf"
                  inputmode="numeric"
                  maxlength="14"
                  required
                  autocomplete="off"
              /></label>
            </fieldset>
            <fieldset>
              <legend>Diretor(a) / acompanhante</legend>
              <label class="campo"
                >Nome e sobrenome<input
                  v-model.trim="form.acompanhante.nome"
                  maxlength="160"
                  required
                  autocomplete="off" /></label
              ><label class="campo"
                >CPF<input
                  v-model="form.acompanhante.cpf"
                  inputmode="numeric"
                  maxlength="14"
                  required
                  autocomplete="off"
              /></label>
            </fieldset>
          </div>
          <p class="af-nota">
            Nome e CPF registram a identificação declarada. Não verificam a
            identidade civil nem substituem uma assinatura certificada ou a
            assinatura do documento em papel.
          </p>
          <label class="af-check"
            ><input v-model="revisado" type="checkbox" required />Revisei as
            nove respostas, a data, as identificações e os anexos.</label
          ><button
            class="botao botao-primario"
            :disabled="ocupado || !revisado"
          >
            {{ salvando ? "Salvando e confirmando..." : "Salvar visita" }}
          </button>
        </fieldset>
      </form>
    </div>
    <p v-if="erro" class="mensagem-erro" role="alert">{{ erro }}</p>
    <p v-if="mensagem" class="mensagem-sucesso" role="status">{{ mensagem }}</p>
    <div class="af-card">
      <h3>Histórico de visitas</h3>
      <div class="af-grade">
        <label class="campo"
          >Pesquisar<input
            v-model="busca"
            type="search"
            placeholder="Lanche, responsável ou data" /></label
        ><label class="campo"
          >Situação<select v-model="situacao">
            <option value="">Todas</option>
            <option value="aberta">Pendências em aberto</option>
            <option value="resolvida">Pendências acompanhadas</option>
            <option value="sem_pendencias">Sem pendências apontadas</option>
          </select></label
        >
      </div>
      <p v-if="carregando">Carregando...</p>
      <p v-else-if="!filtrados.length">Nenhuma visita encontrada.</p>
      <article v-for="v in filtrados" :key="v.id" class="af-item">
        <h4>
          {{ v.dataVisita.split("-").reverse().join("/") }} · {{ v.lanche }}
        </h4>
        <p>
          {{ v.responsavel.nome }} ·
          {{
            v.resultado === "sem_pendencias"
              ? "Sem pendências apontadas"
              : v.pontosAtencao.length + " ponto(s) de atenção"
          }}{{
            v.acompanhamento?.estado === "resolvida"
              ? " · Acompanhamento concluído"
              : ""
          }}
        </p>
        <div class="af-acoes">
          <button class="botao" :disabled="ocupado" @click="pdf(v)">
            Baixar relatório PDF</button
          ><button
            class="botao"
            :disabled="ocupado"
            :aria-expanded="detalhe === v.id"
            @click="abrirDetalhe(v.id)"
          >
            Detalhes e documentos
          </button>
        </div>
        <div v-if="detalhe === v.id">
          <ol>
            <li v-for="(r, i) in v.respostas" :key="i">
              {{ PERGUNTAS[i] }}
              <strong>{{ r.resposta === "sim" ? "Sim" : "Não" }}</strong>
              <p v-if="r.observacao">{{ r.observacao }}</p>
            </li>
          </ol>
          <p>
            <strong>Plano de ação:</strong>
            {{ v.planoDeAcao || "Não informado" }}
          </p>
          <p>
            <strong>Acompanhamento:</strong>
            {{ v.acompanhamento?.texto || "Sem atualização" }}
          </p>
          <form
            v-if="v.resultado === 'com_pendencias'"
            @submit.prevent="acompanhar(v)"
            class="af-campos"
          >
            <label class="campo"
              >Atualizar acompanhamento<textarea
                v-model="acompanhamento"
                required
                maxlength="3000"
                rows="3"
              /></label
            ><label class="af-check"
              ><input v-model="resolvida" type="checkbox" />As providências
              foram verificadas e concluídas.</label
            ><button class="botao" :disabled="ocupado">
              Registrar acompanhamento
            </button>
          </form>
          <DocumentosUnidade
            :escola-id="escolaId"
            :vinculo="{ tipo: 'visitasAF', id: v.id }"
            @ocupado="capturando = $event"
          />
        </div>
      </article>
      <p class="af-nota">
        São exibidas até 100 visitas recentes. Os indicadores e filtros
        consideram esta lista.
      </p>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  PERGUNTAS,
  avaliar,
  validarVisita,
  extrairProtocolo,
} from "../../../shared/protocolo-af.mjs";
import { alimentacaoApi } from "../../services/alimentacaoApi";
import { exportarVisita } from "../../services/relatorioVisita";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
import CapturaDocumento from "../documentos/CapturaDocumento.vue";
import DocumentosUnidade from "../documentos/DocumentosUnidade.vue";
const props = defineProps({
    escolaId: { type: String, required: true },
    escolaNome: { type: String, required: true },
  }),
  emit = defineEmits(["ocupado"]);
const chaveCaptura = ref(0);
const hoje = new Date().toLocaleDateString("en-CA"),
  vazio = () => ({
    dataVisita: hoje,
    lanche: "",
    respostas: PERGUNTAS.map(() => ({ resposta: "", observacao: "" })),
    planoDeAcao: "",
    responsavel: { nome: "", cpf: "" },
    acompanhante: { nome: "", cpf: "" },
  });
const form = ref(vazio()),
  documentos = ref([]),
  revisado = ref(false),
  nova = ref(false),
  salvando = ref(false),
  capturando = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  avisoOCR = ref(""),
  registros = ref([]),
  carregando = ref(true),
  busca = ref(""),
  situacao = ref(""),
  detalhe = ref(""),
  acompanhamento = ref(""),
  resolvida = ref(false);
let id = crypto.randomUUID(),
  parar;
const ocupado = computed(() => salvando.value || capturando.value),
  avaliacao = computed(() => avaliar(form.value.respostas));
watch(ocupado, (v) => emit("ocupado", v), { flush: "sync" });
watch(
  form,
  () => {
    revisado.value = false;
  },
  { deep: true },
);
useSaidaSegura(
  () =>
    ocupado.value ||
    !!acompanhamento.value ||
    resolvida.value ||
    documentos.value.length > 0 ||
    JSON.stringify(form.value) !== JSON.stringify(vazio()) ||
    !!form.value.lanche ||
    form.value.respostas.some((r) => r.resposta || r.observacao),
);
const filtrados = computed(() =>
  registros.value.filter(
    (v) =>
      (v.lanche + " " + v.responsavel.nome + " " + v.dataVisita)
        .toLocaleLowerCase()
        .includes(busca.value.toLocaleLowerCase()) &&
      (!situacao.value ||
        (situacao.value === "aberta"
          ? v.resultado === "com_pendencias" &&
            v.acompanhamento?.estado !== "resolvida"
          : situacao.value === "resolvida"
            ? v.acompanhamento?.estado === "resolvida"
            : v.resultado === "sem_pendencias")),
  ),
);
onMounted(() => {
  parar = onSnapshot(
    query(
      collection(db, "escolas", props.escolaId, "visitasAF"),
      orderBy("criadoEm", "desc"),
      limit(100),
    ),
    (s) => {
      registros.value = s.docs.map((d) => ({ ...d.data(), id: d.id }));
      carregando.value = false;
    },
    () => {
      carregando.value = false;
      erro.value =
        "Não foi possível carregar visitas. Confira as permissões publicadas.";
    },
  );
});
onBeforeUnmount(() => parar?.());
function sugerir(texto) {
  const s = extrairProtocolo(texto);
  if (
    !window.confirm(
      "Aplicar sugestões aos campos vazios? Confira tudo antes de salvar.",
    )
  )
    return;
  if (!form.value.lanche) form.value.lanche = s.lanche;
  if (s.dataVisita) form.value.dataVisita = s.dataVisita;
  s.respostas.forEach((r, i) => {
    if (!form.value.respostas[i].resposta)
      form.value.respostas[i].resposta = r.resposta;
    if (!form.value.respostas[i].observacao)
      form.value.respostas[i].observacao = r.observacao;
  });
  revisado.value = false;
  avisoOCR.value =
    "Sugestões aplicadas. A escola selecionada não foi alterada." +
    (s.escola
      ? " Escola lida: " +
        s.escola +
        ". Confira se corresponde a " +
        props.escolaNome +
        "."
      : " Confira também a data, pois pode não ter sido reconhecida.");
}
function anexar(d) {
  if (documentos.value.includes(d.id)) return;
  if (documentos.value.length >= 10) {
    erro.value =
      "Limite de dez anexos nesta visita. O arquivo enviado está na aba Documentos, sem vínculo.";
    return;
  }
  documentos.value.push(d.id);
  revisado.value = false;
}
async function salvar() {
  if (ocupado.value || !revisado.value) return;
  erro.value = "";
  mensagem.value = "";
  const visita = {
    ...form.value,
    documentos: documentos.value,
    revisado: true,
    responsavel: {
      ...form.value.responsavel,
      cpf: form.value.responsavel.cpf.replace(/\D/g, ""),
    },
    acompanhante: {
      ...form.value.acompanhante,
      cpf: form.value.acompanhante.cpf.replace(/\D/g, ""),
    },
  };
  try {
    validarVisita(visita);
    salvando.value = true;
    await alimentacaoApi({
      acao: "salvarVisita",
      escolaId: props.escolaId,
      id,
      visita,
    });
    mensagem.value =
      "Visita confirmada no banco, com identificação e auditoria.";
    form.value = vazio();
    documentos.value = [];
    chaveCaptura.value++;
    id = crypto.randomUUID();
    revisado.value = false;
    nova.value = false;
  } catch (e) {
    erro.value = e.message;
  } finally {
    salvando.value = false;
  }
}
async function pdf(v) {
  salvando.value = true;
  erro.value = "";
  try {
    await exportarVisita(v);
  } catch {
    erro.value = "Não foi possível gerar o relatório.";
  } finally {
    salvando.value = false;
  }
}
function abrirDetalhe(idVisita) {
  if (
    (acompanhamento.value || resolvida.value) &&
    !window.confirm(
      "Descartar a atualização de acompanhamento ainda não salva?",
    )
  )
    return;
  acompanhamento.value = "";
  resolvida.value = false;
  detalhe.value = detalhe.value === idVisita ? "" : idVisita;
}
async function acompanhar(v) {
  salvando.value = true;
  erro.value = "";
  try {
    await alimentacaoApi({
      acao: "acompanharVisita",
      escolaId: props.escolaId,
      id: v.id,
      texto: acompanhamento.value,
      resolvida: resolvida.value,
      versao: v.versaoAcompanhamento || 0,
    });
    acompanhamento.value = "";
    resolvida.value = false;
    mensagem.value = "Acompanhamento registrado na auditoria.";
  } catch (e) {
    erro.value = e.message;
  } finally {
    salvando.value = false;
  }
}
</script>
