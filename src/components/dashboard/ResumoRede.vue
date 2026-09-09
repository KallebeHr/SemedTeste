<template>
  <section class="p-card p-section">
    <h2>Situação das escolas autorizadas</h2>
    <p v-if="rede.carregando.value || escolas.carregando.value" role="status">Consultando indicadores da rede…</p>
    <p v-if="rede.erro.value || escolas.erro.value" role="alert">{{rede.erro.value || escolas.erro.value}}</p>
    <p v-if="rede.parcial.value" class="p-alert">Consulta parcial. Consulte os relatórios por escola.</p>
    <div v-if="rede.dados.value" class="p-grid">
      <p><strong>{{rede.dados.value.criticos.length}}</strong> itens em nível crítico</p>
      <p><strong>{{rede.dados.value.vencidos.length}}</strong> itens vencidos com saldo</p>
      <p><strong>{{rede.dados.value.pendentes.length}}</strong> escolas sem vistoria nos últimos {{diasConsultados}} dias</p>
    </div>
    <div class="p-actions"><router-link class="p-button primary" to="/administracao/relatorios">Analisar e exportar relatórios</router-link><button class="p-button" :disabled="rede.carregando.value || escolas.carregando.value" @click="atualizar">Atualizar</button></div>
    <p class="p-small">{{escolas.dados.value.length}} escola(s) ativa(s). Indicadores consultados ao abrir o painel; atualize após alterações. Sem CPF nos indicadores.</p>
  </section>
</template>
<script setup>
import {watch,ref} from 'vue';
import {useEscolasAcesso} from '../../composables/useEscolasAcesso';
import {useRelatorioRede} from '../../composables/useRelatorioRede';
import {useParametros} from '../../composables/useParametros';
import {dataHoje} from '../../portal/validacao';
const escolas=useEscolasAcesso(),rede=useRelatorioRede(),{parametros,consulta}=useParametros(),diasConsultados=ref(30);
let iniciou=false;
async function atualizar(){const hoje=dataHoje();diasConsultados.value=parametros.value.diasVistoria;await rede.carregar(escolas.dados.value,hoje.slice(0,8)+'01',hoje,diasConsultados.value);}
watch([escolas.carregando,consulta.carregando],([a,b])=>{if(!a && !b && !escolas.erro.value && !iniciou){iniciou=true;atualizar();}},{immediate:true});
</script>
