<template>
  <section class="p-stack">
    <header class="p-page-head"><p class="p-eyebrow">ALIMENTAÇÃO ESCOLAR</p><h1>Indicadores e relatórios</h1><p>Consulte as escolas permitidas ao seu perfil. O estoque representa o saldo atual; movimentos e vistorias respeitam o período informado.</p></header>
    <EstadoConsulta :consulta="escolas" />
    <form class="p-card p-stack" @submit.prevent="consultar">
      <div class="p-grid">
        <label class="p-field">Escola<select v-model="escola"><option value="">Todas as escolas autorizadas</option><option v-for="e in escolas.dados.value" :key="e.id" :value="e.id">{{e.nome}}</option></select></label>
        <label class="p-field">De<input v-model="inicio" type="date" required /></label><label class="p-field">Até<input v-model="fim" type="date" required /></label>
      </div>
      <button class="p-button primary" :disabled="rede.carregando.value || escolas.carregando.value || !!escolas.erro.value">{{rede.carregando.value ? 'Consultando…' : 'Atualizar indicadores'}}</button>
    </form>
    <p v-if="rede.erro.value || erro" role="alert" class="p-alert error">{{rede.erro.value || erro}}</p>
    <p v-if="rede.parcial.value" role="alert" class="p-alert">A consulta ultrapassou o limite de 200 escolas ou 1.000 registros por tipo/escola. Os indicadores são parciais. Selecione menos escolas ou reduza o período; a exportação está bloqueada.</p>
    <template v-if="rede.dados.value">
      <p class="p-small" role="status">Consulta confirmada em {{rede.consultadoEm.value.toLocaleString('pt-BR')}}. {{contexto}}</p>
      <div class="p-grid">
        <article class="p-card"><h2>{{rede.dados.value.criticos.length}}</h2><p>Itens no mínimo ou abaixo</p></article>
        <article class="p-card"><h2>{{rede.dados.value.vencidos.length}}</h2><p>Itens vencidos com saldo</p></article>
        <article class="p-card"><h2>{{rede.dados.value.pendentes.length}}</h2><p>Escolas sem vistoria nos últimos {{diasVistoria}} dias</p></article>
        <article class="p-card"><h2>{{rede.dados.value.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}}</h2><p>Valor cadastral do estoque ativo</p></article>
      </div>
      <section class="p-card"><h2>Saídas para consumo, por unidade</h2><p class="p-small">Quilos, litros e unidades são apresentados separadamente. Perdas e estornos não são classificados como consumo.</p>
        <p class="p-small">Evolução mensal: as barras comparam meses da mesma unidade. Registros antigos usam a unidade atual do item cadastrado.</p>
        <section v-for="serie in rede.dados.value.series" :key="serie.unidade"><h3>{{serie.unidade}}</h3><div v-for="ponto in serie.pontos" :key="ponto.mes" class="consumo"><span>{{ponto.mes}}: {{ponto.quantidade.toLocaleString('pt-BR')}} {{serie.unidade}}</span><meter min="0" :max="serie.maximo" :value="ponto.quantidade" :aria-label="ponto.mes+', consumo em '+serie.unidade" /></div></section>
        <p v-if="!rede.dados.value.consumo.length">Nenhuma saída no período.</p>
      </section>
      <details v-if="rede.dados.value.pendentes.length" class="p-card"><summary>Escolas com vistoria a programar</summary><ul><li v-for="e in rede.dados.value.pendentes" :key="e.id">{{e.nome}} — {{e.ultimaVistoria ? dataTexto(e.ultimaVistoria.data) : 'Sem vistoria registrada'}}</li></ul></details>
      <div class="p-grid">
        <label class="p-field">Registros<select v-model="tipo"><option value="estoque">Estoque atual</option><option value="movimentos">Movimentações</option><option value="vistorias">Vistorias</option></select></label>
        <label class="p-field">Busca<input v-model="busca" type="search" placeholder="Escola, item ou responsável" /></label>
        <label v-if="tipo !== 'vistorias'" class="p-field">Categoria<select v-model="categoria"><option value="">Todas</option><option v-for="c in categorias" :key="c">{{c}}</option></select></label>
        <label class="p-field">Situação / tipo<select v-model="situacao"><option value="">Todas</option><option v-for="s in situacoes" :key="s">{{s}}</option></select></label>
      </div>
      <div class="p-actions"><button v-for="f in ['pdf','xlsx']" :key="f" class="p-button" :disabled="exportando || !linhas.length || rede.parcial.value" @click="exportar(f)">Exportar {{f === 'xlsx' ? 'Excel' : 'PDF'}}</button><span>{{linhas.length}} registro(s)</span></div>
      <div class="p-table-wrap" tabindex="0" aria-label="Resultados do relatório"><table class="p-table"><caption>{{tipo === 'estoque' ? 'Estoque atual' : 'Registros do período'}}</caption><thead><tr><th v-for="h in tabela.cabecalho" :key="h" scope="col">{{h}}</th></tr></thead><tbody><tr v-for="(l,i) in tabela.linhas.slice((pagina-1)*25,pagina*25)" :key="i"><td v-for="(c,j) in l" :key="j">{{c}}</td></tr></tbody></table></div>
      <div class="p-actions"><button class="p-button" :disabled="pagina<=1" @click="pagina--">Anterior</button><span>Página {{pagina}} de {{Math.max(1,Math.ceil(linhas.length/25))}}</span><button class="p-button" :disabled="pagina*25>=linhas.length" @click="pagina++">Próxima</button></div>
    </template>
  </section>
