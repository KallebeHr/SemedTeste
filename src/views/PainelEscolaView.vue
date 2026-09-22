<template>
  <div v-if="usuario" class="alimentacao">
    <div class="painel">
      <header class="painel-topo">
        <div>
          <p class="sobretitulo">SEDUC · PEDRO II</p>
          <h1>Controle de Alimentação Escolar</h1>
          <p>
            Depósito municipal, estoque das escolas e acompanhamento da
            alimentação.
          </p>
        </div>
        <div class="sessao">
          <span>{{ usuario.nome }}</span
          ><button class="botao" :disabled="ocupado" @click="sairDoPainel">
            Sair
          </button>
        </div>
      </header>
      <div class="barra-escolas">
        <fieldset :disabled="ocupado || carregandoEscolas" class="seletor">
          <EscolaSelector
            :model-value="escolaId"
            :escolas="escolas"
            rotulo="Unidade de estoque"
            @update:model-value="trocarEscola"
          />
        </fieldset>
        <button
          v-if="ehGestao"
          class="botao"
          :disabled="ocupado"
          @click="mostrarEscola = true"
        >
          + Cadastrar escola
        </button>
        <button
          v-if="ehGestao && !escolas.some((e) => ehDeposito(e.id))"
          class="botao"
          :disabled="ocupado || carregandoEscolas"
          @click="abrirDeposito"
        >
          Ativar depósito municipal
        </button>
      </div>
      <p v-if="erroEscolas || erroAcao" class="mensagem-erro" role="alert">
        {{ erroEscolas || erroAcao }}
      </p>
      <p v-if="mensagem" class="mensagem-sucesso" role="status">
        {{ mensagem }}
      </p>
      <p v-if="carregandoEscolas" class="estado" role="status">
        Carregando unidades...
      </p>
      <div v-else-if="!escolas.length && !erroEscolas" class="estado">
        <h2>Nenhuma unidade disponível</h2>
        <p>
          {{
            ehGestao
              ? "Cadastre a primeira escola ou ative o depósito municipal para começar."
              : "Solicite à administração o vínculo da sua conta com uma escola."
          }}
        </p>
      </div>
      <template v-if="escolaId"
        ><div class="unidade-atual">
          <strong>{{ escolaAtual.nome }}</strong>
          <p>
            {{
              ehDeposito(escolaId)
                ? "Estoque central da Educação. As retiradas e os recebimentos nas escolas são registrados separadamente."
                : "O saldo e o histórico desta unidade são independentes do depósito municipal."
            }}
          </p>
        </div>
        <nav class="abas" aria-label="Seções da alimentação escolar">
          <button
            v-for="aba in abas"
            :key="aba.id"
            type="button"
            :class="{ ativo: abaAtiva === aba.id }"
            :aria-current="abaAtiva === aba.id ? 'page' : undefined"
            :disabled="ocupado"
            @click="trocarAba(aba.id)"
          >
            {{ aba.rotulo }}
          </button>
        </nav>
        <div :key="escolaId" class="conteudo">
          <p v-if="erroEstoque" class="mensagem-erro" role="alert">
            {{ erroEstoque }}
          </p>
          <p v-if="carregandoEstoque" class="estado" role="status">
            Carregando estoque...
          </p>
          <DashboardGeral
            v-if="
              abaAtiva === 'dashboard' && !carregandoEstoque && !erroEstoque
            "
            :itens="itens"
            :itens-abaixo-do-minimo="itensAbaixoDoMinimo"
            :itens-proximos-do-vencimento="itensProximosDoVencimento"
            :dias-validade="parametros.diasValidade"
            :valor-total-estoque="valorTotalEstoque"
          />
          <section v-if="abaAtiva === 'estoque'">
            <div class="acoes">
              <button
                v-if="ehGestao"
                class="botao botao-primario"
                @click="abrirItem()"
              >
                + Novo item
              </button>
              <button
                v-if="ehGestao"
                class="botao"
                :disabled="ocupado || carregandoEstoque || !!erroEstoque"
                @click="mostrarCatalogo = true"
              >
                Adicionar do catálogo
              </button>
              <button
                class="botao"
                :disabled="carregandoEstoque || !!erroEstoque"
                @click="exportarEstoque"
              >
                Exportar PDF
              </button>
            </div>
            <EstoqueList
              v-if="!carregandoEstoque && !erroEstoque"
              :itens="todosItens"
              :ocupado="ocupado"
              :dias-validade="parametros.diasValidade"
              :pode-editar="ehGestao"
              @editar="abrirItem"
              @movimentar="iniciarMovimentacao"
              @arquivar="alterarArquivo($event, false)"
              @reativar="alterarArquivo($event, true)"
              @historico="abrirHistorico"
            />
          </section>
          <section v-if="abaAtiva === 'movimentacao'">
            <MovimentacaoForm
              v-if="ehGestao && itens.length"
              :key="formMovKey"
              :item-inicial="operacaoInicial?.item?.id || ''"
              :tipo-inicial="operacaoInicial?.tipo || 'entrada'"
              :escolas-destino="
                ehDeposito(escolaId)
                  ? escolas.filter((e) => !ehDeposito(e.id))
                  : []
              "
              :escola-id="escolaId"
              :itens="itens"
              @ocupado="ocupado = $event"
              @concluido="concluirMovimentacao"
            />
            <p v-else-if="ehGestao" class="estado">
              Cadastre um item na aba Estoque para registrar entradas e saídas.
            </p>
            <HistoricoEscola
              @ocupado="ocupado = $event"
              :escola-id="escolaId"
              :escola-nome="escolaAtual.nome"
              tipo="movimentacoes"
            />
          </section>
          <section v-if="abaAtiva === 'historico'">
            <HistoricoEscola
              @ocupado="ocupado = $event"
              :key="filtroItemHistorico"
              :escola-id="escolaId"
              :escola-nome="escolaAtual.nome"
              tipo="movimentacoes"
              :item-inicial="filtroItemHistorico"
              :itens="todosItens"
            />
          </section>
          <section v-if="abaAtiva === 'vistoria'">
            <VistoriaForm
              v-if="ehGestao || ehDiretor"
              :escola-id="escolaId"
              @ocupado="ocupado = $event"
              @concluido="mensagem = 'Vistoria registrada com sucesso.'"
            />
            <HistoricoEscola
              @ocupado="ocupado = $event"
              :escola-id="escolaId"
              :escola-nome="escolaAtual.nome"
              tipo="vistorias"
            />
          </section>
          <VisitasAgricultura
            v-if="
              abaAtiva === 'visitasAF' &&
              !ehDeposito(escolaId) &&
              (ehGestao || ehDiretor)
            "
            :escola-id="escolaId"
            :escola-nome="escolaAtual.nome"
            @ocupado="ocupado = $event"
          />
          <DocumentosUnidade
            v-if="abaAtiva === 'documentos' && (ehGestao || ehDiretor)"
            :escola-id="escolaId"
            @ocupado="ocupado = $event"
          />
          <AuditoriaTimeline
            v-if="abaAtiva === 'auditoria' && ehGestao"
            :escola-id="escolaId"
          />
          <BackupManager
            v-if="abaAtiva === 'backup' && ehGestao"
            :escolas="escolas"
            @ocupado="ocupado = $event"
          />
        </div>
      </template>
      <p v-else-if="escolas.length && !carregandoEscolas" class="estado">
        Selecione uma escola ou o depósito para começar.
      </p>
    </div>
    <v-dialog v-model="mostrarCatalogo" max-width="1000" persistent>
      <v-card theme="light" class="alimentacao dialogo">
        <CatalogoEstoque
          v-if="mostrarCatalogo"
          :key="escolaId"
          :escola-id="escolaId"
          :itens="todosItens"
          @ocupado="ocupado = $event"
          @fechar="fecharCatalogo"
        />
      </v-card>
    </v-dialog>
    <v-dialog v-model="mostrarItem" max-width="720" :persistent="ocupado">
      <v-card theme="light" class="alimentacao dialogo">
        <h2>{{ itemEmEdicao ? "Editar item" : "Novo item de estoque" }}</h2>
        <EstoqueForm
          v-if="mostrarItem"
          :key="escolaId + (itemEmEdicao?.id || 'novo')"
          :escola-id="escolaId"
          :item-existente="itemEmEdicao"
          @ocupado="ocupado = $event"
          @cancelar="mostrarItem = false"
          @salvo="itemSalvo"
        />
      </v-card>
    </v-dialog>
    <v-dialog v-model="mostrarEscola" max-width="480" :persistent="ocupado">
      <v-card theme="light" class="alimentacao dialogo">
        <h2>Cadastrar escola</h2>
        <form @submit.prevent="cadastrarEscola">
          <label class="campo"
            ><span>Nome da escola</span
            ><input
              v-model="nomeEscola"
              type="text"
              required
              maxlength="160"
              :disabled="ocupado"
          /></label>
          <p v-if="erroCadastro" class="mensagem-erro" role="alert">
            {{ erroCadastro }}
          </p>
          <div class="acoes">
            <button
              class="botao"
              type="button"
              :disabled="ocupado"
              @click="mostrarEscola = false"
            >
              Cancelar</button
            ><button
              class="botao botao-primario"
              type="submit"
              :disabled="ocupado"
            >
              {{ ocupado ? "Salvando..." : "Cadastrar" }}
            </button>
          </div>
        </form>
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup>
import "../styles/documentos-alimentacao.css";
import VisitasAgricultura from "../components/visitas/VisitasAgricultura.vue";
import DocumentosUnidade from "../components/documentos/DocumentosUnidade.vue";
import CatalogoEstoque from "../components/estoque/CatalogoEstoque.vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter, onBeforeRouteLeave } from "vue-router";
import EscolaSelector from "../components/escolas/EscolaSelector.vue";
import DashboardGeral from "../components/dashboard/DashboardGeral.vue";
import EstoqueList from "../components/estoque/EstoqueList.vue";
import EstoqueForm from "../components/estoque/EstoqueForm.vue";
import MovimentacaoForm from "../components/movimentacoes/MovimentacaoForm.vue";
import VistoriaForm from "../components/vistoria/VistoriaForm.vue";
import AuditoriaTimeline from "../components/auditoria/AuditoriaTimeline.vue";
import BackupManager from "../components/backup/BackupManager.vue";
import HistoricoEscola from "../components/estoque/HistoricoEscola.vue";
import { useAuth } from "../composables/useAuth";
import { useEscolas } from "../composables/useEscolas";
import { useEstoque } from "../composables/useEstoque";
import { useParametros } from "../composables/useParametros";
import { confirmarAlteracoes } from "../composables/useSaidaSegura";
import "../styles/alimentacao.css";
import { ehDeposito } from "../utils/estoque";

