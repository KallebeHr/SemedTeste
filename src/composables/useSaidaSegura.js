import { onBeforeUnmount, onMounted, toValue } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
const formularios=new Set();
export function confirmarAlteracoes(){return ![...formularios].some(f=>toValue(f)) || window.confirm('Há alterações não salvas. Deseja sair e descartá-las?');}
// Somente memória: nenhum CPF, senha ou registro de aluno em localStorage.
export function useSaidaSegura(pendente) {
  function confirmar() {
    return !toValue(pendente) || window.confirm('Há alterações não salvas. Deseja sair e descartá-las?');
  }
  function antesDeFechar(e) {
    if (toValue(pendente)) { e.preventDefault(); e.returnValue = ''; }
  }
  onBeforeRouteLeave(confirmar);
  onMounted(() => {formularios.add(pendente);window.addEventListener('beforeunload', antesDeFechar);});
  onBeforeUnmount(() => {formularios.delete(pendente);window.removeEventListener('beforeunload', antesDeFechar);});
  return { confirmar };
}
