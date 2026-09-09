<template>
  <aside v-if="aviso" class="session-warning p-alert" role="alert" aria-label="Aviso de sessão">
    <p>{{ aviso }}</p>
    <button v-if="!expirada" class="p-button" @click="renovar">Continuar trabalhando</button>
    <router-link v-else class="p-button" to="/login">Entrar novamente</router-link>
  </aside>
</template>
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { getIdTokenResult } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../composables/useAuth';
const { usuario, sair } = useAuth();
const aviso = ref(''), expirada = ref(false);
let ultimaAtividade = Date.now(), limite = Infinity, timer, encerrando = false, geracao = 0;
function renovar() { ultimaAtividade = Date.now(); aviso.value = ''; }
function atividade() { if (!aviso.value) ultimaAtividade = Date.now(); }
async function conferir() {
  if (!usuario.value || encerrando) return;
  const restante = Math.min(limite - Date.now(), 30 * 60000 - (Date.now() - ultimaAtividade));
  if (restante <= 0) {
    encerrando = true;
    expirada.value = true;
    aviso.value = 'Sua sessão administrativa expirou. Alterações ainda não salvas não foram enviadas.';
    try { await sair(); } finally { encerrando = false; }
  } else if (restante < 2 * 60000) {
    aviso.value = 'Sua sessão está próxima do limite. Salve seu trabalho. Após 8 horas será necessário entrar novamente.';
  }
}
watch(() => [usuario.value?.uid,usuario.value?.sessaoRevogadaEm], async ([uid]) => {
  const atual = ++geracao;
  if (!uid || !auth.currentUser) return;
  renovar(); expirada.value = false;
  try {
    const token = await getIdTokenResult(auth.currentUser);
    if (geracao === atual) limite = Number(token.claims.auth_time)<Number(usuario.value?.sessaoRevogadaEm||0) ? 0 : Number(token.claims.auth_time) * 1000 + 8 * 3600000;
  } catch { if (geracao === atual) limite = 0; }
  await conferir().catch(()=>{aviso.value='Não foi possível encerrar a sessão. Feche esta aba e entre novamente.';});
}, { immediate: true });
onMounted(() => {
  timer = setInterval(() => { conferir().catch(() => { aviso.value = 'Não foi possível encerrar a sessão. Feche esta aba e entre novamente.'; }); }, 15000);
  for (const e of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(e, atividade, { passive: true });
});
onUnmounted(() => {
  clearInterval(timer); geracao++;
  for (const e of ['pointerdown', 'keydown', 'scroll']) window.removeEventListener(e, atividade);
});
</script>
<style scoped>
.session-warning { position: fixed; bottom: 1rem; right: 1rem; max-width: min(32rem, calc(100vw - 2rem)); z-index: 150; box-shadow: 0 4px 24px #0003; }
</style>
