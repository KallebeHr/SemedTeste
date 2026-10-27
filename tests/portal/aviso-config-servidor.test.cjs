const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { criarHandlerAviso } = require("../../server/portal/aviso.cjs");
let app, db, handler;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error("Use emulador.");
  app = initializeApp({ projectId: "demo-aviso-config" }, "qa-aviso");
  db = getFirestore(app);
  for (const [uid, papel] of [
    ["master", "master"],
    ["editor", "alimentador"],
    ["nutri", "nutricionista"],
  ])
    await db.doc("usuarios/" + uid).set({ papel, ativo: true, nome: uid });
  await db.doc("publicacoes/config-aviso-portal").delete();
  handler = criarHandlerAviso({
    db,
    auth: {
      verifyIdToken: async (t) => {
        if (!t) throw Error();
        return { uid: t, auth_time: Math.floor(Date.now() / 1000) };
      },
    },
    origens: ["https://www.semedpii.com.br"],
  });
});
after(async () => {
  await deleteApp(app);
});
async function chamar(ativo, versao, uid = "master") {
  let status, body;
  await handler(
    {
      method: "POST",
      headers: {
        origin: "https://www.semedpii.com.br",
        "content-type": "application/json",
        authorization: "Bearer " + uid,
      },
      body: { ativo, versao },
    },
    {
      setHeader() {},
      status(n) {
        status = n;
        return {
          json(d) {
            body = d;
          },
        };
      },
    },
  );
  return { status, body };
}
test("Master ativa e desativa comunicado sem alterar contatos ou conteúdo, com auditoria", async () => {
  await db.doc("portalPublico/configuracao").set({ heroTitulo: "Preservado" });
  assert.equal((await chamar(true, 0)).status, 200);
  assert.equal(
    (await db.doc("publicacoes/config-aviso-portal").get()).data()
      .avisoAtualizacaoAtivo,
    true,
  );
  assert.equal((await chamar(false, 1, "editor")).status, 200);
  assert.equal(
    (await db.doc("publicacoes/config-aviso-portal").get()).data()
      .avisoAtualizacaoAtivo,
    false,
  );
  assert.equal(
    (await db.doc("portalPublico/configuracao").get()).data().heroTitulo,
    "Preservado",
  );
  assert.equal(
    (
      await db
        .collection("auditoriaRegistros")
        .where("caminho", "==", "publicacoes/config-aviso-portal")
        .get()
    ).size,
    2,
  );
});
test("bloqueia perfil comum, anônimo, versão obsoleta e valores inválidos", async () => {
  assert.equal((await chamar(true, 2, "nutri")).status, 403);
  assert.equal((await chamar(true, 2, "")).status, 401);
  assert.equal((await chamar(true, 0)).status, 409);
  assert.equal((await chamar("true", 2)).status, 400);
});
