<template>
  <section class="p-stack">
    <header class="p-page-head"><h1>Notificações e pendências</h1><p>{{caixa.naoLidas.value.length}} não lida(s) entre os alertas e tarefas carregados. A leitura é individual; não apaga os avisos de outras pessoas.</p></header>
    <EstadoConsulta :consulta="caixa.tarefas"/><EstadoConsulta :consulta="caixa.alertas"/><EstadoConsulta :consulta="caixa.leituras"/>
    <p v-if="erro" role="alert" class="p-alert error">{{erro}}</p><p v-if="mensagem" role="status" class="p-alert success">{{mensagem}}</p>
    <details v-if="pode('usuarios')" class="p-card"><summary>Atribuir uma pendência</summary>
      <form class="p-stack" @submit.prevent="criar"><fieldset :disabled="ocupado" class="p-stack">
        <label class="p-field">Tipo<select v-model="form.tipo"><option value="vistoria">Vistoria a realizar</option><option value="documento">Documento aguardando identificação</option><option value="outro">Outra pendência</option></select></label>
        <label class="p-field">Título<input v-model="form.titulo" required maxlength="160" /></label><label class="p-field">Orientações<textarea v-model="form.mensagem" required maxlength="2000" /></label>
        <label class="p-field">Destinatário<select v-model="form.destinatarioUid" required><option value="">Selecione</option><option v-for="u in equipe.dados.value.filter(u=>u.ativo)" :value="u.id" :key="u.id">{{u.nome}}</option></select></label>
        <label class="p-field">Prazo<input type="date" v-model="form.prazo" required /></label><button class="p-button primary">Criar pendência</button>
      </fieldset></form><EstadoConsulta :consulta="equipe"/>
    </details>
    <label class="p-check"><input type="checkbox" v-model="soNaoLidas" /> Somente não lidas</label>
    <article v-for="n in exibidas" :key="n.chave" class="p-card">
      <p class="p-eyebrow">{{n.origem === 'tarefa' ? 'Pendência' : 'Alimentação escolar'}}</p><h2>{{n.titulo}}</h2><p>{{n.mensagem}}</p><p class="p-small">{{dataTexto(n.criadoEm)}}<span v-if="n.prazo"> · Prazo: {{dataTexto(n.prazo)}}</span></p>
      <div class="p-actions"><button class="p-button" :disabled="ocupado || caixa.lidas.value.has(n.chave)" @click="ler(n)">{{caixa.lidas.value.has(n.chave)?'Lida':'Marcar como lida'}}</button>
        <button v-if="n.origem === 'tarefa'" class="p-button" :disabled="ocupado" @click="concluir(n)">Concluir pendência</button>
        <router-link v-else to="/administracao/merenda" class="p-button">Conferir alimentação</router-link></div>
    </article>
    <p v-if="!exibidas.length" class="p-empty">Nenhuma notificação nesta seleção.</p>
    <details class="p-card"><summary>Pendências concluídas</summary><p v-for="t in caixa.tarefas.dados.value.filter(t=>t.status==='concluida')" :key="t.id">{{t.titulo}} · {{dataTexto(t.atualizadoEm)}}</p></details>
    <p class="p-small">Concluir uma pendência é um controle administrativo. Isso não assina documentos nem substitui o registro de vistoria. Alertas de estoque representam a situação no momento em que foram emitidos.</p>
  </section>
</template>
<script setup>
import { ref, reactive, computed } from 'vue';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { usarCaixaEntrada } from '../../composables/useCaixaEntrada';
import { useAuth } from '../../composables/useAuth';
import { useColecao } from '../../composables/useColecao';
import { transacaoConfirmada } from '../../portal/transacao';
import { dataTexto, dataValida, mensagemErro } from '../../portal/validacao';
import EstadoConsulta from '../../components/portal/EstadoConsulta.vue';
const caixa=usarCaixaEntrada(), {usuario,pode}=useAuth();
const equipe=useColecao(()=>pode('usuarios')?collection(db,'equipe'):null);
const erro=ref(''),mensagem=ref(''),ocupado=ref(false),soNaoLidas=ref(false);
const form=reactive({tipo:'vistoria',titulo:'',mensagem:'',destinatarioUid:'',prazo:''});
const exibidas=computed(()=>soNaoLidas.value?caixa.naoLidas.value:caixa.itens.value);
async function executar(fn) {if(ocupado.value)return;ocupado.value=true;erro.value='';try{await fn();}catch(e){erro.value=mensagemErro(e);}finally{ocupado.value=false;}}
const ler=n=>executar(()=>caixa.marcarLida(n));
const criar=()=>executar(async()=>{
  if(!dataValida(form.prazo)||!form.titulo.trim()||!form.mensagem.trim())throw new Error('Confira título, orientações e prazo.');
  await transacaoConfirmada(t=>t.set(doc(collection(db,'pendencias')),{...form,titulo:form.titulo.trim(),mensagem:form.mensagem.trim(),status:'pendente',versao:1,criadoPor:usuario.value.uid,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()}));
  form.titulo='';form.mensagem='';mensagem.value='Pendência atribuída.';
});
const concluir=n=>executar(async()=>{
  if(!window.confirm('Confirma a conclusão desta pendência? O documento ou vistoria deve ser registrado na área correspondente.'))return;
  await transacaoConfirmada(async t=>{const r=doc(db,'pendencias',n.id),s=await t.get(r);if(s.data()?.versao!==n.versao)throw new Error('Esta pendência foi alterada. Confira novamente.');t.update(r,{status:'concluida',versao:n.versao+1,atualizadoEm:serverTimestamp()});});
  mensagem.value='Pendência concluída e registrada no histórico.';
});
</script>
