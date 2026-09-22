<template>
  <section class="catalogo">
    <h2>Adicionar produtos do catálogo</h2>
    <p>
      Pesquise e selecione produtos para esta unidade. Serão cadastrados com
      saldo zero; registre as entradas após conferir os recebimentos.
    </p>
    <p class="nota">
      São {{ produtos.length.toLocaleString("pt-BR") }} opções, incluindo
      apresentações e embalagens. Confira o produto adquirido: caixas e pacotes
      não são convertidos automaticamente em kg ou litros.
    </p>
    <p v-if="erroCarga" role="alert" class="mensagem-erro">{{ erroCarga }}</p>
    <p v-if="carregando" role="status">Carregando catálogo...</p>
    <fieldset :disabled="ocupado" class="filtros">
      <label
        >Buscar produto<input
          v-model="busca"
          type="search"
          placeholder="Arroz, detergente, banana..."
      /></label>
      <label
        >Categoria<select v-model="categoria">
          <option value="">Todas</option>
          <option v-for="c in categorias" :key="c">{{ c }}</option>
        </select></label
      >
      <label class="check"
        ><input v-model="soDisponiveis" type="checkbox" />Ocultar já
        cadastrados</label
      >
    </fieldset>
    <div class="barra">
      <span role="status"
        >{{ filtrados.length }} encontrados ·
        {{ selecionados.length }} selecionados</span
      ><button
        class="botao"
        :disabled="ocupado || !paginaItens.some((p) => !existente(p))"
        @click="selecionarPagina"
      >
        Selecionar esta página</button
      ><button
        class="botao"
        :disabled="ocupado || !selecionados.length"
        @click="selecionados = []"
      >
        Limpar seleção
      </button>
      <button
        class="botao"
        :disabled="ocupado || !filtrados.some((p) => !existente(p))"
        @click="selecionarResultados"
      >
        Selecionar todos os resultados
      </button>
    </div>
    <div class="opcoes">
      <label
        v-for="p in paginaItens"
        :key="p.id"
        :class="{ existente: existente(p) }"
        ><input
          v-model="selecionados"
          type="checkbox"
          :value="p.id"
          :disabled="ocupado || existente(p)"
        /><span
          ><strong>{{ p.nome }}</strong
          ><small
            >{{ p.categoria }} · unidade: {{ p.unidade
            }}<b v-if="existente(p)">
              · Já cadastrado (ativo ou arquivado)</b
            ></small
          ></span
        ></label
      >
    </div>
    <p v-if="!carregando && !filtrados.length">
      Nenhum produto corresponde aos filtros. O botão Novo item continua
      disponível para produtos fora do catálogo.
    </p>
    <nav class="barra" aria-label="Páginas do catálogo">
      <button
        class="botao"
        :disabled="ocupado || pagina <= 1"
        @click="pagina--"
      >
        Anterior</button
      ><span>Página {{ pagina }} de {{ paginas }}</span
      ><button
        class="botao"
        :disabled="ocupado || pagina >= paginas"
        @click="pagina++"
      >
        Próxima
      </button>
    </nav>
    <fieldset :disabled="ocupado" class="filtros">
      <label
        >Mínimo inicial dos selecionados<input
          v-model.number="minimo"
          type="number"
          min="0"
          step="0.000001"
          required /></label
      ><label
        >Local inicial (opcional)<input
          v-model="local"
          maxlength="300"
          placeholder="Ex.: Corredor A"
      /></label>
    </fieldset>
    <p class="nota">
      O mínimo usa a unidade de cada produto. Se as necessidades forem
      diferentes, mantenha zero e ajuste cada cadastro depois. Preço e validade
      também serão informados posteriormente.
    </p>
    <p v-if="erroLocal || erro" class="mensagem-erro" role="alert">
      {{ erroLocal || erro }}
    </p>
    <div v-if="ocupado" role="status">
      <p>Processados {{ progresso }} de {{ total }}. Aguarde a confirmação.</p>
      <progress
        :value="progresso"
        :max="total"
        aria-label="Progresso do cadastro"
      /><button class="botao" @click="pararAposAtual">
        Interromper após o item atual
      </button>
    </div>
    <p v-if="resultado && !ocupado" role="status" class="resultado">
      {{ resultado.criados.length }} criados ·
      {{ resultado.existentes.length }} já existentes ·
      {{ resultado.pendentes.length }} pendentes.
      {{
        resultado.pendentes.length
          ? "Você pode tentar novamente; os cadastros confirmados serão preservados."
          : "Cadastros processados. Use Entrada para registrar quantidades."
      }}
    </p>
    <div class="barra">
      <button class="botao" :disabled="ocupado" @click="$emit('fechar')">
        Fechar</button
      ><button
        class="botao botao-primario"
        :disabled="ocupado || carregando || !selecionados.length"
        @click="salvar"
      >
        {{ ocupado ? "Cadastrando..." : "Adicionar selecionados" }}
      </button>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useCatalogoEstoque } from "../../composables/useCatalogoEstoque";
