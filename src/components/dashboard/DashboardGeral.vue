<template>
  <div class="dashboard">
    <div class="dashboard__cards">
      <div class="kpi">
        <span class="kpi__label">Itens em estoque</span>
        <strong class="kpi__valor">{{ itens.length }}</strong>
      </div>
      <div
        class="kpi kpi--alerta"
        :class="{ ativo: itensAbaixoDoMinimo.length }"
      >
        <span class="kpi__label">Abaixo do mínimo</span>
        <strong class="kpi__valor">{{ itensAbaixoDoMinimo.length }}</strong>
      </div>
      <div
        class="kpi kpi--alerta"
        :class="{ ativo: itensProximosDoVencimento.length }"
      >
        <span class="kpi__label">Vencendo em {{diasValidade}} dias</span>
        <strong class="kpi__valor">{{
          itensProximosDoVencimento.length
        }}</strong>
      </div>
      <div class="kpi">
        <span class="kpi__label">Valor total em estoque</span>
        <strong class="kpi__valor">{{
          formatarMoeda(valorTotalEstoque)
        }}</strong>
      </div>
    </div>

    <div class="dashboard__secoes">
      <section class="painel">
        <h3>Itens que precisam de reposição</h3>
        <ul v-if="itensAbaixoDoMinimo.length" class="lista-alerta">
          <li v-for="item in itensAbaixoDoMinimo" :key="item.id">
            <span>{{ item.nome }}</span>
            <span class="qtd"
              >{{ item.quantidadeAtual }}{{ item.unidade }} / mín.
              {{ item.quantidadeMinima }}{{ item.unidade }}</span
            >
          </li>
        </ul>
        <p v-else class="ok">Nenhum item abaixo do mínimo. 🎉</p>
      </section>

      <section class="painel">
        <h3>Vencimentos próximos</h3>
        <ul v-if="itensProximosDoVencimento.length" class="lista-alerta">
          <li v-for="item in itensProximosDoVencimento" :key="item.id">
            <span>{{ item.nome }}</span>
            <span class="qtd">{{ formatarData(item.validade) }}</span>
          </li>
        </ul>
        <p v-else class="ok">Nenhum vencimento próximo.</p>
      </section>
    </div>
  </div>
</template>

<script setup>
defineProps({
  itens: { type: Array, default: () => [] },
  itensAbaixoDoMinimo: { type: Array, default: () => [] },
  itensProximosDoVencimento: { type: Array, default: () => [] },
  diasValidade: {type:Number,default:15},
  valorTotalEstoque: { type: Number, default: 0 },
});

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(validade) {
  const data = validade.toDate ? validade.toDate() : new Date(validade);
  return data.toLocaleDateString("pt-BR");
}
</script>

<style scoped>
.dashboard__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.9rem;
  margin-bottom: 1.5rem;
}
.kpi {
  border: 1px solid var(--cor-borda, #e4e7eb);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  background: #fff;
}
.kpi--alerta.ativo {
  border-color: #e0a336;
  background: #fffaf0;
}
.kpi__label {
  font-size: 0.75rem;
  color: var(--cor-texto-suave, #52606d);
}
.kpi__valor {
  font-size: 1.6rem;
}
.dashboard__secoes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 720px) {
  .dashboard__secoes {
    grid-template-columns: 1fr;
  }
}
.painel {
  border: 1px solid var(--cor-borda, #e4e7eb);
  border-radius: 12px;
  padding: 1rem;
  background: #fff;
}
.painel h3 {
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
}
.lista-alerta {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.lista-alerta li {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  border-bottom: 1px solid #f1f3f4;
  padding-bottom: 0.4rem;
}
.qtd {
  color: #9aa5b1;
}
.ok {
  color: #245530;
  font-size: 0.85rem;
}
</style>
