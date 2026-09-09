<template>
  <div class="vistoria-form">
    <div
      v-if="sucesso"
      ref="feedbackEl"
      class="vistoria-form__sucesso"
      role="status"
      tabindex="-1"
    >
      <h3>Vistoria salva com sucesso</h3>
      <p>
        Os dados e as identificações foram registrados. A vistoria está
        disponível no histórico abaixo.
      </p>
      <button type="button" class="btn-primario" @click="novaVistoria">
        Nova vistoria
      </button>
    </div>
    <template v-else>
      <fieldset
        :disabled="etapa === 'identificacao' || processando"
        style="border: 0; min-width: 0"
      >
        <label class="campo">
          <span>Tipo de vistoria</span>
          <select v-model="tipo" @change="carregarTemplate">
            <option value="recebimento">Recebimento de mercadorias</option>
            <option value="sanitaria">Sanitária</option>
            <option value="estrutural">Estrutural</option>
            <option value="rotina">Rotina do refeitório</option>
          </select>
        </label>

        <p class="progresso-avaliacao">
          {{ checklist.length - respostasPendentes }} de
          {{ checklist.length }} itens avaliados. Marque cada item para
          continuar.
        </p>
        <ul class="checklist">
          <li
            v-for="(check, idx) in checklist"
            :key="idx"
            class="checklist__item"
          >
            <div class="checklist__topo">
              <input
                v-if="check.custom"
                v-model="check.item"
                aria-label="Item específico da vistoria"
                maxlength="300"
                placeholder="Descreva o item"
              />
              <span v-else>{{ check.item }}</span>
              <div class="checklist__opcoes">
                <button
                  type="button"
                  :class="{ ativo: check.status === 'conforme' }"
                  :aria-pressed="check.status === 'conforme'"
                  class="op op--ok"
                  @click="check.status = 'conforme'"
                >
                  Conforme
                </button>
                <button
                  type="button"
                  :class="{ ativo: check.status === 'nao_conforme' }"
                  :aria-pressed="check.status === 'nao_conforme'"
                  class="op op--erro"
                  @click="check.status = 'nao_conforme'"
                >
                  Não conforme
                </button>
                <button
                  type="button"
                  :class="{ ativo: check.status === 'nao_aplicavel' }"
                  :aria-pressed="check.status === 'nao_aplicavel'"
                  class="op op--neutro"
                  @click="check.status = 'nao_aplicavel'"
                >
                  N/A
                </button>
              </div>
              <button
                v-if="check.custom"
                type="button"
                class="link-add"
                @click="checklist.splice(idx, 1)"
              >
                Remover item específico
              </button>
            </div>
            <input
              v-if="check.status === 'nao_conforme'"
              v-model="check.observacao"
              type="text"
              class="checklist__obs"
              placeholder="Descreva a não conformidade..."
              :aria-label="`Observação: ${check.item}`"
              maxlength="3000"
            />
          </li>
        </ul>

        <button
          type="button"
          class="link-add"
          :disabled="checklist.length >= 8"
          @click="adicionarItemCustom"
        >
          + Adicionar item específico
        </button>
        <p class="progresso-avaliacao">
          Até 8 itens por vistoria, incluindo os itens específicos.
        </p>

        <label v-if="temPendencias" class="campo campo--largo">
          <span>Plano de ação (obrigatório para não conformidades)</span>
          <textarea
            v-model="planoDeAcao"
            maxlength="5000"
            rows="3"
            placeholder="O que será feito, por quem e até quando"
          />
        </label>

        <div class="vistoria-form__resumo">
          <span
            >Nota:
            <strong>{{
              respostasPendentes
                ? "Aguardando avaliação"
                : notaCalculada === null
                  ? "Não se aplica"
                  : notaCalculada + "/10"
            }}</strong></span
          >
          <span class="status" :class="statusCalculado">{{
            rotuloStatus
          }}</span>
        </div>

        <div class="vistoria-form__acoes">
          <button type="button" class="btn-primario" @click="avancar">
            Continuar para identificação
          </button>
        </div>
      </fieldset>
      <p v-if="erro && etapa !== 'identificacao'" class="erro" role="alert">
        {{ erro }}
      </p>
      <div v-if="etapa === 'identificacao'" class="vistoria-form__assinatura">
        <p>
          Informe os dados do responsável e da testemunha. Depois clique em
          <strong>Salvar vistoria</strong>.
        </p>
        <h4>Responsável pela vistoria</h4>
        <div v-if="identificacaoResponsavel" class="identificacao-confirmada">
          <p>
            <strong>{{ identificacaoResponsavel.nomeSignatario }}</strong> · CPF
            {{ mascararCpf(identificacaoResponsavel.cpf) }}
          </p>
          <button
            v-if="!tentouSalvar"
            type="button"
            class="btn-secundario"
            :disabled="processando"
            @click="editarResponsavel"
          >
            Editar responsável
          </button>
        </div>
        <AssinaturaDigital
          v-else
          key="responsavel"
          :enviando="processando"
          :nome-padrao="
            rascunhoResponsavel?.nomeSignatario || usuario?.nome || ''
          "
          :cpf-padrao="rascunhoResponsavel?.cpf || ''"
          :papel-padrao="
            rascunhoResponsavel?.papelSignatario || usuario?.papel || 'diretor'
          "
          @confirmar="confirmarResponsavel"
        />
        <h4>Acompanhante / testemunha</h4>
        <div v-if="identificacaoTestemunha" class="identificacao-confirmada">
          <p>
            <strong>{{ identificacaoTestemunha.nomeSignatario }}</strong> · CPF
            {{ mascararCpf(identificacaoTestemunha.cpf) }}
          </p>
          <button
            v-if="!tentouSalvar"
            type="button"
            class="btn-secundario"
            :disabled="processando"
            @click="editarTestemunha"
          >
            Editar testemunha
          </button>
        </div>
        <AssinaturaDigital
          v-else
          key="testemunha"
          :enviando="processando"
          :nome-padrao="rascunhoTestemunha?.nomeSignatario || ''"
          :cpf-padrao="rascunhoTestemunha?.cpf || ''"
          :papel-padrao="rascunhoTestemunha?.papelSignatario || 'diretor'"
          @confirmar="confirmarTestemunha"
        />
        <div ref="feedbackEl" tabindex="-1">
          <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
          <p v-if="processando" role="status">
            Registrando a vistoria e as identificações…
          </p>
          <p v-else-if="identificacoesProntas && !erro">
            Identificações confirmadas. Falta salvar a vistoria.
          </p>
          <div class="vistoria-form__acoes">
            <button
              type="button"
              class="btn-primario"
              :disabled="!identificacoesProntas || processando"
              @click="finalizar"
            >
              {{
                processando
                  ? "Salvando vistoria…"
                  : tentouSalvar
                    ? "Tentar salvar novamente"
                    : "Salvar vistoria"
              }}
            </button>
            <button
              v-if="!tentouSalvar"
              type="button"
              class="btn-secundario"
              :disabled="processando"
              @click="voltar"
            >
              Voltar aos dados
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, nextTick } from "vue";
import { useSaidaSegura } from '../../composables/useSaidaSegura';
import { doc, collection } from "firebase/firestore";
import { db } from "../../firebase";
import AssinaturaDigital from "../assinatura/AssinaturaDigital.vue";
import {
  useVistorias,
  TEMPLATES_CHECKLIST,
} from "../../composables/useVistorias";
import { useAssinaturas } from "../../composables/useAssinaturas";
import { useAuth } from "../../composables/useAuth";
import { validarIdentificacao, mascararCpf } from "../../utils/identificacao";

