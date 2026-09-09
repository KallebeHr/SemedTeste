import { ref, computed } from "vue";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDocFromServer,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../firebase";

import { pode, cargoAtual } from "../portal/permissoes";

const usuario = ref(null);
const conta = ref(null);
let pararPerfil;
let geracaoPerfil = 0;
const carregando = ref(true);
const erro = ref("");
const papeis = [
  "master",
  "alimentador",
  "admin",
  "nutricionista",
  "gerente",
  "diretor",
  "professor",
];
let inicializacao;
let perfilPendente;
let uidPendente;

function carregarPerfil(fbUser) {
  if (perfilPendente && uidPendente === fbUser.uid) return perfilPendente;
  uidPendente = fbUser.uid;
  const tarefa = (async () => {
    const referencia = doc(db, "usuarios", fbUser.uid);
    const snap = await getDocFromServer(referencia);
    if (
      !snap.exists() ||
      !papeis.includes(snap.data().papel) ||
      snap.data().ativo === false
    ) {
      throw new Error(
        "Sua conta ainda não tem acesso à administração. Solicite a liberação ao Master.",
      );
    }
    const dados = snap.data();
    const perfil = {
      ...dados,
      uid: fbUser.uid,
      nome: dados.nome || fbUser.displayName || fbUser.email,
      email: fbUser.email,
      escolasVinculadas: Array.isArray(dados.escolasVinculadas)
        ? dados.escolasVinculadas
        : [],
    };
    if (auth.currentUser?.uid === fbUser.uid) {
      usuario.value = perfil;
      pararPerfil?.();
      const geracao = ++geracaoPerfil;
      pararPerfil = onSnapshot(
        referencia,
        { includeMetadataChanges: true },
        (atual) => {
          if (
            atual.metadata?.fromCache ||
            geracao !== geracaoPerfil ||
            auth.currentUser?.uid !== fbUser.uid
          )
            return;
          const d = atual.exists() ? atual.data() : null;
          usuario.value =
            d && d.ativo !== false && papeis.includes(d.papel)
              ? {
                  ...perfil,
                  ...d,
                  uid: fbUser.uid,
                  escolasVinculadas: Array.isArray(d.escolasVinculadas)
                    ? d.escolasVinculadas
                    : [],
                }
              : null;
        },
        () => {
          if (geracao === geracaoPerfil) usuario.value = null;
        },
      );
    }
    updateDoc(referencia, { ultimoAcesso: serverTimestamp() }).catch(() => {});
    return perfil;
  })();
  perfilPendente = tarefa;
  const limpar = () => {
    if (perfilPendente === tarefa) perfilPendente = null;
  };
  tarefa.then(limpar, limpar);
  return tarefa;
}

export function aguardarAutenticacao() {
  if (!inicializacao) {
    inicializacao = new Promise((resolve) => {
      onAuthStateChanged(
        auth,
        async (fbUser) => {
          carregando.value = true;
          conta.value = fbUser;
          pararPerfil?.();
          geracaoPerfil += 1;
          usuario.value = null;
          try {
            if (fbUser) await carregarPerfil(fbUser);
          } catch (e) {
            erro.value = mensagemAuth(e);
          } finally {
            carregando.value = false;
            resolve();
          }
        },
        (e) => {
          usuario.value = null;
          erro.value = mensagemAuth(e);
          carregando.value = false;
          resolve();
        },
      );
    });
  }
  return inicializacao;
}

function mensagemAuth(e) {
  const mensagens = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/user-disabled":
      "Esta conta está desativada. Contate a administração.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/network-request-failed":
      "Não foi possível conectar. Verifique sua internet.",
    "auth/operation-not-allowed":
      "O acesso por e-mail e senha ainda não está habilitado. Contate a administração.",
    "permission-denied":
      "Não foi possível consultar suas permissões. Entre novamente; se persistir, contate a administração.",
    unavailable: "Serviço indisponível. Verifique a conexão e tente novamente.",
  };
  return (
    mensagens[e.code] ||
    (e.code ? "Não foi possível entrar. Tente novamente." : e.message)
  );
}

export function useAuth() {
  const ehGestao = computed(() =>
    ["master", "nutricionista"].includes(cargoAtual(usuario.value?.papel)),
  );
  const ehDiretor = computed(() => usuario.value?.papel === "diretor");
  const ehProfessor = computed(() => usuario.value?.papel === "professor");

  async function entrar(email, senha) {
    await aguardarAutenticacao();
    erro.value = "";
    carregando.value = true;
    try {
      const resultado = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        senha,
      );
      await carregarPerfil(resultado.user);
    } catch (e) {
      usuario.value = null;
      erro.value = mensagemAuth(e);
      throw e;
    } finally {
      carregando.value = false;
    }
  }

  async function sair() {
    await signOut(auth);
    usuario.value = null;
    erro.value = "";
  }

  function podeAcessarEscola(escolaId) {
    return (
      !!usuario.value &&
      (ehGestao.value || usuario.value.escolasVinculadas.includes(escolaId))
    );
  }

  function exigirUsuario(escolaId, somenteGestao = false) {
    if (!usuario.value || usuario.value.ativo === false)
      throw new Error("Entre na sua conta para continuar.");
    if (somenteGestao && !ehGestao.value)
      throw new Error("Ação disponível somente para a gestão.");
    if (escolaId && !podeAcessarEscola(escolaId))
      throw new Error("Você não tem acesso a esta escola.");
    return usuario.value;
  }

  return {
    usuario,
    conta,
    pode: (acao) => pode(usuario.value, acao),
    carregando,
    erro,
    ehGestao,
    ehDiretor,
    ehProfessor,
    entrar,
    sair,
    podeAcessarEscola,
    exigirUsuario,
  };
}
