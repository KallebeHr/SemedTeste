import { app, auth, db } from "../firebase";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signOut,
  signInAnonymously,
  connectAuthEmulator,
} from "firebase/auth";
import {
  doc,
  getDocFromServer,
  getFirestore,
  connectFirestoreEmulator,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { runTransactionAuditada } from "../portal/auditoria";
import { configuracao } from "../../shared/editais.mjs";
import {
  enviarFicha,
  lerFormulario,
  catalogoFormularios,
  listarFichas,
  refFicha,
  apresentar,
} from "./editaisFirestore.mjs";

let sessao;
let appCheckIniciado = false;
async function participante() {
  if (!sessao)
    sessao = (async () => {
      const secundario =
        getApps().find((a) => a.name === "inscricoes-publicas") ||
        initializeApp(app.options, "inscricoes-publicas");
      const a = getAuth(secundario),
        banco = getFirestore(secundario);
      if (
        import.meta.env.DEV &&
        import.meta.env.VITE_FIREBASE_EMULATORS === "true"
      ) {
        if (!a.emulatorConfig) {
          connectAuthEmulator(a, "http://127.0.0.1:9099", {
            disableWarnings: true,
          });
          connectFirestoreEmulator(banco, "127.0.0.1", 8080);
        }
      } else if (
        import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY &&
        !appCheckIniciado
      ) {
        const { initializeAppCheck, ReCaptchaEnterpriseProvider } =
          await import("firebase/app-check");
        initializeAppCheck(secundario, {
          provider: new ReCaptchaEnterpriseProvider(
            import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
          ),
          isTokenAutoRefreshEnabled: true,
        });
        appCheckIniciado = true;
      }
      await a.authStateReady();
      if (!a.currentUser) await signInAnonymously(a);
      return { banco, uid: a.currentUser.uid, auth: a };
    })().catch((e) => {
      sessao = null;
      throw e;
    });
  return sessao;
}
export async function encerrarSessaoInscricao() {
  const atual = await participante();
  await signOut(atual.auth);
  sessao = null;
}
export async function enviarInscricao(editalId, dados, versao, website) {
  if (website) throw Error("Não foi possível enviar.");
  try {
    const { banco, uid } = await participante();
    return await enviarFicha(banco, uid, editalId, dados, versao);
  } catch (e) {
    if (
      e.code === "auth/operation-not-allowed" ||
      e.code === "auth/admin-restricted-operation"
    )
      throw Error(
        "Inscrições indisponíveis: a SEMED precisa habilitar a autenticação anônima no Firebase.",
      );
    if (e.code === "permission-denied")
      throw Error(
        "O Firebase recusou o envio. Confira a abertura do edital ou solicite à SEMED a publicação das regras de inscrições.",
      );
    throw e;
  }
}
async function dadosAdmin(b) {
  if (!auth.currentUser) throw Error("Entre como Master.");
  if (b.acao === "catalogo") return catalogoFormularios(db, b.cursor);
  const ref = doc(db, "editaisConfiguracao", b.editalId);
  if (b.acao === "config")
    return { config: (await getDocFromServer(ref)).data() || null };
  if (b.acao === "configurar") {
    const c = configuracao({ ...b.config, obrigatorios: [] });
    await runTransactionAuditada(db, async (tx) => {
      const old = (await tx.get(ref)).data();
      if ((old?.versao || 0) !== b.versao)
        throw Error("Configuração alterada. Reabra o editor.");
      tx.set(ref, {
        ...c,
        modo: "texto",
        pdf: old?.pdf || null,
        versao: b.versao + 1,
        inicioEm: c.inicio ? Timestamp.fromDate(new Date(c.inicio)) : null,
        fimEm: c.fim ? Timestamp.fromDate(new Date(c.fim)) : null,
      });
    });
    return { ok: true };
  }
  if (b.acao === "listar") return listarFichas(db, b.editalId, b);
  if (b.acao === "detalhe") {
    const s = await getDocFromServer(refFicha(db, b.editalId, b.id));
    if (!s.exists()) throw Error("Inscrição não encontrada.");
    return apresentar(s);
  }
  if (b.acao === "confirmar") {
    await runTransactionAuditada(db, async (tx) => {
      const r = refFicha(db, b.editalId, b.id),
        s = await tx.get(r);
      if (!s.exists()) throw Error("Inscrição não encontrada.");
      if (s.data().status === "confirmada") return;
      tx.update(r, {
        status: "confirmada",
        confirmadoPor: auth.currentUser.uid,
        confirmadoEm: serverTimestamp(),
      });
    });
    return { ok: true };
  }
  throw Error("Ação não disponível.");
}
export async function editaisApi(body, admin = false, arquivo = false) {
  if (body.acao !== "pdf") return dadosAdmin(body);
  const headers = { "Content-Type": "application/json" };
  if (admin) {
    if (!auth.currentUser) throw Error("Entre como Master.");
    headers.Authorization = "Bearer " + (await auth.currentUser.getIdToken());
  }
  let r;
  try {
    r = await fetch("/api/editais", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    throw Error(
      "Sem confirmação do servidor. Mantenha esta tela aberta e tente novamente com os mesmos dados.",
    );
  }
  if (!r.ok)
    throw Error(
      (await r.json().catch(() => ({}))).erro || "Serviço indisponível.",
    );
  return arquivo ? r.blob() : r.json();
}
export async function lerEdital(id) {
  return lerFormulario(db, id);
}
export function arquivoBase64(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(f);
  });
}
export function salvarBlob(blob, nome) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