import { normalizarProduto, chaveProduto } from "../../utils/catalogoEstoque";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
const props = defineProps({
  escolaId: { type: String, required: true },
  itens: { type: Array, default: () => [] },
});
const emit = defineEmits(["ocupado", "fechar", "salvo"]);
const produtos = ref([]),
  carregando = ref(true),
  erroCarga = ref(""),
  busca = ref(""),
  categoria = ref(""),
  soDisponiveis = ref(true),
  pagina = ref(1),
  selecionados = ref([]),
  minimo = ref(0),
  local = ref(""),
  erroLocal = ref("");
const {
  ocupado,
  progresso,
  total,
  resultado,
  erro,
  adicionar,
  pararAposAtual,
} = useCatalogoEstoque(props.escolaId);
useSaidaSegura(() => ocupado.value || selecionados.value.length > 0);
const categorias = computed(() =>
  [...new Set(produtos.value.map((p) => p.categoria))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  ),
);
const idsExistentes = computed(() => new Set(props.itens.map((i) => i.id)));
const chavesExistentes = computed(() => new Set(props.itens.map(chaveProduto)));
const existente = (p) =>
  idsExistentes.value.has("cat-" + p.id) ||
  chavesExistentes.value.has(chaveProduto(p));
const filtrados = computed(() =>
  produtos.value.filter(
    (p) =>
      (!categoria.value || categoria.value === p.categoria) &&
      normalizarProduto(p.nome).includes(normalizarProduto(busca.value)) &&
      (!soDisponiveis.value || !existente(p)),
  ),
);
const paginas = computed(() =>
  Math.max(1, Math.ceil(filtrados.value.length / 40)),
);
const paginaItens = computed(() =>
  filtrados.value.slice((pagina.value - 1) * 40, pagina.value * 40),
);
watch([busca, categoria, soDisponiveis], () => (pagina.value = 1));
watch(paginas, (n) => (pagina.value = Math.min(pagina.value, n)));
onMounted(async () => {
  try {
    produtos.value = (await import("../../data/catalogoEstoque.json")).default;
  } catch {
    erroCarga.value =
      "Não foi possível carregar o catálogo. Feche esta janela e tente novamente.";
  } finally {
    carregando.value = false;
  }
});
function selecionarResultados() {
  selecionados.value = [
    ...new Set([
      ...selecionados.value,
      ...filtrados.value.filter((p) => !existente(p)).map((p) => p.id),
    ]),
  ];
}
function selecionarPagina() {
  selecionados.value = [
    ...new Set([
      ...selecionados.value,
      ...paginaItens.value.filter((p) => !existente(p)).map((p) => p.id),
    ]),
  ];
}
async function salvar() {
  if (ocupado.value) return;
  erroLocal.value = "";
  emit("ocupado", true);
  try {
    const r = await adicionar(
      produtos.value.filter((p) => selecionados.value.includes(p.id)),
      {
        itensExistentes: props.itens,
        minimo: minimo.value,
        local: local.value,
      },
    );
    selecionados.value = r.pendentes;
    emit("salvo", r);
  } catch (e) {
    erroLocal.value = e.message;
  } finally {
    emit("ocupado", false);
  }
}
</script>
<style scoped>
.catalogo {
  display: grid;
  gap: 16px;
}
.nota,
small {
  font-size: 0.8rem;
  color: #526b65;
}
.filtros {
  border: 0;
  padding: 0;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.filtros label {
  display: grid;
  gap: 6px;
  flex: 1;
  min-width: 180px;
  font-size: 0.875rem;
}
.filtros .check {
  display: flex;
  align-items: center;
}
.filtros input:not([type="checkbox"]),
select {
  border: 1px solid #cadbd6;
  border-radius: 8px;
  padding: 10px;
  min-width: 0;
}
.barra {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.opcoes {
  max-height: 400px;
  overflow: auto;
  border: 1px solid #dce7e3;
  border-radius: 10px;
}
.opcoes label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #edf2ef;
  cursor: pointer;
}
.opcoes input {
  margin-top: 5px;
  min-width: 18px;
  min-height: 18px;
}
.opcoes span {
  display: grid;
  gap: 4px;
}
.opcoes strong {
  font-size: 0.875rem;
}
.existente {
  background: #f2f5f4;
  color: #526b65;
}
.resultado {
  background: #edf5f1;
  padding: 14px;
  border-radius: 8px;
}
progress {
  width: 100%;
  accent-color: #037770;
}
:focus-visible {
  outline: 3px solid #037770;
  outline-offset: 3px;
}
@media (max-width: 600px) {
  .filtros label {
    flex-basis: 100%;
  }
  .barra .botao {
    flex: 1;
  }
  .opcoes {
    max-height: 45vh;
  }
}
</style>
