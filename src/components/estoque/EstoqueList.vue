<template>
  <section class="estoque-list" aria-label="Estoque da unidade selecionada">
    <div class="indicadores">
      <article>
        <span>Itens ativos</span><strong>{{ resumo.ativos }}</strong
        ><small>Tipos de produtos cadastrados</small>
      </article>
      <article>
        <span>Precisam de reposição</span><strong>{{ resumo.baixos }}</strong
        ><small>Saldo igual ou abaixo do mínimo</small>
      </article>
      <article>
        <span>Sem saldo</span><strong>{{ resumo.zerados }}</strong
        ><small>Produtos esgotados</small>
      </article>
      <article>
        <span>Valor estimado</span
        ><strong>{{ moedaEstoque(resumo.valor) }}</strong
        ><small>Saldo × preço unitário cadastrado</small>
      </article>
    </div>
    <p v-if="resumo.vencidos" class="aviso" role="status">
      {{ resumo.vencidos }} item(ns) com saldo e validade vencida. Confira os
      produtos e registre perdas quando necessário.
    </p>
    <div class="filtros">
      <label
        >Buscar item ou local<input
          v-model="busca"
          type="search"
          placeholder="Ex.: arroz, prateleira B" /></label
      ><label
        >Categoria<select v-model="categoria">
          <option value="">Todas</option>
          <option v-for="c in categorias" :key="c" :value="c">
            {{ rotuloCategoria(c) }}
          </option>
        </select></label
      ><label
        >Mostrar<select v-model="situacao">
          <option value="ativos">Itens ativos</option>
          <option value="baixo">Precisam de reposição</option>
          <option value="zerado">Sem saldo</option>
          <option value="vencendo">Validade próxima</option>
          <option value="vencido">Vencidos</option>
          <option value="arquivado">Arquivados</option>
        </select></label
      ><label
        >Ordenar<select v-model="ordem">
          <option value="nome">Nome</option>
          <option value="validade">Menor validade primeiro</option>
          <option value="saldo">Menor saldo primeiro</option>
        </select></label
      >
    </div>
    <p class="orientacao">
      Retirar reduz a quantidade. Arquivar retira o cadastro da lista ativa e
      preserva o histórico. Não somamos kg, litros e unidades em um único saldo.
    </p>
    <p role="status" class="contagem">
      {{ filtrados.length }} item(ns) encontrado(s)
    </p>
    <div class="itens-grid">
      <article
        v-for="item in filtrados"
        :key="item.id"
        class="item-card"
        :class="estadoItem(item, diasValidade).id"
      >
        <header>
          <span class="categoria">{{ rotuloCategoria(item.categoria) }}</span>
          <h3>{{ item.nome }}</h3>
          <span class="status">{{
            estadoItem(item, diasValidade).rotulo
          }}</span>
        </header>
        <div class="saldo">
          <span>Saldo disponível</span
          ><strong
            >{{ numeroEstoque(item.quantidadeAtual) }}
            <small>{{ item.unidade }}</small></strong
          >
        </div>
        <dl>
          <div>
            <dt>Mínimo definido</dt>
            <dd>
              {{ numeroEstoque(item.quantidadeMinima) }} {{ item.unidade }}
            </dd>
          </div>
          <div>
            <dt>Validade</dt>
            <dd>{{ dataValidade(item.validade) }}</dd>
          </div>
          <div>
            <dt>Armazenamento</dt>
            <dd>{{ item.localArmazenamento || "Não informado" }}</dd>
          </div>
          <div>
            <dt>Valor estimado</dt>
            <dd>
              {{
                moedaEstoque(item.quantidadeAtual * (item.precoUnitario || 0))
              }}
            </dd>
          </div>
        </dl>
        <div v-if="podeEditar" class="acoes-item">
          <template v-if="item.ativo !== false">
            <button
              type="button"
              class="botao botao-primario"
              :disabled="ocupado"
              :aria-label="'Registrar entrada de ' + item.nome"
              @click="$emit('movimentar', { item, tipo: 'entrada' })"
            >
              + Entrada
            </button>
            <button
              type="button"
              class="botao"
              :disabled="ocupado || item.quantidadeAtual <= 0"
              :aria-label="'Retirar ' + item.nome"
              @click="$emit('movimentar', { item, tipo: 'saida' })"
            >
              − Retirar
            </button>
            <button
              type="button"
              class="botao"
              :disabled="ocupado || item.quantidadeAtual <= 0"
              @click="$emit('movimentar', { item, tipo: 'perda' })"
            >
              Perda / descarte
            </button>
            <button
              type="button"
              class="botao"
              :disabled="ocupado"
              @click="$emit('movimentar', { item, tipo: 'conferencia' })"
            >
              Conferir saldo
            </button>
            <button
              type="button"
              class="botao"
              :disabled="ocupado"
              @click="$emit('editar', item)"
            >
              Editar cadastro
            </button>
            <button
              type="button"
              class="botao"
              :disabled="ocupado || item.quantidadeAtual !== 0"
              title="Só é possível arquivar com saldo zerado"
              @click="$emit('arquivar', item)"
            >
              Arquivar
            </button> </template
          ><button
            v-else
            type="button"
            class="botao"
            :disabled="ocupado"
            @click="$emit('reativar', item)"
          >
            Reativar item
          </button>
        </div>
        <button
          type="button"
          class="botao historico"
          :disabled="ocupado"
          @click="$emit('historico', item)"
        >
          Ver histórico deste item
        </button>
      </article>
    </div>
    <div v-if="!filtrados.length" class="vazio">
      <h3>
        {{
          situacao === "arquivado"
            ? "Nenhum item arquivado encontrado"
            : "Nenhum item neste filtro"
        }}
      </h3>
      <p>
        Confira os filtros ou cadastre um produto. Ao cadastrar, escolha a
        unidade e o saldo inicial com atenção.
      </p>
    </div>
  </section>
