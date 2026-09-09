<template>
  <div class="p-card conta-card">
    <template v-if="!administrativa && conta"
      ><h2>Conta de atendimento</h2>
      <p>{{ conta.email }}</p>
      <p class="p-small">Seu identificador para vínculo com a escola:</p>
      <p class="conta-uid">{{ conta.uid }}</p>
      <p v-if="!conta.emailVerified" class="p-alert">
        Confirme seu e-mail para enviar solicitações. Abra o link recebido e
        clique em “Já confirmei”.
      </p>
      <div class="p-actions">
        <button
          v-if="!conta.emailVerified"
          class="p-button"
          :disabled="ocupado"
          @click="verificar"
        >
          Enviar confirmação</button
        ><button
          v-if="!conta.emailVerified"
          class="p-button primary"
          :disabled="ocupado"
          @click="atualizar"
        >
          Já confirmei</button
        ><button class="p-button" @click="sair">Sair</button>
      </div></template
    >
    <form v-else @submit.prevent="enviar">
      <p class="p-eyebrow">SEDUC · PEDRO II</p>
      <h1 v-if="administrativa">Acesso à administração</h1>
      <h2 v-else>
        {{
          cadastro
            ? "Criar conta de atendimento"
            : "Entrar na conta de atendimento"
        }}
      </h2>
      <p class="p-muted">
        {{
          administrativa
            ? "Entre com o e-mail e a senha da sua conta autorizada."
            : "A conta protege suas solicitações e o acesso ao boletim."
        }}
      </p>
      <fieldset :disabled="ocupado" class="p-stack">
        <label class="p-field"
          >E-mail<input
            aria-label="E-mail"
            v-model="email"
            type="email"
            autocomplete="username"
            required
            maxlength="200" /></label
        ><label class="p-field"
          >Senha
          <div class="password">
            <input
              v-model="senha"
              aria-label="Senha"
              :type="mostrar ? 'text' : 'password'"
              :autocomplete="cadastro ? 'new-password' : 'current-password'"
              required
              :minlength="cadastro ? 12 : undefined"
            /><button
              type="button"
              :aria-pressed="mostrar"
              @click="mostrar = !mostrar"
            >
              {{ mostrar ? "Ocultar" : "Mostrar" }}
            </button>
          </div>
          <small v-if="cadastro">Use pelo menos 12 caracteres.</small></label
        ><label v-if="cadastro" class="p-check"
          ><input v-model="ciente" type="checkbox" required /> Li as informações
          de <router-link to="/privacidade">privacidade</router-link>.</label
        ><button class="p-button primary">
          {{
            ocupado ? "Aguarde…" : cadastro ? "Criar minha conta" : "Entrar"
          }}</button
        ><button type="button" class="link-button" @click="redefinir">
          Esqueci minha senha</button
        ><button
          v-if="!administrativa"
          type="button"
          class="link-button"
          @click="cadastro = !cadastro"
        >
          {{ cadastro ? "Já tenho uma conta" : "Ainda não tenho conta" }}
        </button>
      </fieldset>
    </form>
    <p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
    <p v-if="mensagem" class="p-alert success" role="status">{{ mensagem }}</p>
    <router-link v-if="administrativa" to="/"
      >Voltar ao portal público</router-link
    >
  </div>
</template>
<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  getIdToken,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../composables/useAuth";
import { destinoAdministrativo } from "../../portal/permissoes";
import { mensagemErro } from "../../portal/validacao";
const props = defineProps({ administrativa: Boolean }),
  emit = defineEmits(["atualizada"]),
  sessao = useAuth(),
  { conta } = sessao,
  router = useRouter(),
  route = useRoute(),
  email = ref(""),
  senha = ref(""),
  cadastro = ref(false),
  mostrar = ref(false),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  ciente = ref(false);
async function enviar() {
  if (ocupado.value) return;
  ocupado.value = true;
  erro.value = "";
  mensagem.value = "";
  try {
    await setPersistence(auth, browserSessionPersistence);
    if (props.administrativa) {
      await sessao.entrar(email.value, senha.value);
      await router.replace(destinoAdministrativo(route.query.redirect));
    } else {
      if (cadastro.value) {
        await createUserWithEmailAndPassword(
          auth,
          email.value.trim(),
          senha.value,
        );
        try {
          await sendEmailVerification(auth.currentUser);
          mensagem.value =
            "Conta criada. Enviamos a confirmação para o seu e-mail.";
        } catch {
          mensagem.value =
            "Conta criada. Use Enviar confirmação para verificar seu e-mail.";
        }
      } else
        await signInWithEmailAndPassword(auth, email.value.trim(), senha.value);
      emit("atualizada");
    }
    senha.value = "";
  } catch (e) {
    erro.value = props.administrativa
      ? sessao.erro.value || mensagemErro(e)
      : mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
async function redefinir() {
  if (ocupado.value) return;
  erro.value = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    erro.value = "Informe seu e-mail no campo acima.";
    return;
  }
  ocupado.value = true;
  try {
    await sendPasswordResetEmail(auth, email.value.trim());
    mensagem.value =
      "Se houver uma conta para este e-mail, você receberá as orientações de recuperação.";
  } catch (e) {
    if (e.code === 'auth/user-not-found')
      mensagem.value = 'Se houver uma conta para este e-mail, você receberá as orientações de recuperação.';
    else erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
async function verificar() {
  ocupado.value = true;
  erro.value = "";
  try {
    await sendEmailVerification(auth.currentUser);
    mensagem.value = "Confirmação enviada. Confira também a pasta de spam.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
async function atualizar() {
  ocupado.value = true;
  try {
    await reload(auth.currentUser);
    await getIdToken(auth.currentUser, true);
    conta.value = {
      ...auth.currentUser,
      emailVerified: auth.currentUser.emailVerified,
    };
    emit("atualizada");
    mensagem.value = auth.currentUser.emailVerified
      ? "E-mail confirmado."
      : "O e-mail ainda não foi confirmado.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
async function sair() {
  await sessao.sair();
  emit("atualizada");
}
</script>
<style scoped>
.conta-card {
  max-width: 560px;
  margin-inline: auto;
}
.conta-card form {
  display: grid;
  gap: 1.2rem;
}
.conta-card h1 {
  font-size: 2rem;
}
.conta-card fieldset {
  border: 0;
  min-width: 0;
}
.password {
  display: flex;
  border: 1px solid var(--p-border);
  border-radius: 0.55rem;
}
.password input {
  border: 0;
}
.password button {
  padding: 0.5rem;
  font-size: 0.8rem;
  color: var(--p-teal);
}
.link-button {
  color: var(--p-blue);
  text-decoration: underline;
  min-height: 36px;
}
.conta-uid {
  overflow-wrap: anywhere;
  font-family: monospace;
  font-size: 0.83rem;
  background: var(--p-soft);
  padding: 0.65rem;
  border-radius: 0.4rem;
}
</style>