const props = defineProps({ escolaId: { type: String, required: true } });
const emit = defineEmits(["concluido", "ocupado"]);
const { usuario } = useAuth();
const tipo = ref("recebimento");
const checklist = ref([]);
const planoDeAcao = ref(""),
  erro = ref(""),
  etapa = ref("form");
const processando = ref(false),
  tentouSalvar = ref(false),
  sucesso = ref(false);
const identificacaoResponsavel = ref(null),
  identificacaoTestemunha = ref(null);
const rascunhoResponsavel = ref(null),
  rascunhoTestemunha = ref(null);
const feedbackEl = ref(null);
useSaidaSegura(() => !sucesso.value && (etapa.value !== 'form' || !!planoDeAcao.value || checklist.value.some(c => !!c.status)));
let vistoriaId, dadosConfirmados;
let preparadas = [];
const { registrarVistoria, calcularNota, calcularStatus } = useVistorias(
  props.escolaId,
);
const { prepararIdentificacao } = useAssinaturas(props.escolaId);
const respostasPendentes = computed(
  () => checklist.value.filter((c) => !c.status).length,
);
const temPendencias = computed(() =>
  checklist.value.some((c) => c.status === "nao_conforme"),
);
const notaCalculada = computed(() => calcularNota(checklist.value));
const statusCalculado = computed(() => calcularStatus(checklist.value));
const rotuloStatus = computed(
  () =>
    ({
      conforme: "Conforme",
      conforme_com_ressalvas: "Conforme com ressalvas",
      nao_conforme: "Não conforme",
      nao_aplicavel: "Não se aplica",
      pendente: "Avaliação pendente",
    })[statusCalculado.value],
);
const identificacoesProntas = computed(
  () =>
    !!identificacaoResponsavel.value &&
    !!identificacaoTestemunha.value &&
    identificacaoResponsavel.value.cpf !== identificacaoTestemunha.value.cpf,
);
function carregarTemplate() {
  checklist.value = TEMPLATES_CHECKLIST[tipo.value].map((item) => ({
    item,
    status: null,
    observacao: "",
  }));
  planoDeAcao.value = "";
  erro.value = "";
}
carregarTemplate();
function adicionarItemCustom() {
  if (checklist.value.length >= 8) return;
  checklist.value.push({
    item: "",
    status: null,
    observacao: "",
    custom: true,
  });
}
function avancar() {
  if (processando.value || etapa.value === "identificacao") return;
  erro.value = "";
  if (respostasPendentes.value) {
    erro.value = "Avalie todos os itens do checklist antes de continuar.";
    return;
  }
  if (temPendencias.value && !planoDeAcao.value.trim()) {
    erro.value =
      "Descreva o plano de ação para as não conformidades encontradas.";
    return;
  }
  if (checklist.value.some((c) => !c.item.trim())) {
    erro.value = "Preencha a descrição dos itens específicos.";
    return;
  }
  vistoriaId = doc(collection(db, "escolas", props.escolaId, "vistorias")).id;
  dadosConfirmados = {
    tipo: tipo.value,
    checklist: checklist.value.map(({ item, status, observacao }) => ({
      item: item.trim(),
      status,
      observacao: observacao.trim(),
    })),
    planoDeAcao: temPendencias.value ? planoDeAcao.value.trim() : null,
  };
  preparadas = [];
  tentouSalvar.value = false;
  etapa.value = "identificacao";
}
function voltar() {
  if (processando.value || tentouSalvar.value) return;
  identificacaoResponsavel.value = null;
  identificacaoTestemunha.value = null;
  etapa.value = "form";
  erro.value = "";
}
function confirmarPessoa(dados, alvo, outra) {
  if (processando.value || tentouSalvar.value) return;
  try {
    const pessoa = validarIdentificacao(dados);
    if (outra.value?.cpf === pessoa.cpf)
      throw new Error(
        "O responsável e a testemunha precisam ter CPFs diferentes.",
      );
    alvo.value = pessoa;
    preparadas = [];
    erro.value = "";
  } catch (e) {
    erro.value = e.message;
  }
}
function confirmarResponsavel(dados) {
  confirmarPessoa(dados, identificacaoResponsavel, identificacaoTestemunha);
}
function confirmarTestemunha(dados) {
  confirmarPessoa(dados, identificacaoTestemunha, identificacaoResponsavel);
}
function editarResponsavel() {
  if (!processando.value && !tentouSalvar.value) {
    rascunhoResponsavel.value = identificacaoResponsavel.value;
    identificacaoResponsavel.value = null;
    erro.value = "";
  }
}
function editarTestemunha() {
  if (!processando.value && !tentouSalvar.value) {
    rascunhoTestemunha.value = identificacaoTestemunha.value;
    identificacaoTestemunha.value = null;
    erro.value = "";
  }
}
async function finalizar() {
  if (processando.value || !identificacoesProntas.value || sucesso.value)
    return;
  processando.value = true;
  emit("ocupado", true);
  erro.value = "";
  try {
    const pessoas = [
      identificacaoResponsavel.value,
      identificacaoTestemunha.value,
    ];
    for (let i = 0; i < pessoas.length; i++) {
      if (preparadas[i]) continue;
      preparadas[i] = await prepararIdentificacao(
        pessoas[i],
        {
          cargoDocumento: i === 0 ? "responsavel" : "testemunha",
          documentoTipo: "vistoria",
          documentoId: vistoriaId,
          documentoDados: dadosConfirmados,
        },
        `${vistoriaId}-${i === 0 ? "responsavel" : "testemunha"}`,
      );
    }
    tentouSalvar.value = true;
    await registrarVistoria({
      ...dadosConfirmados,
      vistoriaId,
      assinaturas: preparadas,
    });
    sucesso.value = true;
    emit("concluido", vistoriaId);
  } catch (e) {
    console.error("Confirmação da vistoria falhou:", e.code || e.message);
    erro.value =
      e.code === "permission-denied"
        ? "O Firestore negou o registro. Confira as regras publicadas e o perfil da sua conta. (permission-denied)"
        : e.message ||
          "Não foi possível confirmar a vistoria. Tente novamente nesta tela.";
  } finally {
    processando.value = false;
    emit("ocupado", false);
    await nextTick();
    feedbackEl.value?.focus({ preventScroll: true });
    feedbackEl.value?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
function novaVistoria() {
  carregarTemplate();
  etapa.value = "form";
  identificacaoResponsavel.value = null;
  identificacaoTestemunha.value = null;
  rascunhoResponsavel.value = null;
  rascunhoTestemunha.value = null;
  preparadas = [];
  tentouSalvar.value = false;
  sucesso.value = false;
  erro.value = "";
}
</script>
<style scoped>
.vistoria-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--cor-texto-suave, #52606d);
}
.campo select,
.campo textarea {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: inherit;
}
.checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.checklist__item {
  border: 1px solid var(--cor-borda, #e4e7eb);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
}
.checklist__topo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.checklist__topo span {
  font-size: 0.85rem;
}
.checklist__opcoes {
  display: flex;
  gap: 0.35rem;
}
.op {
  border: 1px solid var(--cor-borda, #d9dee3);
  background: #fff;
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font-size: 0.72rem;
  cursor: pointer;
  color: #52606d;
}
.op--ok.ativo {
  background: #e3f3e6;
  border-color: #3c6e47;
  color: #245530;
}
.op--erro.ativo {
  background: #fbe4e1;
  border-color: #c0392b;
  color: #96281b;
}
.op--neutro.ativo {
  background: #eceff1;
  border-color: #9aa5b1;
  color: #52606d;
}
.checklist__obs {
  margin-top: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  border: 1px solid #f1c0b8;
  font-size: 0.85rem;
}
.link-add {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--cor-primaria, #3c6e47);
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
}
.vistoria-form__resumo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  background: #f6f8f7;
  font-size: 0.85rem;
}
.status {
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
}
.status.conforme {
  background: #e3f3e6;
  color: #245530;
}
.status.conforme_com_ressalvas {
  background: #fdf1dc;
  color: #8a5a10;
}
.status.nao_conforme {
  background: #fbe4e1;
  color: #96281b;
}
.erro {
  color: #c0392b;
  font-size: 0.85rem;
  margin: 0;
}
.vistoria-form__acoes {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.btn-primario {
  padding: 0.65rem 1.2rem;
  border-radius: 8px;
  border: none;
  background: var(--cor-primaria, #3c6e47);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.vistoria-form__assinatura {
  border-top: 1px solid var(--cor-borda, #e4e7eb);
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.vistoria-form__assinatura h4 {
  margin: 0;
}
.identificacao-confirmada {
  padding: 0.8rem;
  background: #edf5f1;
  border: 1px solid #dfe9e6;
  border-radius: 8px;
}
.checklist__opcoes {
  flex-wrap: wrap;
}
.progresso-avaliacao {
  color: var(--cor-texto-suave, #52606d);
}
.vistoria-form__sucesso {
  padding: 1.2rem;
  background: #e3f3e6;
  border-radius: 10px;
  color: #245530;
}
.btn-primario:disabled,
.btn-secundario:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-secundario {
  padding: 0.65rem 1.2rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
</style>
