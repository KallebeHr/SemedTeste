<template>
  <div class="estoque-list">
    <div class="estoque-list__filtros">
      <input
        v-model="busca"
        type="search"
        placeholder="Buscar item..."
        class="filtro-busca"
      />
      <select v-model="filtroCategoria">
        <option value="">Todas as categorias</option>
        <option v-for="c in categorias" :key="c" :value="c">
          {{ rotuloCategoria(c) }}
        </option>
      </select>
      <label class="filtro-check">
        <input v-model="apenasAlerta" type="checkbox" />
        Apenas com alerta
      </label>
    </div>

    <div class="estoque-list__grid">
      <article
        v-for="item in itensFiltrados"
        :key="item.id"
        class="item-card"
        :class="{ alerta: item.quantidadeAtual <= item.quantidadeMinima }"
      >
        <header>
          <h4>{{ item.nome }}</h4>
          <span class="badge">{{ rotuloCategoria(item.categoria) }}</span>
        </header>
        <div class="item-card__qtd">
          <strong>{{ item.quantidadeAtual }}{{ item.unidade }}</strong>
          <span>mín. {{ item.quantidadeMinima }}{{ item.unidade }}</span>
        </div>
        <div class="item-card__barra">
          <div
            class="item-card__barra-preenchida"
            :style="{ width: percentual(item) + '%' }"
            :class="{ baixo: item.quantidadeAtual <= item.quantidadeMinima }"
          />
        </div>
        <footer>
          <span
            v-if="item.validade"
            class="validade"
            :class="{ vencendo: vencendoEmBreve(item) }"
          >
            Val.: {{ formatarData(item.validade) }}
          </span>
          <button
            v-if="podeEditar"
            class="link-editar"
            @click="$emit('editar', item)"
          >
            Editar
          </button>
        </footer>
      </article>

      <p v-if="!itensFiltrados.length" class="vazio">Nenhum item encontrado.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  itens: { type: Array, default: () => [] },
  podeEditar: { type: Boolean, default: false },
});
defineEmits(["editar"]);

function rotuloCategoria(categoria) {
  return (
    {
      perecivel: "Perecível",
      nao_perecivel: "Não perecível",
      hortifruti: "Hortifruti",
      limpeza: "Limpeza",
      descartavel: "Descartável",
    }[categoria] || categoria
  );
}

const busca = ref("");
const filtroCategoria = ref("");
const apenasAlerta = ref(false);

const categorias = computed(() => [
  ...new Set(props.itens.map((i) => i.categoria)),
]);

const itensFiltrados = computed(() =>
  props.itens.filter((item) => {
    const bateBusca = item.nome
      .toLowerCase()
      .includes(busca.value.toLowerCase());
    const bateCategoria =
      !filtroCategoria.value || item.categoria === filtroCategoria.value;
    const bateAlerta =
      !apenasAlerta.value || item.quantidadeAtual <= item.quantidadeMinima;
    return bateBusca && bateCategoria && bateAlerta;
  }),
);

function percentual(item) {
  if (!item.quantidadeMinima) return 100;
  const alvo = item.quantidadeMinima * 3; // referência visual: 3x o mínimo = barra cheia
  return Math.min(100, Math.round((item.quantidadeAtual / alvo) * 100));
}

function vencendoEmBreve(item) {
  if (!item.validade) return false;
  const ms = item.validade.toMillis
    ? item.validade.toMillis()
    : new Date(item.validade).getTime();
  return ms - Date.now() < 15 * 24 * 60 * 60 * 1000;
}

function formatarData(validade) {
  const data = validade.toDate ? validade.toDate() : new Date(validade);
  return data.toLocaleDateString("pt-BR");
}
</script>

<style scoped>
.estoque-list__filtros {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.filtro-busca,
.estoque-list__filtros select {
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  font-size: 0.85rem;
}
.filtro-busca {
  flex: 1;
  min-width: 160px;
}
.filtro-check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--cor-texto-suave, #52606d);
}
.estoque-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.9rem;
}
.item-card {
  border: 1px solid var(--cor-borda, #e4e7eb);
  border-radius: 12px;
  padding: 0.9rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.item-card.alerta {
  border-color: #e0a336;
  background: #fffaf0;
}
.item-card header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-direction: column;
  gap: 0.5rem;
}
.item-card h4 {
  margin: 0;
  font-size: 0.95rem;
}
.badge {
  font-size: 0.65rem;
  background: #eef2f0;
  color: #46614c;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}
.item-card__qtd {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
  color: var(--cor-texto-suave, #52606d);
}
.item-card__qtd strong {
  font-size: 1.2rem;
  color: #1f2933;
}
.item-card__barra {
  height: 6px;
  border-radius: 999px;
  background: #eceff1;
  overflow: hidden;
}
.item-card__barra-preenchida {
  height: 100%;
  background: var(--cor-primaria, #3c6e47);
  transition: width 0.3s ease;
}
.item-card__barra-preenchida.baixo {
  background: #d9822b;
}
.item-card footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}
.validade {
  color: #7b8794;
}
.validade.vencendo {
  color: #c0392b;
  font-weight: 600;
}
.link-editar {
  background: none;
  border: none;
  color: var(--cor-primaria, #3c6e47);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.75rem;
}
.vazio {
  grid-column: 1 / -1;
  text-align: center;
  color: #9aa5b1;
  padding: 2rem 0;
}
</style>
