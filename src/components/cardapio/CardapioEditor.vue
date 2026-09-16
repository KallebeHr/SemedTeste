<template>
  <section class="editor-cardapio p-stack">
    <header class="editor-intro">
      <div>
        <p class="p-eyebrow">PLANEJAMENTO MENSAL</p>
        <h3>Um cardápio para cada dia</h3>
        <p>
          Preencha os dois lanches de cada data. As semanas são independentes.
        </p>
      </div>
      <span class="p-badge" role="status"
        >{{ progresso.completos }} de {{ progresso.total }} dias completos</span
      >
    </header>
    <div class="p-grid two">
      <label class="p-field"
        >Mês da grade<input
          type="month"
          min="2000-01"
          max="2099-12"
          :value="modelValue.mes"
          @change="trocarMes($event.target.value, $event.target)"
      /></label>
      <label class="p-field"
        >Etapa de ensino<input
          :value="modelValue.etapa"
          maxlength="100"
          @input="campo('etapa', $event.target.value)"
      /></label>
      <label class="p-field"
        >Turno<input
          :value="modelValue.turno"
          maxlength="60"
          placeholder="PARCIAL, INTEGRAL, MANHÃ..."
          @input="campo('turno', $event.target.value)"
      /></label>
    </div>
    <p v-if="aviso" role="status" class="p-alert">{{ aviso }}</p>
    <div class="semanas" role="group" aria-label="Selecionar semana">
      <button
        v-for="s in semanas"
        :key="s.indice"
        type="button"
        class="p-button"
        :class="{ primary: ativa === s.indice }"
        :aria-pressed="ativa === s.indice"
        @click="ativa = s.indice"
      >
        Semana {{ s.indice + 1 }} · {{ s.rotulo }}
      </button>
    </div>
    <div class="p-section-head">
      <h4>Semana {{ ativa + 1 }} — {{ atual?.rotulo }}</h4>
      <button v-if="ativa > 0" type="button" class="p-button" @click="repetir">
        Copiar semana anterior
      </button>
    </div>
    <div class="dias-editor">
      <article
        v-for="(dia, i) in atual?.dias"
        :key="`${modelValue.mes}-${dia}-${i}`"
        class="dia-editor"
        :class="{ inativo: !dia }"
      >
        <template v-if="dia"
          ><h4>
            {{ DIAS_SEMANA[i] }}
            <span
              >{{ String(dia).padStart(2, "0") }}/{{
                modelValue.mes.slice(5)
              }}</span
            >
          </h4>
          <label class="p-field"
            >Situação do dia {{ dia
            }}<select
              :value="modelValue.dias[dia - 1].situacao"
              @change="situacao(dia, $event.target.value, $event.target)"
            >
              <option value="letivo">Com alimentação</option>
              <option value="feriado">Feriado</option>
              <option value="sem_aula">Sem aula</option>
            </select></label
          >
          <template v-if="modelValue.dias[dia - 1].situacao === 'letivo'">
            <label class="p-field"
              >1º lanche · dia {{ dia
              }}<textarea
                :value="modelValue.dias[dia - 1].primeiro"
                rows="2"
                maxlength="300"
                placeholder="Ex.: FRUTA"
                @input="campoDia(dia, 'primeiro', $event.target.value)"
              />
            </label>
            <label class="p-field"
              >2º lanche · dia {{ dia
              }}<textarea
                :value="modelValue.dias[dia - 1].segundo"
                rows="5"
                maxlength="500"
                placeholder="Uma preparação por linha"
                @input="campoDia(dia, 'segundo', $event.target.value)"
              />
            </label>
          </template>
          <label v-else class="p-field"
            >Descrição · dia {{ dia
            }}<input
              :value="modelValue.dias[dia - 1].evento"
              maxlength="80"
              placeholder="FERIADO ou motivo da suspensão"
              @input="campoDia(dia, 'evento', $event.target.value)"
          /></label>
          <details>
            <summary>Observação pública do dia {{ dia }}</summary>
            <label class="p-field"
              >Observação · dia {{ dia
              }}<textarea
                :value="modelValue.dias[dia - 1].observacao"
                rows="2"
                maxlength="200"
                placeholder="Será exibida no rodapé. Não inclua dados pessoais."
                @input="campoDia(dia, 'observacao', $event.target.value)"
              />
            </label>
          </details> </template
        ><template v-else
          ><h4>{{ DIAS_SEMANA[i] }}</h4>
          <p>Fora deste mês</p></template
        >
      </article>
    </div>
    <label class="p-field"
      >Observações gerais do cardápio<textarea
        :value="modelValue.observacoes"
        rows="3"
        maxlength="1000"
        @input="campo('observacoes', $event.target.value)"
      />
    </label>
    <details class="preview" open>
      <summary>Prévia da folha que será publicada</summary>
      <p class="p-small">
        Em telas pequenas, deslize a tabela para os lados. O PDF mantém a folha
        em paisagem.
      </p>
      <CardapioFolha
        :cardapio="modelValue"
        :escola="escola"
        :responsavel="responsavel"
      />
    </details>
  </section>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import CardapioFolha from "./CardapioFolha.vue";
