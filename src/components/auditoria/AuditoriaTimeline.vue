<template>
  <div class="auditoria">
    <div class="auditoria__filtros">
      <select v-model="filtroColecao" aria-label="Filtrar auditoria por coleção" @change="aplicarFiltros">
        <option value="">Todas as coleções</option>
        <option value="estoque">Estoque</option>
        <option value="movimentacoes">Movimentações</option>
        <option value="vistorias">Vistorias</option>
        <option value="assinaturas">Assinaturas</option>
        <option value="escolas">Escolas</option>
      </select>
    </div>

    <label
      ><input v-model="legado" type="checkbox" @change="aplicarFiltros" />
      Consultar histórico anterior à versão 2</label
    >
    <p v-if="erro" role="alert">{{ erro }}</p>
    <p v-if="carregando">Carregando auditoria...</p>
    <ol class="auditoria__linha">
      <li v-for="reg in registros" :key="reg.id" class="registro">
        <span class="registro__ponto" :class="reg.acao" />
        <div class="registro__corpo">
          <header>
            <strong>{{ rotuloAcao(reg.acao) }}</strong> em
            <em>{{ reg.colecao }}</em>
            <span class="registro__data">{{
              formatarData(reg.timestamp)
            }}</span>
          </header>
          <p class="registro__autor">
            {{ reg.usuarioNome }} · {{ reg.papelUsuario }}
          </p>
          <p v-if="reg.camposAlterados?.length" class="registro__campos">
            Campos alterados: {{ reg.camposAlterados.join(", ") }}
          </p>
        </div>
      </li>
      <li v-if="!registros.length && !carregando" class="vazio">
        Nenhum registro de auditoria ainda.
      </li>
    </ol>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, ref } from "vue";
import { useAuditoria } from "../../composables/useAuditoria";

const props = defineProps({
  escolaId: { type: String, default: null },
});

const filtroColecao = ref("");
const legado = ref(false);
const { registros, carregando, erro, escutar, parar } = useAuditoria();

function aplicarFiltros() {
  escutar({
    legado: legado.value,
    escolaId: props.escolaId,
    colecao: filtroColecao.value || null,
  });
}

onMounted(aplicarFiltros);
onUnmounted(parar);
watch(() => props.escolaId, aplicarFiltros);

function rotuloAcao(acao) {
  return (
    { create: "Criação", update: "Alteração", delete: "Remoção" }[acao] ?? acao
  );
}

function formatarData(ts) {
  if (!ts) return "—";
  const data = ts.toDate ? ts.toDate() : new Date(ts);
  return data.toLocaleString("pt-BR");
}
</script>

<style scoped>
.auditoria__filtros {
  margin-bottom: 1rem;
}
.auditoria__filtros select {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--cor-borda, #d9dee3);
  font-size: 0.85rem;
}
.auditoria__linha {
  list-style: none;
  margin: 0;
  padding: 0;
  border-left: 2px solid var(--cor-borda, #e4e7eb);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.registro {
  position: relative;
  padding-left: 1.2rem;
}
.registro__ponto {
  position: absolute;
  left: -6px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9aa5b1;
}
.registro__ponto.create {
  background: #3c6e47;
}
.registro__ponto.update {
  background: #d9822b;
}
.registro__ponto.delete {
  background: #c0392b;
}
.registro__corpo header {
  font-size: 0.85rem;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: baseline;
}
.registro__data {
  color: var(--p-muted);
  font-size: 0.75rem;
  margin-left: auto;
}
.registro__autor {
  margin: 0.15rem 0;
  font-size: 0.78rem;
  color: var(--cor-texto-suave, #52606d);
}
.registro__campos {
  margin: 0;
  font-size: 0.72rem;
  color: var(--p-muted);
}
.vazio {
  color: var(--p-muted);
  padding: 1rem 0;
}
</style>
