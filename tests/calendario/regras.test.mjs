import { before, after, test } from "node:test";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error("Somente emulador");
let env;
const ctx = (uid) =>
  env
    .authenticatedContext(uid, { auth_time: Math.floor(Date.now() / 1000) })
    .firestore();
async function auditWrite(db, ref, patch, antes = null) {
  const batch = writeBatch(db),
    a = doc(db, "auditoriaRegistros", crypto.randomUUID());
  const depois = {
    ...antes,
    ...patch,
    _auditoria: a.id,
    _registradoEm: serverTimestamp(),
  };
  const partes = ref.path.split("/");
  batch.set(ref, depois);
  batch.set(a, {
    versaoEsquema: 1,
    caminho: ref.path,
    alvo: ref,
    colecao: partes.at(-2),
    documentoId: ref.id,
    escolaId: null,
    dominio: "portal",
    acao: antes ? "update" : "create",
    usuarioId: "master",
    usuarioNome: "Master Teste",
    papelUsuario: "master",
    dadosAntes: antes,
    dadosDepois: depois,
    timestamp: serverTimestamp(),
  });
  return batch.commit();
}

before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-calendario",
    firestore: {
      host,
      port: Number(port),
      rules: fs.readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const papel of ["master", "alimentador"])
      await setDoc(doc(c.firestore(), "usuarios", papel), {
        papel,
        ativo: true,
        nome: "Master Teste",
      });
  });
});
after(async () => env?.cleanup());
test("rascunho privado exige Master e auditoria; publicação coincide com rascunho e fica pública", async () => {
  const db = ctx("master"),
    r = doc(db, "calendariosEscolares", "2026");
  const patch = {
    ano: 2026,
    dadosJson: "{}",
    versao: 1,
    atualizadoEm: serverTimestamp(),
  };
  await assertFails(setDoc(r, patch));
  await assertSucceeds(auditWrite(db, r, patch));
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), r.path)),
  );
  await assertFails(getDoc(doc(ctx("alimentador"), r.path)));
  const dados = (await getDoc(r)).data(),
    p = doc(db, "calendariosPublicos", "2026");
  await assertFails(
    auditWrite(db, p, {
      ...dados,
      dadosJson: "outro",
      publicadoEm: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    auditWrite(db, p, { ...dados, publicadoEm: serverTimestamp() }),
  );
  await assertSucceeds(
    getDocs(
      collection(
        env.unauthenticatedContext().firestore(),
        "calendariosPublicos",
      ),
    ),
  );
  await assertFails(auditWrite(db, r, { ...patch, versao: 1 }, dados));
});