</template>
<script setup>
import { ref, computed, watch } from 'vue';
import { useEscolasAcesso } from '../../composables/useEscolasAcesso';
import { useRelatorioRede } from '../../composables/useRelatorioRede';
import { useParametros } from '../../composables/useParametros';
import { dataHoje, dataTexto, normalizarBusca, mensagemErro } from '../../portal/validacao';
import { tabelaRelatorio, exportarTabela } from '../../portal/relatorios';
import EstadoConsulta from '../../components/portal/EstadoConsulta.vue';
const escolas = useEscolasAcesso(), rede = useRelatorioRede(), { parametros } = useParametros();
const diasVistoria = computed(()=>parametros.value.diasVistoria);
const escola=ref(''), fim=ref(dataHoje()), inicio=ref(dataHoje().slice(0,8)+'01'), tipo=ref('estoque'), busca=ref(''), categoria=ref(''), situacao=ref(''), pagina=ref(1), exportando=ref(false), erro=ref(''), contexto=ref('');
const base = computed(()=>rede.dados.value?.[tipo.value] || []);
const categorias = computed(()=>[...new Set(base.value.map(i=>i.categoria).filter(Boolean))].sort());
const situacoes = computed(()=>tipo.value==='estoque' ? ['Crítico','Regular','Vencido'] : [...new Set(base.value.map(i=>i.status || i.tipo))]);
const linhas = computed(()=>base.value.filter(i=> {
  const estado = tipo.value==='estoque' ? (i.validade && new Date(i.validade.toDate?.() || i.validade)<new Date() ? 'Vencido' : i.quantidadeAtual<=i.quantidadeMinima ? 'Crítico' : 'Regular') : i.status || i.tipo;
  return (tipo.value!=='estoque' || i.ativo!==false) && (!categoria.value || i.categoria===categoria.value) && (!situacao.value || estado===situacao.value) && normalizarBusca([i.escolaNome,i.nome,i.itemNome,i.responsavelNome].join(' ')).includes(normalizarBusca(busca.value));
}));
const tabela = computed(()=>tabelaRelatorio(tipo.value,linhas.value));
watch([busca,categoria,situacao,tipo],()=>{pagina.value=1;});
watch(tipo,()=>{categoria.value='';situacao.value='';});
async function consultar() { erro.value=''; await rede.carregar(escolas.dados.value.filter(e=>!escola.value || e.id===escola.value),inicio.value,fim.value,diasVistoria.value); if (rede.dados.value) contexto.value=`Período: ${dataTexto(inicio.value)} a ${dataTexto(fim.value)}. Estoque atual; dados internos sem CPF completo.`; }
async function exportar(formato) { exportando.value=true; erro.value='';try {await exportarTabela({titulo:'SEDUC — '+tipo.value,contexto:contexto.value,...tabela.value,formato});} catch(e) {erro.value=mensagemErro(e);} finally{exportando.value=false;} }
</script>
<style scoped>.consumo { display: grid; gap: .4rem; margin-block: 1rem; } meter { width: 100%; accent-color: var(--p-teal); }</style>
