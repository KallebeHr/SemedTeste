<template>
  <div class="backup">
    <p class="backup__descricao">
      Exportação parcial da alimentação: baixe os dados de estoque,
      movimentações, vistorias, identificações e auditoria das escolas
      selecionadas. O arquivo é salvo no seu computador.
    </p>
    <div class="backup__selecao">
      <label v-for="escola in escolas" :key="escola.id" class="check"
        ><input
          v-model="selecionadas"
          :disabled="gerando"
          type="checkbox"
          :value="escola.id"
        />{{ escola.nome }}</label
      >
    </div>
    <div class="backup__acoes">
      <button
        class="btn-secundario"
        :disabled="gerando"
        @click="selecionarTodas"
      >
        {{ todasSelecionadas ? "Desmarcar todas" : "Selecionar todas" }}
      </button>
      <button
        class="btn-primario"
        :disabled="!selecionadas.length || gerando"
        @click="executar"
      >
        {{
          gerando
            ? `Coletando dados… ${progresso}%`
            : "Baixar exportação parcial"
        }}
      </button>
    </div>
    <div
      v-if="gerando"
      class="backup__progresso"
      role="progressbar"
      aria-label="Geração do backup"
      :aria-valuenow="progresso"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="backup__progresso-barra"
        :style="{ width: progresso + '%' }"
      />
    </div>
    <p v-if="erro" class="backup__erro" role="alert">{{ erro }}</p>
    <p v-if="erroDownload" class="backup__erro" role="alert">
      {{ erroDownload }}
    </p>
    <div v-if="resultado">
      <p class="backup__ok" role="status">
        Cópia local pronta: {{ resultado.totalDocumentos }} documentos. Se o
        download não começou, use o botão abaixo.
      </p>
      <button class="btn-secundario" @click="baixarLocal">
        Baixar cópia local
      </button>
    </div>
    <hr />
    <p class="backup__descricao">
      O arquivo inclui os CPFs informados. Guarde a cópia em local de acesso
      restrito. Registros antigos conservam os links das imagens, mas as imagens
      não são baixadas. Esta exportação não inclui alunos, notas, contas e novos
      cardápios do portal. O Master encontra o backup completo e a recuperação
      em Administração → Recuperação.
    </p>
  </div>
</template>
<script setup>
import { ref, computed, watch } from "vue";
import { useBackup } from "../../composables/useBackup";
const props = defineProps({ escolas: { type: Array, default: () => [] } });
const emit = defineEmits(["ocupado"]);
const selecionadas = ref([]),
  resultado = ref(null),
  erroDownload = ref("");
const { gerando, progresso, erro, gerarBackup, baixarJsonLocal } = useBackup();
const todasSelecionadas = computed(
  () =>
    props.escolas.length > 0 &&
    props.escolas.every((e) => selecionadas.value.includes(e.id)),
);
watch(
  () => props.escolas,
  (lista) => {
    selecionadas.value = selecionadas.value.filter((id) =>
      lista.some((e) => e.id === id),
    );
  },
);
function selecionarTodas() {
  selecionadas.value = todasSelecionadas.value
    ? []
    : props.escolas.map((e) => e.id);
}
async function executar() {
  if (gerando.value) return;
  erroDownload.value = "";
  emit("ocupado", true);
  try {
    resultado.value = await gerarBackup([...selecionadas.value]);
    baixarLocal();
  } catch {
    /* A mensagem é fornecida pelo composable. A cópia anterior permanece disponível. */
  } finally {
    emit("ocupado", false);
  }
}
function baixarLocal() {
  if (!resultado.value) return;
  erroDownload.value = "";
  try {
    baixarJsonLocal(resultado.value.json, resultado.value.nomeArquivo);
  } catch {
    erroDownload.value =
      "Não foi possível iniciar o download. Tente pelo botão Baixar cópia local.";
  }
}
</script>
<style scoped>
.backup__descricao {
  font-size: 0.85rem;
  color: var(--cor-texto-suave, #52606d);
  line-height: 1.5;
}
.backup__selecao {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.5rem;
  margin: 1rem 0;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  border: 1px solid var(--cor-borda, #e4e7eb);
  border-radius: 8px;
  padding: 0.5rem 0.7rem;
}
.backup__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.btn-primario,
.btn-secundario {
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-primario {
  background: var(--cor-primaria, #3c6e47);
  color: #fff;
}
.btn-primario:disabled,
.btn-secundario:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-secundario {
  background: transparent;
  border: 1px solid var(--cor-borda, #d9dee3);
  color: var(--cor-texto-suave, #52606d);
}
.backup__progresso {
  height: 8px;
  border-radius: 999px;
  background: #eceff1;
  margin-top: 0.75rem;
  overflow: hidden;
}
.backup__progresso-barra {
  height: 100%;
  background: var(--cor-primaria, #3c6e47);
  transition: width 0.2s ease;
}
.backup__erro {
  color: #c0392b;
  font-size: 0.85rem;
}
.backup__ok {
  color: #245530;
  font-size: 0.85rem;
}
hr {
  margin: 1.5rem 0;
  border: none;
  border-top: 1px solid var(--cor-borda, #e4e7eb);
}
h4 {
  margin-bottom: 0.4rem;
}
</style>
