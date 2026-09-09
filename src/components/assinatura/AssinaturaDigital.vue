<template>
  <form class="identificacao" @submit.prevent="confirmar" novalidate>
    <div class="identificacao__campos">
      <label class="campo"
        ><span>Nome completo (nome e sobrenome)</span>
        <input
          v-model="nomeSignatario"
          :disabled="enviando"
          type="text"
          autocomplete="off"
          maxlength="160"
          placeholder="Nome e sobrenome"
          required
          @input="erroLocal = ''"
        />
      </label>
      <label class="campo"
        ><span>CPF</span>
        <input
          :value="cpf"
          :disabled="enviando"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          maxlength="14"
          placeholder="000.000.000-00"
          required
          @input="atualizarCpf"
        />
      </label>
      <label class="campo"
        ><span>Função</span>
        <select v-model="papelSignatario" :disabled="enviando">
          <option value="nutricionista">Nutricionista</option>
          <option value="gerente">Gerente</option>
          <option value="diretor">Diretor(a) da escola</option>
          <option value="professor">Professor(a)</option>
          <option value="master">Master</option>
          <option value="admin">Administrador(a)</option>
          <option value="outro">Outra função</option>
        </select>
      </label>
    </div>
    <p v-if="erroLocal" class="identificacao__erro" role="alert">
      {{ erroLocal }}
    </p>
    <div class="identificacao__acoes">
      <button type="submit" :disabled="enviando" class="btn-primario">
        Confirmar identificação
      </button>
    </div>
  </form>
</template>
<script setup>
import { ref } from "vue";
import { formatarCpf, validarIdentificacao } from "../../utils/identificacao";
const props = defineProps({
  papelPadrao: { type: String, default: "professor" },
  nomePadrao: { type: String, default: "" },
  cpfPadrao: { type: String, default: "" },
  enviando: { type: Boolean, default: false },
});
const emit = defineEmits(["confirmar"]);
const nomeSignatario = ref(props.nomePadrao),
  cpf = ref(formatarCpf(props.cpfPadrao)),
  papelSignatario = ref(props.papelPadrao),
  erroLocal = ref("");
function atualizarCpf(evento) {
  cpf.value = formatarCpf(evento.target.value);
  evento.target.value = cpf.value;
  erroLocal.value = "";
}
function confirmar() {
  if (props.enviando) return;
  try {
    const dados = validarIdentificacao({
      nomeSignatario: nomeSignatario.value,
      cpf: cpf.value,
      papelSignatario: papelSignatario.value,
    });
    erroLocal.value = "";
    emit("confirmar", dados);
  } catch (e) {
    erroLocal.value = e.message;
  }
}
</script>
<style scoped>
.identificacao {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.identificacao__campos {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 0.8rem;
}
.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.campo input,
.campo select {
  width: 100%;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  background: #fff;
  font: inherit;
}
.identificacao__acoes {
  display: flex;
  justify-content: flex-end;
}
.btn-primario {
  background: var(--cor-primaria, #007b74);
  color: white;
  border: 0;
  border-radius: 8px;
  padding: 0.75rem 1.1rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.identificacao__erro {
  color: #b42318;
  margin: 0;
}
@media (max-width: 760px) {
  .identificacao__campos {
    grid-template-columns: 1fr;
  }
}
</style>
