import { computed } from 'vue';
import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { useColecao } from './useColecao';
export const PARAMETROS_PADRAO = Object.freeze({diasVistoria:30,diasValidade:15,categoriasTexto:'perecivel\nnao_perecivel\nhortifruti\nlimpeza\ndescartavel',versao:0});
export function useParametros() {
  const {usuario} = useAuth();
  const consulta = useColecao(()=>usuario.value?doc(db,'parametros','sistema'):null,()=>usuario.value?.uid);
  const parametros = computed(()=>({...PARAMETROS_PADRAO,...consulta.dados.value[0]}));
  const categorias = computed(()=>[...new Set(parametros.value.categoriasTexto.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))]);
  return {consulta,parametros,categorias};
}
