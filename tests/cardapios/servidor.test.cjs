const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { getDoc, doc, setDoc } = require("firebase/firestore");
const { criarHandlerCardapios } = require("../../server/cardapios/handler.cjs");
let app, db, env, handler, arquivoId;
const objetos = new Map();
let uploads = 0;
const origin = "https://www.semedpii.com.br";
async function chamar(body, uid = "master", query = null) {
  const req = {
    method: query ? "GET" : "POST",
    query: query || {},
    headers: {
      origin,
      "content-type": "application/json",
      authorization: "Bearer " + uid,
    },
    body,
  };
  let status = 200,
    headers = {};
  let resultado;
  await handler(req, {
    setHeader: (k, v) => (headers[k] = v),
    status: (n) => {
      status = n;
      return {
        json: (d) => {
          resultado = d;
        },
        send: (d) => {
          resultado = d;
        },
      };
    },
  });
  return { status, body: resultado, headers };
}
const form = (escolaIds = ["e1", "e2"], numero = "2026-10") => ({
  tipo: "cardapio",
  titulo: "Educação Infantil - Outubro 2026",
  numero,
  etapa: "Educação Infantil",
  turno: "Parcial",
  programa: "PNAE",
  escolaIds,
  arquivoId,
});
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw Error("Use apenas o emulador.");
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-cardapios-pdf",
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  app = initializeApp({ projectId: "demo-cardapios-pdf" }, "cardapios-pdf");
  db = getFirestore(app);
  for (const [uid, papel] of [
    ["master", "master"],
    ["nutri", "nutricionista"],
    ["diretor", "diretor"],
  ])
    await db.doc("usuarios/" + uid).set({ nome: uid, papel, ativo: true });
  for (const [id, nome] of [
    ["e1", "E. M. Vovó Inácia"],
    ["e2", "E. de E. Infantil Maria de Lurdes Viana dos Santos"],
    ["e3", "Escola sem vínculo"],
  ]) {
    await db.doc("escolas/" + id).set({ nome });
    await db.doc("escolasPublicas/" + id).set({ nome });
  }
  handler = criarHandlerCardapios({
    db,
    auth: {
      verifyIdToken: async (token) => {
        if (!["master", "nutri", "diretor"].includes(token)) throw Error();
        return { uid: token, auth_time: Math.floor(Date.now() / 1000) };
      },
    },
    b2: {
      put: async (k, v) => {
        objetos.set(k, Buffer.from(v));
        uploads++;
        return "version-original";
      },
      get: async (k) => objetos.get(k),
    },
    origens: [origin],
    clienteId: "pedro-ii",
  });
});
after(async () => {
  await env?.cleanup();
  if (app) await deleteApp(app);
});
test("PDF real, escolas só com nome, publicação compartilhada e download original", async () => {
  const pdf = readFileSync(
    "../upload/CARDÁPIO-ED.INFANTIL-CRECHE VOVÓ INÁCIA,MARIA DE LOURDES VIANA-OUTUBRO-1(1).pdf",
  );
  const r = await chamar(
    {
      acao: "upload",
      nome: "cardapio-outubro.pdf",
      mime: "application/pdf",
      base64: pdf.toString("base64"),
    },
    "nutri",
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  arquivoId = r.body.arquivoId;
  const save = await chamar({
    acao: "salvar",
    id: "menu-compartilhado",
    form: form(),
    publicar: true,
  });
  assert.equal(save.status, 200, JSON.stringify(save.body));
  const p = (await db.doc("publicacoes/menu-compartilhado").get()).data();
  assert.deepEqual(p.escolaIds, ["e1", "e2"]);
  assert.equal(p.texto, "");
  assert.equal(p.gradeCardapio, undefined);
  const { filtrarCardapios } = await import("../../shared/cardapios.mjs");
  for (const escola of ["e1", "e2"]) {
    assert.equal(
      filtrarCardapios([{ id: "menu-compartilhado", ...p }], escola, "2026-10")
        .length,
      1,
    );
    const down = await chamar(null, "", {
      acao: "pdf",
      id: "menu-compartilhado",
      arquivo: arquivoId,
      escola,
      baixar: "1",
    });
    assert.equal(down.status, 200);
    assert.equal(
      createHash("sha256").update(down.body).digest("hex"),
      createHash("sha256").update(pdf).digest("hex"),
    );
    assert.match(down.headers["Content-Disposition"], /^attachment/);
  }
  assert.equal(filtrarCardapios([p], "e3", "2026-10").length, 0);
  assert.equal(filtrarCardapios([p], "e1", "2026-11").length, 0);
  assert.equal(
    (
      await chamar(null, "", {
        acao: "pdf",
        id: "menu-compartilhado",
        arquivo: arquivoId,
        escola: "e3",
      })
    ).status,
    404,
  );
  assert.equal(uploads, 1);
});
test("conflito revisado: substitui uma escola e mantém a outra e o arquivo", async () => {
  const payload = {
    acao: "salvar",
    id: "menu-escola-1",
    form: { ...form(["e1"]), titulo: "Novo cardápio da primeira escola" },
    publicar: true,
  };
  const c = await chamar(payload);
  assert.equal(c.status, 409);
  assert.deepEqual(c.body.conflitos[0].escolaIds, ["e1"]);
  const salvo = await chamar({ ...payload, substituir: true });
  assert.equal(salvo.status, 200, JSON.stringify(salvo.body));
  const anterior = (
    await db.doc("publicacoes/menu-compartilhado").get()
  ).data();
  assert.deepEqual(anterior.escolaIds, ["e2"]);
  assert.equal(anterior.arquivoId, arquivoId);
  assert.equal(
    (
      await chamar(null, "", {
        acao: "pdf",
        id: "menu-compartilhado",
        arquivo: arquivoId,
        escola: "e1",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await chamar(null, "", {
        acao: "pdf",
        id: "menu-compartilhado",
        arquivo: arquivoId,
        escola: "e2",
      })
    ).status,
    200,
  );
  assert.equal(uploads, 1);
});
test("rascunho não muda publicação; outro mês não conflita; retirada preserva PDF e auditoria", async () => {
  let r = await chamar(
    {
      acao: "salvar",
      id: "novembro",
      form: form(["e1"], "2026-11"),
      publicar: false,
    },
    "nutri",
  );
  assert.equal(r.status, 200);
  assert.equal((await db.doc("publicacoes/novembro").get()).exists, false);
  r = await chamar(
    {
      acao: "salvar",
      id: "novembro",
      versao: 1,
      form: form(["e1"], "2026-11"),
      publicar: true,
    },
    "nutri",
  );
  assert.equal(r.status, 200);
  r = await chamar({
    acao: "salvar",
    id: "novembro",
    versao: 2,
    form: { ...form(["e1"], "2026-11"), titulo: "Em revisão" },
    publicar: false,
  });
  assert.equal(r.status, 200);
  assert.notEqual(
    (await db.doc("publicacoes/novembro").get()).data().titulo,
    "Em revisão",
  );
  assert.equal(
    (await chamar({ acao: "retirar", id: "novembro", versao: 3 })).status,
    200,
  );
  assert.equal((await db.doc("publicacoes/novembro").get()).exists, false);
  assert.equal(
    (await db.doc("cardapiosArquivos/" + arquivoId).get()).exists,
    true,
  );
  assert.equal(
    (await chamar({ acao: "historico", id: "novembro" })).body.linhas.length,
    4,
  );
});
test("concorrência não permite duas publicações para a mesma faixa", async () => {
  const resultados = await Promise.all(
    ["concorrente-a", "concorrente-b"].map((id) =>
      chamar({
        acao: "salvar",
        id,
        form: form(["e3"], "2026-12"),
        publicar: true,
      }),
    ),
  );
  assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 409]);
});
test("permissões, escola inativa/não publicada, arquivo inválido e versões antigas", async () => {
  assert.equal(
    (
      await chamar(
        { acao: "salvar", id: "intruso", form: form(), publicar: true },
        "diretor",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await chamar(
        { acao: "salvar", id: "anonimo", form: form(), publicar: true },
        "",
      )
    ).status,
    401,
  );
  await db.doc("escolas/e3").update({ ativo: false });
  assert.equal(
    (
      await chamar({
        acao: "salvar",
        id: "inativa",
        form: form(["e3"]),
        publicar: true,
      })
    ).status,
    400,
  );
  await db.doc("escolas/e3").update({ ativo: true });
  await db.doc("escolasPublicas/e3").delete();
  assert.equal(
    (
      await chamar({
        acao: "salvar",
        id: "privada",
        form: form(["e3"]),
        publicar: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await chamar({
        acao: "upload",
        nome: "falso.pdf",
        mime: "application/pdf",
        base64: Buffer.from("invalido").toString("base64"),
      })
    ).status,
    400,
  );
  const legado = {
    tipo: "cardapio",
    titulo: "Cardápio anterior",
    numero: "2026-09",
    escolaId: "e1",
    texto: "Texto oficial anterior",
    categoria: "Educação Infantil",
    versao: 4,
    publicado: true,
  };
  await db.doc("conteudos/legado").set(legado);
  await db.doc("publicacoes/legado").set(legado);
  const { filtrarCardapios } = await import("../../shared/cardapios.mjs");
  assert.equal(filtrarCardapios([legado], "e1", "2026-09").length, 1);
  assert.equal(
    (
      await chamar({
        acao: "salvar",
        id: "legado",
        versao: 4,
        form: { ...legado, etapa: "Educação Infantil", turno: "Parcial" },
        publicar: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await chamar({
        acao: "salvar",
        id: "legado",
        versao: 4,
        form: form(["e1"]),
        publicar: true,
      })
    ).status,
    409,
  );
  const publico = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publico, "publicacoes", "legado")));
  await assertFails(getDoc(doc(publico, "cardapiosArquivos", arquivoId)));
  await assertFails(getDoc(doc(publico, "conteudos", "legado")));
  const equipe = env
    .authenticatedContext("nutri", { auth_time: Math.floor(Date.now() / 1000) })
    .firestore();
  await assertFails(
    setDoc(doc(equipe, "publicacoes", "fraude"), {
      ...form(),
      tipo: "cardapio",
    }),
  );
});

test("editor mensal estruturado continua disponível, com revisão dos lanches antes de publicar", async () => {
  const { novoCardapio } = await import("../../src/portal/cardapioMensal.js");
  const grade = novoCardapio("2027-02");
  grade.etapa = "Educação Infantil";
  grade.turno = "Integral";
  const dados = {
    ...form(["e1"], "2027-02"),
    turno: "Integral",
    gradeCardapio: grade,
  };
  delete dados.arquivoId;
  let r = await chamar({
    acao: "salvar",
    id: "grade-digital",
    form: dados,
    publicar: false,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await chamar({
    acao: "salvar",
    id: "grade-digital",
    versao: 1,
    form: dados,
    publicar: true,
  });
  assert.equal(r.status, 400);
  for (const dia of grade.dias) {
    dia.situacao = "sem_aula";
    dia.primeiro = "";
    dia.segundo = "";
  }
  r = await chamar({
    acao: "salvar",
    id: "grade-digital",
    versao: 1,
    form: dados,
    publicar: true,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const publico = (await db.doc("publicacoes/grade-digital").get()).data();
  assert.equal(publico.gradeCardapio.dias.length, 31);
  assert.equal(publico.arquivoId, undefined);
  assert.match(publico.texto, /2027/);
});
