import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import { doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../composables/useAuth";
import { transacaoConfirmada } from "./transacao";
import { CARGOS, cargoAtual } from "./permissoes";
export async function salvarPerfil(d, novo = false) {
  const { exigirUsuario, pode } = useAuth(),
    u = exigirUsuario();
  if (!pode("usuarios")) throw new Error("Somente o Master gerencia contas.");
  if (!Array.isArray(d.escolasVinculadas))
    throw new Error("Confira os vínculos com escolas.");
  if (d.escolasVinculadas.length > 20)
    throw new Error("Vincule até 20 escolas por perfil.");
  if (!CARGOS[d.papel] || !d.nome.trim() || !Array.isArray(d.escolasVinculadas))
    throw new Error("Confira nome, cargo e vínculos.");
  let uid = d.uid.trim();
  if (!novo && !/^[A-Za-z0-9:_-]{1,128}$/.test(uid))
    throw new Error("Informe o UID da conta no Firebase Authentication.");
  if (uid === u.uid && (cargoAtual(d.papel) !== "master" || d.ativo === false))
    throw new Error("Você não pode remover seu próprio acesso de Master.");
  if (novo) {
    if (d.senha.length < 12)
      throw new Error(
        "A senha temporária precisa ter pelo menos 12 caracteres.",
      );
    const app =
        getApps().find((a) => a.name === "cadastro-equipe") ||
        initializeApp(getApp().options, "cadastro-equipe"),
      authSec = getAuth(app);
    if (
      import.meta.env.DEV &&
      import.meta.env.VITE_FIREBASE_EMULATORS === "true" &&
      !authSec.emulatorConfig
    )
      connectAuthEmulator(authSec, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    await setPersistence(authSec, inMemoryPersistence);
    try {
      const conta = await createUserWithEmailAndPassword(
        authSec,
        d.email.trim(),
        d.senha,
      );
      uid = conta.user.uid;
      d.uid = uid;
    } finally {
      await signOut(authSec);
    }
  }
  const dados = {
    nome: d.nome.trim(),
    email: d.email.trim(),
    papel: d.papel,
    ativo: d.ativo !== false,
    escolasVinculadas: [...new Set(d.escolasVinculadas)],
    atualizadoEm: serverTimestamp(),
  };
  await transacaoConfirmada(async (b) => {
    b.set(doc(db, "usuarios", uid), dados, { merge: true });
    b.set(doc(db, "equipe", uid), {
      nome: dados.nome,
      papel: dados.papel,
      ativo: dados.ativo,
      escolasVinculadas: dados.escolasVinculadas,
    });
  });
  return uid;
}
