<template>
  <section class="p-stack"><header class="p-page-head"><p class="p-eyebrow">MASTER</p><h1>Parâmetros do sistema</h1><p>Defina os alertas da alimentação escolar. Alterações ficam registradas na auditoria.</p></header>
    <EstadoConsulta :consulta="consulta" />
    <p v-if="mensagem" class="p-alert success" role="status">{{mensagem}}</p><p v-if="erro" class="p-alert error" role="alert">{{erro}}</p>
    <form v-if="!consulta.carregando.value && !consulta.erro.value" class="p-card p-stack" @submit.prevent="salvar"><fieldset :disabled="ocupado" class="p-stack">
      <label class="p-field">Intervalo de vistoria (dias)<input v-model.number="form.diasVistoria" type="number" min="1" max="365" required /></label>
      <label class="p-field">Antecedência do alerta de validade (dias)<input v-model.number="form.diasValidade" type="number" min="1" max="90" required /></label>
      <label class="p-field">Categorias de alimentos, uma por linha<textarea v-model="form.categoriasTexto" maxlength="2000" rows="8" required /></label>
      <p class="p-small">Renomear uma categoria não altera itens existentes. Categorias antigas continuam disponíveis ao editar esses itens.</p>
      <button class="p-button primary">{{ocupado?'Salvando…':'Salvar parâmetros'}}</button>
    </fieldset></form>
  </section>
</template>
<script setup>
import {ref,reactive,watch,computed} from 'vue';
import {doc,serverTimestamp} from 'firebase/firestore';
import {db} from '../../firebase';
import {useParametros} from '../../composables/useParametros';
import {useSaidaSegura} from '../../composables/useSaidaSegura';
import {transacaoConfirmada} from '../../portal/transacao';
import {mensagemErro} from '../../portal/validacao';
import EstadoConsulta from '../../components/portal/EstadoConsulta.vue';
const {consulta,parametros}=useParametros(),form=reactive({}),versao=ref(0),original=ref(''),ocupado=ref(false),erro=ref(''),mensagem=ref('');
const pendente=computed(()=>original.value && JSON.stringify(form)!==original.value);
watch(parametros,p=>{if(pendente.value)return;Object.assign(form,{diasVistoria:p.diasVistoria,diasValidade:p.diasValidade,categoriasTexto:p.categoriasTexto});versao.value=p.versao;original.value=JSON.stringify(form);},{immediate:true});
useSaidaSegura(()=>pendente.value);
async function salvar(){if(ocupado.value)return;ocupado.value=true;erro.value='';mensagem.value='';try{
  const categorias=[...new Set(form.categoriasTexto.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];
  if(!categorias.length || categorias.some(s=>s.length>100))throw new Error('Informe categorias com até 100 caracteres por linha.');
  const dados={...form,categoriasTexto:categorias.join('\n')};
  await transacaoConfirmada(async tx=>{const r=doc(db,'parametros','sistema'),s=await tx.get(r);if((s.data()?.versao||0)!==versao.value)throw new Error('Outro Master alterou os parâmetros. Copie seus ajustes e atualize a página antes de salvar.');tx.set(r,{...dados,versao:versao.value+1,atualizadoEm:serverTimestamp()});});
  versao.value++;Object.assign(form,dados);original.value=JSON.stringify(form);mensagem.value='Parâmetros salvos e auditados.';
}catch(e){erro.value=mensagemErro(e);}finally{ocupado.value=false;}}
</script>
<style scoped>fieldset{border:0;min-width:0}</style>
