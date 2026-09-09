<template>
  <section>
    <header class="p-page-head">
      <h1>Auditoria do sistema</h1>
      <p>
        Histórico paginado da fonte selecionada. O histórico verificado é
        vinculado à alteração confirmada no banco.
      </p>
    </header>
    <label
      >Fonte do histórico
      <select v-model="fonte" class="p-input">
        <option value="auditoriaRegistros">
          Histórico verificado (versão 2)
        </option>
        <option value="auditoriaPortal">Portal anterior</option>
        <option value="auditoria">Alimentação anterior</option>
      </select>
    </label>
    <form v-if="fonte === 'auditoriaRegistros'" class="p-card p-stack" @submit.prevent="filtrar">
      <div class="p-grid">
        <label class="p-field">UID do usuário<input v-model="usuarioId" placeholder="Todos os usuários" maxlength="128" /></label>
        <label class="p-field">Coleção<input v-model="colecao" placeholder="Ex.: estoque, notas, conteudos" maxlength="100" /></label>
        <label class="p-field">Data inicial<input type="date" v-model="inicio" /></label><label class="p-field">Data final<input type="date" v-model="fim" /></label>
      </div><button class="p-button primary" :disabled="consulta.carregando.value">Aplicar filtros ao histórico</button>
    </form>
    <p v-if="fonte !== 'auditoriaRegistros'" class="p-alert">
      Registros anteriores foram preservados; não possuem a garantia de vínculo
      introduzida na versão 2.
    </p>
    <EstadoConsulta :consulta="consulta" />
    <div class="p-table-wrap">
      <table class="p-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Usuário</th>
            <th>Ação</th>
            <th>Registro</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in consulta.dados.value" :key="e.id">
            <td>{{ dataTexto(e.timestamp) }} {{e.timestamp?.toDate?.().toLocaleTimeString('pt-BR')}}</td>
            <td>{{ e.usuarioNome }}</td>
            <td>{{ e.acao.replaceAll("_", " ") }}</td>
            <td>
              {{ e.colecao || e.tipo }} · {{ e.documentoId }}
              <details v-if="e.versaoEsquema === 1">
                <summary>Conferir alteração</summary>
                <p>{{ e.caminho }}</p>
                <strong>Antes</strong>
                <pre>{{ JSON.stringify(e.dadosAntes, null, 2) }}</pre>
                <strong>Depois</strong>
                <pre>{{ JSON.stringify(e.dadosDepois, null, 2) }}</pre>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="p-actions"><button class="p-button" :disabled="pagina===0 || consulta.carregando.value" @click="anterior">Anterior</button><span>Página {{pagina+1}}</span><button class="p-button" :disabled="!mais || consulta.carregando.value" @click="proxima">Próxima</button><button class="p-button" :disabled="!consulta.dados.value.length || exportando" @click="exportar">Exportar esta página em Excel</button></div>
    <p v-if="erroExportacao" role="alert" class="p-alert error">{{erroExportacao}}</p>
  </section>
</template>
<script setup>
import { ref, watch, onScopeDispose } from "vue";
import { collection, query, orderBy, limit, where, startAfter, getDocsFromServer, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { dataTexto, dataValida, mensagemErro } from "../../portal/validacao";
import { exportarTabela } from '../../portal/relatorios';
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const fonte = ref("auditoriaRegistros");
const usuarioId=ref(''),colecao=ref(''),inicio=ref(''),fim=ref(''),pagina=ref(0),mais=ref(false),exportando=ref(false),erroExportacao=ref('');
let cursores=[],ultimo=null,geracao=0,filtros=[];
const consulta={dados:ref([]),carregando:ref(false),erro:ref(''),recarregar:()=>carregar()};
async function carregar(){
  const g=++geracao;consulta.carregando.value=true;consulta.erro.value='';consulta.dados.value=[];
  try{const q=query(collection(db,fonte.value),...filtros,orderBy('timestamp','desc'),...(cursores[pagina.value]?[startAfter(cursores[pagina.value])]:[]),limit(51));const s=await getDocsFromServer(q);
    if(g!==geracao)return;consulta.dados.value=s.docs.slice(0,50).map(d=>({...d.data(),id:d.id}));ultimo=s.docs[49];mais.value=s.size>50;
  }catch(e){if(g===geracao)consulta.erro.value=mensagemErro(e);}finally{if(g===geracao)consulta.carregando.value=false;}
}
function filtrar(){
  if ((inicio.value && !dataValida(inicio.value)) || (fim.value && !dataValida(fim.value)) || (inicio.value && fim.value && inicio.value>fim.value)){consulta.erro.value='Confira o período.';return;}
  filtros=[];
  if(fonte.value==='auditoriaRegistros'){
    if(usuarioId.value.trim())filtros.push(where('usuarioId','==',usuarioId.value.trim()));
    if(colecao.value.trim())filtros.push(where('colecao','==',colecao.value.trim()));
    if(inicio.value)filtros.push(where('timestamp','>=',Timestamp.fromDate(new Date(inicio.value+'T00:00:00-03:00'))));
    if(fim.value)filtros.push(where('timestamp','<',Timestamp.fromMillis(new Date(fim.value+'T00:00:00-03:00').getTime()+86400000)));
  }
  cursores=[];pagina.value=0;carregar();
}
function proxima(){cursores[pagina.value+1]=ultimo;pagina.value++;carregar();}
function anterior(){pagina.value--;carregar();}
async function exportar(){exportando.value=true;erroExportacao.value='';try{await exportarTabela({titulo:'Auditoria SEDUC',contexto:'Histórico interno — página '+(pagina.value+1),cabecalho:['Data','Usuário','UID','Ação','Caminho'],linhas:consulta.dados.value.map(e=>[e.timestamp?.toDate?.().toLocaleString('pt-BR')||'',e.usuarioNome,e.usuarioId,e.acao,e.caminho||e.documentoId]),formato:'xlsx'});}catch(e){erroExportacao.value=mensagemErro(e);}finally{exportando.value=false;}}
watch(fonte,filtrar,{immediate:true});onScopeDispose(()=>{geracao++;consulta.dados.value=[];});
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 22rem;
  overflow: auto;
  font-size: 0.8rem;
}
details {
  max-width: 42rem;
}
</style>