import {
  DIAS_SEMANA,
  semanasDoMes,
  novoCardapio,
  copiarSemana,
  progressoCardapio,
  mesValido,
} from "../../portal/cardapioMensal";
const props = defineProps({
  modelValue: { type: Object, required: true },
  escola: { type: String, default: "" },
  responsavel: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);
const ativa = ref(0),
  aviso = ref("");
const semanas = computed(() => semanasDoMes(props.modelValue.mes)),
  atual = computed(() => semanas.value[ativa.value]),
  progresso = computed(() => progressoCardapio(props.modelValue));
watch(
  () => props.modelValue.mes,
  () => {
    ativa.value = 0;
  },
);
function campo(k, v) {
  emit("update:modelValue", { ...props.modelValue, [k]: v });
}
function campoDia(d, k, v) {
  const dias = props.modelValue.dias.map((item, i) =>
    i === d - 1 ? { ...item, [k]: v } : item,
  );
  emit("update:modelValue", { ...props.modelValue, dias });
}
function situacao(d, value, select) {
  const antes = props.modelValue.dias[d - 1];
  if (
    value !== "letivo" &&
    (antes.primeiro || antes.segundo) &&
    !window.confirm(
      "Mudar a situação deste dia apagará os dois lanches dele. Continuar?",
    )
  ) {
    select.value = antes.situacao;
    aviso.value = "Situação preservada. Os lanches não foram apagados.";
    return;
  }
  const dias = props.modelValue.dias.map((item, i) =>
    i === d - 1
      ? {
          ...item,
          situacao: value,
          primeiro: value === "letivo" ? item.primeiro : "",
          segundo: value === "letivo" ? item.segundo : "",
          evento: "",
        }
      : item,
  );
  emit("update:modelValue", { ...props.modelValue, dias });
}
function trocarMes(mes, input) {
  if (mes === props.modelValue.mes) return;
  if (!mesValido(mes)) {
    input.value = props.modelValue.mes;
    aviso.value = "Escolha um mês válido entre 2000 e 2099.";
    return;
  }
  if (
    !window.confirm(
      "Trocar o mês vai criar uma grade vazia para o novo período. O conteúdo desta grade será substituído. Continuar?",
    )
  ) {
    input.value = props.modelValue.mes;
    return;
  }
  const g = novoCardapio(mes);
  emit("update:modelValue", {
    ...g,
    etapa: props.modelValue.etapa,
    turno: props.modelValue.turno,
    observacoes: props.modelValue.observacoes,
  });
  aviso.value = "Nova grade criada. Confira as datas e preencha os lanches.";
}
function repetir() {
  if (
    !window.confirm(
      "Copiar os mesmos dias da semana anterior? Os dados correspondentes desta semana, incluindo feriados, serão substituídos.",
    )
  )
    return;
  emit(
    "update:modelValue",
    copiarSemana(props.modelValue, ativa.value - 1, ativa.value),
  );
  aviso.value =
    "Semana copiada. Revise as datas, feriados e alimentos antes de publicar.";
}
</script>
<style scoped>
.editor-cardapio {
  min-width: 0;
}
.editor-intro {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.editor-intro h3 {
  font-size: 1.35rem;
  margin: 0.25rem 0;
}
.editor-intro p {
  margin: 0.35rem 0;
}
.semanas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.dias-editor {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.65rem;
}
.dia-editor {
  border: 1px solid var(--p-border, #dae6e3);
  border-radius: 12px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  background: var(--p-surface, #fff);
}
.dia-editor h4 {
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
}
.dia-editor h4 span {
  font-size: 1.25rem;
  color: var(--p-primary, #007b74);
}
.dia-editor textarea {
  width: 100%;
  resize: vertical;
  line-height: 1.4;
}
.dia-editor .p-field {
  font-size: 0.8rem;
}
.inativo {
  background: var(--p-bg, #f4f8f7);
  color: var(--p-muted, #52666a);
}
.preview summary {
  font-weight: 700;
  cursor: pointer;
}
.dia-editor summary {
  font-size: 0.8rem;
  cursor: pointer;
}
.preview {
  min-width: 0;
}
.editor-cardapio :focus-visible {
  outline: 3px solid #007b74;
  outline-offset: 2px;
}
@media (max-width: 1150px) {
  .dias-editor {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .dias-editor {
    grid-template-columns: 1fr;
  }
  .editor-intro {
    flex-direction: column;
  }
  .inativo {
    display: none;
  }
}
</style>