</template>
<script setup>
import { ref, computed } from "vue";
import {
  numeroEstoque,
  moedaEstoque,
  resumoEstoque,
  estadoItem,
} from "../../utils/estoque";
const props = defineProps({
  itens: { type: Array, default: () => [] },
  podeEditar: { type: Boolean, default: false },
  ocupado: { type: Boolean, default: false },
  diasValidade: { type: Number, default: 15 },
});
defineEmits(["editar", "movimentar", "arquivar", "reativar", "historico"]);
const busca = ref(""),
  categoria = ref(""),
  situacao = ref("ativos"),
  ordem = ref("nome");
const normalizar = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const categorias = computed(() =>
  [...new Set(props.itens.map((i) => i.categoria).filter(Boolean))].sort(),
);
const resumo = computed(() => resumoEstoque(props.itens, props.diasValidade));
const validade = (i) =>
  i.validade?.toMillis?.() || new Date(i.validade || "9999-12-31").getTime();
const filtrados = computed(() =>
  props.itens
    .filter((i) => {
      if ((situacao.value === "arquivado") !== (i.ativo === false))
        return false;
      if (categoria.value && categoria.value !== i.categoria) return false;
      if (
        !normalizar(`${i.nome} ${i.localArmazenamento || ""}`).includes(
          normalizar(busca.value),
        )
      )
        return false;
      if (situacao.value === "baixo")
        return i.quantidadeAtual <= i.quantidadeMinima;
      return (
        ["ativos", "arquivado"].includes(situacao.value) ||
        estadoItem(i, props.diasValidade).id === situacao.value
      );
    })
    .sort((a, b) =>
      ordem.value === "saldo"
        ? a.quantidadeAtual - b.quantidadeAtual
        : ordem.value === "validade"
          ? validade(a) - validade(b)
          : String(a.nome).localeCompare(b.nome, "pt-BR"),
    ),
);
function rotuloCategoria(c) {
  return (
    {
      perecivel: "Perecível",
      nao_perecivel: "Não perecível",
      hortifruti: "Hortifruti",
      limpeza: "Limpeza",
      descartavel: "Descartável",
      laticinios: "Laticínios",
      outros: "Outros",
    }[c] ||
    c ||
    "Sem categoria"
  );
}
function dataValidade(v) {
  if (!v) return "Não informada";
  const d = v.toDate ? v.toDate() : new Date(v);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("pt-BR")
    : "Não informada";
}
</script>
<style scoped>
.estoque-list {
  display: grid;
  gap: 20px;
}
.indicadores {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.indicadores article {
  padding: 20px;
  border: 1px solid #dce7e3;
  border-radius: 14px;
  background: white;
  display: grid;
  gap: 8px;
}
.indicadores span {
  font-size: 0.8rem;
  font-weight: 600;
}
.indicadores strong {
  font-size: 1.5rem;
  color: #037770;
  overflow-wrap: anywhere;
}
.indicadores small {
  font-size: 0.75rem;
  color: #526b65;
}
.filtros {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 12px;
}
.filtros label {
  display: grid;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 0;
}
.filtros input,
.filtros select {
  min-width: 0;
  width: 100%;
  padding: 12px;
  border: 1px solid #cadbd6;
  border-radius: 8px;
  background: white;
  color: #17332f;
  font: inherit;
}
.orientacao,
.contagem {
  font-size: 0.82rem;
  color: #526b65;
  margin: 0;
}
.itens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 16px;
}
.item-card {
  padding: 20px;
  background: white;
  border: 1px solid #dce7e3;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.item-card header {
  display: grid;
  gap: 8px;
}
.item-card h3 {
  margin: 0;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}
.categoria {
  font-size: 0.75rem;
  color: #526b65;
}
.status {
  justify-self: start;
  padding: 4px 9px;
  border-radius: 6px;
  background: #e8f5ef;
  color: #195c49;
  font-size: 0.75rem;
  font-weight: 700;
}
.baixo .status,
.vencendo .status {
  background: #fff1d8;
  color: #795005;
}
.vencido .status {
  background: #fde9e7;
  color: #a1251c;
}
.arquivado .status,
.zerado .status {
  background: #eef1f2;
  color: #415259;
}
.saldo {
  display: grid;
  gap: 4px;
  padding: 14px;
  background: #f4f8f6;
  border-radius: 9px;
}
.saldo span {
  font-size: 0.8rem;
}
.saldo strong {
  font-size: 1.6rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.saldo small {
  font-size: 0.9rem;
}
dl {
  display: grid;
  gap: 9px;
  font-size: 0.8rem;
  margin: 0;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
dt {
  color: #526b65;
}
dd {
  text-align: right;
  max-width: 60%;
  overflow-wrap: anywhere;
}
.acoes-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}
.acoes-item .botao,
.historico {
  font-size: 0.8rem;
  padding: 10px;
}
.historico {
  align-self: flex-start;
}
.aviso {
  padding: 14px;
  border-radius: 8px;
  background: #fff0df;
  color: #754908;
}
.vazio {
  padding: 30px;
  text-align: center;
  background: white;
  border: 1px dashed #bed2cc;
  border-radius: 12px;
}
.vazio h3 {
  font-size: 1rem;
}
.vazio p {
  font-size: 0.875rem;
  margin-top: 8px;
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid #037770;
  outline-offset: 3px;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 900px) {
  .indicadores,
  .filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .filtros {
    grid-template-columns: 1fr;
  }
  .indicadores article {
    padding: 13px;
  }
  .item-card {
    padding: 16px;
  }
  .acoes-item .botao {
    flex: 1 1 40%;
  }
}
</style>
