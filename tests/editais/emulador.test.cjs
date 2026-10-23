const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { randomUUID } = require("node:crypto");
const { initializeApp, deleteApp } = require("firebase-admin/app"),
  { getFirestore } = require("firebase-admin/firestore");
const {
  initializeTestEnvironment,
  assertFails,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc } = require("firebase/firestore");
const { criarHandlerEditais } = require("../../server/editais/handler.cjs"),
  { PDFDocument } = require("pdf-lib");
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw Error(
    "Use npm run test:editais:emulador. Nenhum teste pode usar produção.",
  );
let db, app, env, handler, config, campos, pdfBytes;
const stored = new Map();
let puts = 0,
  fail = false;
const origin = "https://www.semedpii.com.br",
  editalId = "teste-edital",
  id = randomUUID(),
  chave = "a".repeat(64);
async function call(acao, extra = {}, role) {
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.code = n;
      return this;
    },
    json(d) {
      this.body = d;
    },
    send(d) {
      this.body = d;
    },
  };
  await handler(
    {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-vercel-forwarded-for": "127.0.0.1",
        authorization: role ? "Bearer " + role : "",
      },
      body: { acao, editalId, id, chave, ...extra },
    },
    res,
  );
  return res;
}
before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-seduc-editais",
    firestore: {
      host,
      port: Number(port),
      rules: fs.readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  app = initializeApp({ projectId: "demo-seduc-editais" }, "editais-test");
  db = getFirestore(app);
  const shared = await import("../../shared/editais.mjs");
  campos = shared.campos;
  config = shared.configuracao({
    ativo: true,
    validado: true,
    privacidade: "Privacidade para testes",
    obrigatorios: ["relato"],
  });
  await Promise.all([
    db
      .doc("usuarios/master")
      .set({ papel: "master", ativo: true, nome: "Master Teste" }),
    db.doc("usuarios/alimentador").set({ papel: "alimentador", ativo: true }),
    db.doc("conteudos/" + editalId).set({ tipo: "edital", titulo: "Teste" }),
    db.doc("publicacoes/" + editalId).set({ tipo: "edital", titulo: "Teste" }),
  ]);
  handler = criarHandlerEditais({
    db,
    auth: {
      verifyIdToken: async (t) => {
        if (!t) throw Error("auth");
        return { uid: t, auth_time: Date.now() / 1000 - 1 };
      },
    },
    b2: {
      put: async (k, bytes) => {
        if (fail) throw Error("B2 offline");
        puts++;
        stored.set(k, bytes);
        return "version";
      },
      get: async (k) => stored.get(k),
    },
    origens: [origin],
    clienteId: "pedro-ii",
    rateSecret: "test-only",
  });
  const p = await PDFDocument.create();
  p.addPage();
  pdfBytes = Buffer.from(await p.save());
});
after(async () => {
  await env?.cleanup();
  if (app) await deleteApp(app);
});
test("fluxo completo isolado: configurar, upload, enviar, consultar, confirmar e auditar", async () => {
  assert.equal((await call("config", {}, "alimentador")).code, 403);
  assert.equal(
    (await call("configurar", { config, versao: 0 }, "master")).code,
    200,
  );
  assert.equal(
    (await call("configurar", { config, versao: 0 }, "master")).code,
    409,
  );
  assert.equal(
    (
      await call(
        "pdf",
        {
          versao: 1,
          base64: pdfBytes.toString("base64"),
          mime: "application/pdf",
          nome: "edital.pdf",
        },
        "master",
      )
    ).code,
    200,
  );
  assert.equal((await call("iniciar")).code, 200);
  const dados = {
    ...Object.fromEntries(campos(config).map((f) => [f.id, "Escola de teste"])),
    email: "teste@example.com",
    telefone: "86999991234",
    aceite: true,
  };
  assert.equal((await call("enviar", { dados })).code, 400);
  assert.equal((await call("consultar", { chave: "b".repeat(64) })).code, 403);
  const arquivoId = randomUUID(),
    upload = {
      arquivoId,
      tipo: "relato",
      base64: pdfBytes.toString("base64"),
      mime: "application/pdf",
      nome: "relato.pdf",
    };
  assert.equal((await call("upload", upload)).code, 200);
  const n = puts;
  assert.equal((await call("upload", upload)).code, 200);
  assert.equal(puts, n);
  const sent = await call("enviar", { dados });
  assert.equal(sent.code, 200, JSON.stringify(sent.body));
  assert.equal(sent.body.status, "recebida");
  assert.ok(sent.body.protocolo);
  assert.equal(sent.body.chaveHash, undefined);
  assert.equal(sent.body.config.pdf, undefined);
  assert.equal(sent.body.arquivos[0].key, undefined);
  const repeat = await call("enviar", { dados });
  assert.equal(repeat.body.protocolo, sent.body.protocolo);
  assert.equal(
    (await db.doc("editaisInscricoes/" + editalId).get()).data().recebidas,
    1,
  );
  assert.equal(
    (await call("enviar", { dados: { ...dados, titulo: "Alterado" } })).code,
    409,
  );
  assert.equal(
    (await call("upload", { ...upload, arquivoId: randomUUID() })).code,
    409,
  );
  assert.equal((await call("anexo", { arquivoId })).code, 200);
  assert.equal(
    (await call("anexo", { arquivoId, editalId: "outro-edital" })).code,
    403,
  );
  assert.equal((await call("detalhe", {}, "alimentador")).code, 403);
  assert.equal((await call("confirmar")).code, 401);
  assert.equal((await call("confirmar", {}, "master")).code, 200);
  assert.equal((await call("confirmar", {}, "master")).code, 200);
  const detalhe = await call("detalhe", {}, "master");
  assert.equal(detalhe.body.status, "confirmada");
  assert.deepEqual(detalhe.body.dados, sent.body.dados);
  assert.equal(
    (await db.doc("editaisInscricoes/" + editalId).get()).data().confirmadas,
    1,
  );
  const logs = await db
    .collection("auditoriaRegistros")
    .where("acao", "==", "confirmar")
    .get();
  assert.equal(logs.size, 1);
  const lista = await call("listar", { busca: "escola" }, "master");
  assert.equal(lista.code, 200, JSON.stringify(lista.body));
  assert.equal(lista.body.linhas.length, 1);
  const porProtocolo = await call(
    "listar",
    { busca: sent.body.protocolo },
    "master",
  );
  assert.equal(porProtocolo.code, 200);
  assert.equal(porProtocolo.body.linhas.length, 1);
  const catalogo = await call("catalogo", {}, "master");
  assert.equal(catalogo.code, 200, JSON.stringify(catalogo.body));
  assert.equal(catalogo.body.totais.recebidas, 1);
  // O banco nega acesso direto até ao Master: só a API validada expõe dados.
  for (const ctx of [
    env.unauthenticatedContext(),
    env.authenticatedContext("master"),
    env.authenticatedContext("alimentador"),
  ]) {
    await assertFails(
      getDoc(
        doc(ctx.firestore(), `editaisInscricoes/${editalId}/inscricoes/${id}`),
      ),
    );
    await assertFails(
      setDoc(
        doc(ctx.firestore(), `editaisInscricoes/${editalId}/inscricoes/${id}`),
        { status: "confirmada" },
      ),
    );
  }
  await db.doc("editaisConfiguracao/" + editalId).update({ ativo: false });
  assert.equal((await call("iniciar", { id: randomUUID() })).code, 409);
  assert.equal((await call("consultar")).code, 200);
});
test("falha B2 não confirma anexo nem inscrição; origem e publicação protegem acesso", async () => {
  await db.doc("editaisConfiguracao/" + editalId).update({ ativo: true });
  const other = randomUUID();
  assert.equal((await call("iniciar", { id: other })).code, 200);
  fail = true;
  const r = await call("upload", {
    id: other,
    arquivoId: randomUUID(),
    tipo: "relato",
    base64: pdfBytes.toString("base64"),
    mime: "application/pdf",
  });
  assert.equal(r.code, 500);
  fail = false;
  const snap = await db
    .doc(`editaisInscricoes/${editalId}/inscricoes/${other}`)
    .get();
  assert.equal(snap.data().enviada, false);
  assert.equal(Object.values(snap.data().arquivos)[0].estado, "enviando");
  await db.doc("publicacoes/" + editalId).delete();
  assert.equal((await call("iniciar", { id: randomUUID() })).code, 404);
});