const router = useRouter();
const { usuario, ehGestao, ehDiretor, sair } = useAuth();
const {
  escolas,
  carregando: carregandoEscolas,
  erro: erroEscolas,
  escutarEscolas,
  criarEscola,
  ativarDeposito,
  parar: pararEscolas,
} = useEscolas({ incluirDeposito: true });
const escolaId = ref("");
const operacaoInicial = ref(null),
  formMovKey = ref(0),
  filtroItemHistorico = ref("");
const { parametros } = useParametros();
function trocarEscola(id) {
  if (id === escolaId.value || confirmarAlteracoes()) escolaId.value = id;
}
function trocarAba(id) {
  if (id === abaAtiva.value || confirmarAlteracoes()) {
    if (id === "movimentacao") {
      operacaoInicial.value = null;
      formMovKey.value++;
    }
    if (id === "historico") filtroItemHistorico.value = "";
    abaAtiva.value = id;
  }
}
const abaAtiva = ref("dashboard");
const ocupado = ref(false);
const mensagem = ref("");
const erroAcao = ref("");
const mostrarItem = ref(false);
const mostrarCatalogo = ref(false);
function fecharCatalogo() {
  if (!ocupado.value && confirmarAlteracoes()) mostrarCatalogo.value = false;
}
const itemEmEdicao = ref(null);
const mostrarEscola = ref(false);
const nomeEscola = ref("");
const erroCadastro = ref("");
const {
  itens,
  todosItens,
  inativarItem,
  reativarItem,
  carregando: carregandoEstoque,
  erro: erroEstoque,
  itensAbaixoDoMinimo,
  itensProximosDoVencimento,
  valorTotalEstoque,
  escutarEstoque,
  parar: pararEstoque,
} = useEstoque(escolaId, () => parametros.value.diasValidade);
const escolaAtual = computed(
  () => escolas.value.find((e) => e.id === escolaId.value) || { nome: "" },
);
const abas = computed(() => [
  { id: "dashboard", rotulo: "Painel geral" },
  { id: "estoque", rotulo: "Estoque" },
  { id: "movimentacao", rotulo: "Entrada / Saída" },
  { id: "historico", rotulo: "Histórico" },
  { id: "vistoria", rotulo: "Vistorias" },
  ...(ehGestao.value || ehDiretor.value
    ? [
        { id: "documentos", rotulo: "Documentos" },
        ...(!ehDeposito(escolaId.value)
          ? [{ id: "visitasAF", rotulo: "Visitas AF" }]
          : []),
      ]
    : []),
  ...(ehGestao.value
    ? [
        { id: "auditoria", rotulo: "Auditoria" },
        { id: "backup", rotulo: "Backup" },
      ]
    : []),
]);
watch(escolaId, () => {
  if (ehDeposito(escolaId.value) && abaAtiva.value === "visitasAF")
    abaAtiva.value = "estoque";
  operacaoInicial.value = null;
  filtroItemHistorico.value = "";
  formMovKey.value++;
  mostrarCatalogo.value = false;
  mostrarItem.value = false;
  mensagem.value = "";
  escutarEstoque();
});
watch(escolas, (lista) => {
  if (!lista.some((e) => e.id === escolaId.value))
    escolaId.value = lista.length === 1 ? lista[0].id : "";
});
watch(
  () => usuario.value?.uid,
  (uid) => {
    pararEstoque();
    pararEscolas();
    if (!uid) router.replace("/login");
    else escutarEscolas();
  },
);
onMounted(escutarEscolas);
onUnmounted(() => {
  pararEscolas();
  pararEstoque();
});
onBeforeRouteLeave(() => !ocupado.value);
function abrirItem(item = null) {
  itemEmEdicao.value = item;
  mostrarItem.value = true;
  mensagem.value = "";
}
function itemSalvo() {
  mostrarItem.value = false;
  mensagem.value = "Item salvo com sucesso.";
}
function concluirMovimentacao() {
  mensagem.value = "Movimentação registrada com sucesso.";
  abaAtiva.value = "estoque";
}
function iniciarMovimentacao(operacao) {
  if (ocupado.value || !confirmarAlteracoes()) return;
  operacaoInicial.value = operacao;
  formMovKey.value++;
  abaAtiva.value = "movimentacao";
  mensagem.value = "";
  erroAcao.value = "";
}
function abrirHistorico(item) {
  filtroItemHistorico.value = item.id;
  abaAtiva.value = "historico";
}
async function alterarArquivo(item, ativo) {
  if (
    ocupado.value ||
    !window.confirm(
      `${ativo ? "Reativar" : "Arquivar"} ${item.nome}? O histórico será preservado.`,
    )
  )
    return;
  ocupado.value = true;
  erroAcao.value = "";
  mensagem.value = "";
  try {
    await (ativo ? reativarItem : inativarItem)(item.id);
    mensagem.value = ativo
      ? "Item reativado."
      : "Item arquivado. Consulte-o pelo filtro Arquivados.";
  } catch (e) {
    erroAcao.value = e.code
      ? "Não foi possível alterar o item. Confira a conexão e as permissões."
      : e.message;
  } finally {
    ocupado.value = false;
  }
}
async function abrirDeposito() {
  if (ocupado.value || !confirmarAlteracoes()) return;
  ocupado.value = true;
  erroAcao.value = "";
  try {
    escolaId.value = await ativarDeposito();
    abaAtiva.value = "estoque";
    mensagem.value =
      "Depósito municipal ativado. Cadastre os produtos para começar.";
  } catch (e) {
    erroAcao.value = e.code
      ? "Não foi possível ativar o depósito. Confira a conexão e as regras publicadas."
      : e.message;
  } finally {
    ocupado.value = false;
  }
}
async function exportarEstoque() {
  erroAcao.value = "";
  try {
    const { useRelatorios } = await import("../composables/useRelatorios");
    useRelatorios().gerarRelatorioEstoque(itens.value, escolaAtual.value.nome);
  } catch {
    erroAcao.value = "Não foi possível gerar o PDF. Tente novamente.";
  }
}
async function sairDoPainel() {
  try {
    await sair();
    await router.replace("/login");
  } catch {
    erroAcao.value = "Não foi possível sair. Tente novamente.";
  }
}
async function cadastrarEscola() {
  if (ocupado.value) return;
  ocupado.value = true;
  erroCadastro.value = "";
  try {
    escolaId.value = await criarEscola({ nome: nomeEscola.value });
    nomeEscola.value = "";
    mostrarEscola.value = false;
    mensagem.value = "Escola cadastrada com sucesso.";
  } catch (e) {
    erroCadastro.value = e.code
      ? "Não foi possível cadastrar. Verifique a conexão e as permissões."
      : e.message;
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
.painel {
  max-width: 1240px;
  margin: auto;
  padding: 32px 20px 64px;
}
.painel-topo,
.barra-escolas,
.sessao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.painel-topo {
  margin-bottom: 28px;
}
.painel-topo h1 {
  font-size: clamp(1.375rem, 3vw, 1.875rem);
  color: #17332f;
  line-height: 1.3;
  margin: 5px 0 8px;
}
.painel-topo p,
.sessao {
  font-size: 0.875rem;
}
.sobretitulo {
  font-weight: 700;
  letter-spacing: 1px;
  color: #037770;
}
.barra-escolas {
  padding: 18px;
  background: #fff;
  border: 1px solid #dfe9e6;
  border-radius: 12px;
  margin-bottom: 24px;
}
.seletor {
  border: 0;
  min-width: 0;
  flex: 1;
}
.abas {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  border-bottom: 1px solid #dfe9e6;
  margin-bottom: 24px;
}
.abas button {
  padding: 12px 15px;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
  font-size: 0.875rem;
  font-weight: 600;
}
.abas button.ativo {
  color: #037770;
  border-color: #037770;
}
.unidade-atual {
  padding: 16px;
  background: #edf5f1;
  border-radius: 10px;
  margin-bottom: 16px;
}
.unidade-atual p {
  font-size: 0.875rem;
  margin-top: 6px;
}
.conteudo {
  min-width: 0;
}
.estado {
  padding: 32px 12px;
  text-align: center;
}
.estado h2 {
  font-size: 1.25rem;
  margin-bottom: 10px;
}
.dialogo {
  padding: 26px;
}
.dialogo h2 {
  margin-bottom: 22px;
  font-size: 1.375rem;
}
@media (max-width: 600px) {
  .painel {
    padding: 24px 14px 44px;
  }
  .sessao {
    width: 100%;
  }
  .barra-escolas {
    align-items: stretch;
    flex-direction: column;
  }
  .dialogo {
    padding: 20px;
  }
}
</style>
