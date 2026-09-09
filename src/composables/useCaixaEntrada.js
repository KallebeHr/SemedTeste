import { computed, provide, inject } from 'vue';
import { collection, doc, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { useColecao } from './useColecao';
import { writeBatchAuditado } from '../portal/auditoria';
const CHAVE = Symbol('caixa-entrada');
export function fornecerCaixaEntrada() {
  const {usuario, ehGestao, pode} = useAuth();
  const dependencia = ()=>[usuario.value?.uid,usuario.value?.papel,JSON.stringify(usuario.value?.escolasVinculadas)];
  const tarefas = useColecao(()=>{
    if (!usuario.value) return null;
    return query(collection(db,'pendencias'),...(!pode('usuarios')?[where('destinatarioUid','==',usuario.value.uid)]:[]),orderBy('criadoEm','desc'),limit(100));
  }, dependencia);
  const alertas = useColecao(()=>{
    if (!pode('merenda')) return null;
    const ids = usuario.value.escolasVinculadas || [];
    if (!ehGestao.value && !ids.length) return null;
    return query(collection(db,'notificacoes'),...(!ehGestao.value?[where('escolaId','in',ids.slice(0,20))]:[]),orderBy('criadoEm','desc'),limit(100));
  },dependencia);
  const leituras = useColecao(()=>usuario.value ? query(collection(db,'usuarios',usuario.value.uid,'leituras'),orderBy('lidaEm','desc'),limit(1000)):null,dependencia);
  const itens = computed(()=>[
    ...tarefas.dados.value.filter(t=>t.status==='pendente').map(t=>({...t,chave:'t-'+t.id+'-'+t.versao,origem:'tarefa'})),
    ...alertas.dados.value.map(n=>({...n,chave:'a-'+n.id,origem:'alerta'})),
  ].sort((a,b)=>(b.criadoEm?.toMillis?.()||0)-(a.criadoEm?.toMillis?.()||0)));
  const lidas = computed(()=>new Set(leituras.dados.value.map(l=>l.id)));
  const naoLidas = computed(()=>itens.value.filter(n=>!lidas.value.has(n.chave)));
  async function marcarLida(n) {
    if (!usuario.value || !itens.value.some(i=>i.chave===n.chave)) return;
    const b = writeBatchAuditado(db);
    b.set(doc(db,'usuarios',usuario.value.uid,'leituras',n.chave),{lidaEm:serverTimestamp()});
    await b.commit();
  }
  const caixa = {tarefas,alertas,leituras,itens,naoLidas,lidas,marcarLida};
  provide(CHAVE,caixa); return caixa;
}
export function usarCaixaEntrada() { return inject(CHAVE); }
