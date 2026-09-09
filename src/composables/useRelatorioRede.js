import { ref, watch, onScopeDispose } from 'vue';
import { collection, getDocsFromServer, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { dataValida, mensagemErro } from '../portal/validacao';
import { consolidarRede } from '../portal/indicadores';
export function useRelatorioRede() {
  const { usuario, exigirUsuario, pode } = useAuth();
  const dados = ref(null), carregando = ref(false), erro = ref(''), parcial = ref(false), consultadoEm = ref(null);
  let geracao = 0;
  function limpar() { geracao++; dados.value = null; carregando.value = false; erro.value = ''; }
  watch(() => [usuario.value?.uid, usuario.value?.papel, JSON.stringify(usuario.value?.escolasVinculadas)], limpar);
  onScopeDispose(limpar);
  async function carregar(escolas, inicio, fim, diasVistoria = 30) {
    if (!pode('merenda')) throw new Error('Acesso restrito à alimentação escolar.');
    const u = exigirUsuario();
    if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) { erro.value = 'Confira o período do relatório.'; return; }
    const g = ++geracao;
    const timer=setTimeout(()=>{if(g===geracao){geracao++;carregando.value=false;dados.value=null;erro.value='A consulta não foi confirmada em 45 segundos. Confira a conexão e tente um período menor.';}},45000);
    carregando.value = true; erro.value = ''; dados.value = null; parcial.value = escolas.length > 200;
    const resultados = [], lista = escolas.slice(0,200);
    const de = Timestamp.fromDate(new Date(inicio+'T00:00:00-03:00'));
    const ate = Timestamp.fromDate(new Date(new Date(fim+'T00:00:00-03:00').getTime()+86400000));
    try {
      for (let i=0; i<lista.length; i+=3) {
        const grupo = await Promise.all(lista.slice(i,i+3).map(async e => {
          exigirUsuario(e.id);
          const buscar = (sub, ...f) => getDocsFromServer(query(collection(db,'escolas',e.id,sub),...f,limit(1001)));
          const [itens,mov,vist,ultima] = await Promise.all([
            buscar('estoque'), buscar('movimentacoes',where('data','>=',de),where('data','<',ate),orderBy('data','desc')),
            buscar('vistorias',where('data','>=',de),where('data','<',ate),orderBy('data','desc')),
            getDocsFromServer(query(collection(db,'escolas',e.id,'vistorias'),orderBy('data','desc'),limit(1))),
          ]);
          const map = s => s.docs.slice(0,1000).map(d => ({...d.data(),id:d.id}));
          return {...e, estoque:map(itens), movimentos:map(mov), vistorias:map(vist), ultimaVistoria:ultima.docs[0]?.data(), limitado:[itens,mov,vist].some(s=>s.size>1000)};
        }));
        if (g !== geracao || u.uid !== usuario.value?.uid) return;
        resultados.push(...grupo);
      }
      if (g === geracao) {
        parcial.value ||= resultados.some(e=>e.limitado);
        dados.value = consolidarRede(resultados,diasVistoria);
        consultadoEm.value = new Date();
      }
    } catch(e) { if (g === geracao) { erro.value = mensagemErro(e); dados.value = null; } }
    finally {clearTimeout(timer);if (g === geracao) carregando.value = false; }
  }
  return { dados, carregando, erro, parcial, consultadoEm, carregar };
}
