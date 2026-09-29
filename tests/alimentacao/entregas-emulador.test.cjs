const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc } = require("firebase/firestore");
const { executarEntrega } = require("../../server/alimentacao/entregas.cjs");
const ativo = !!process.env.FIRESTORE_EMULATOR_HOST;
let app, db, env;
const perfil = { papel: "gerente", nome: "Gestor Teste", ativo: true };
const token = { uid: "gestor", auth_time: Math.floor(Date.now() / 1000) };
before(async () => {
  if (!ativo) return;
  const [host, porta] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-seduc-entregas",
    firestore: {
      host,
      port: Number(porta),
      rules: fs.readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  app = initializeApp({ projectId: "demo-seduc-entregas" }, "teste-entregas");
  db = getFirestore(app);
  await Promise.all([
    db.doc("usuarios/gestor").set(perfil),
    db.doc("usuarios/diretor").set({
      papel: "diretor",
      nome: "Diretor Teste",
      ativo: true,
      escolasVinculadas: ["escola-a"],
    }),
    db.doc("usuarios/intruso").set({
      papel: "diretor",
      nome: "Outra Escola",
      ativo: true,
      escolasVinculadas: ["escola-b"],
    }),
    db
      .doc("escolas/deposito-municipal")
      .set({ ativo: true, nome: "Depósito", tipoUnidade: "deposito" }),
    db.doc("escolas/escola-a").set({ ativo: true, nome: "Escola A" }),
    db.doc("escolas/escola-b").set({ ativo: true, nome: "Escola B" }),
  ]);
});
after(async () => {
  await env?.cleanup();
  if (app) await deleteApp(app);
});
function pedido(item, quantidade = 80) {
  return {
    acao: "enviarEntrega",
    id: randomUUID(),
    escolaId: "escola-a",
    itens: [{ itemId: item, quantidade }],
    fotos: [],
    responsavel: { nome: "Responsavel Teste", cpf: "52998224725" },
  };
}
const run = (b, t = token) => executarEntrega({ db, token: t, perfil, b });
test(
  "Firestore real: concorrência, idempotência, divergência, regras e auditoria",
  { skip: !ativo },
  async () => {
    const item = "arroz-" + randomUUID();
    await db
      .doc(`escolas/deposito-municipal/estoque/${item}`)
      .set({ nome: "Arroz", unidade: "kg", quantidadeAtual: 100, ativo: true });
    const a = pedido(item),
      b = pedido(item);
    const result = await Promise.allSettled([run(a), run(b)]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    const enviado = result[0].status === "fulfilled" ? a : b;
    assert.equal(
      (await db.doc(`escolas/deposito-municipal/estoque/${item}`).get()).data()
        .quantidadeAtual,
      20,
    );
    await run(enviado);
    const receber = {
      ...enviado,
      acao: "receberEntrega",
      itens: [
        {
          itemId: item,
          quantidadeRecebida: 78,
          motivo: "quantidade diferente",
        },
      ],
    };
    const diretor = { ...token, uid: "diretor" };
    await Promise.all([run(receber, diretor), run(receber, diretor)]);
    assert.equal(
      (await db.doc(`escolas/escola-a/estoque/transf-${item}`).get()).data()
        .quantidadeAtual,
      78,
    );
    const path = `escolas/escola-a/entregas/${enviado.id}`,
      registro = await db.doc(path).get();
    assert.equal(registro.data().divergencia.status, "aberta");
    assert.equal(typeof registro.data().criadoEm.toMillis(), "number");
    assert.ok((await db.collection("auditoriaRegistros").get()).size >= 6);
    const cliente = env
      .authenticatedContext("diretor", { auth_time: token.auth_time })
      .firestore();
    const intruso = env
      .authenticatedContext("intruso", { auth_time: token.auth_time })
      .firestore();
    await assertSucceeds(getDoc(doc(cliente, path)));
    await assertFails(
      setDoc(doc(cliente, path), { status: "enviado" }, { merge: true }),
    );
    await assertFails(getDoc(doc(intruso, path)));
    await assertFails(
      getDoc(
        doc(
          cliente,
          `escolas/escola-a/entregaIdentificacoes/${enviado.id}-enviar`,
        ),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(
          cliente,
          `escolas/escola-a/entregaIdentificacoes/${enviado.id}-receber`,
        ),
      ),
    );
    const listar = await run({
      acao: "listarEntregas",
      escolaId: "deposito-municipal",
      status: "recebido",
      busca: "arroz",
    });
    assert.ok(listar.registros.some((d) => d.id === enviado.id));
  },
);
test(
  "Firestore real: cancelamentos simultâneos estornam exatamente uma vez",
  { skip: !ativo },
  async () => {
    const item = "feijao-" + randomUUID();
    await db
      .doc(`escolas/deposito-municipal/estoque/${item}`)
      .set({ nome: "Feijão", unidade: "kg", quantidadeAtual: 50, ativo: true });
    const b = pedido(item, 20);
    await run(b);
    const cancelar = {
      ...b,
      acao: "cancelarEntrega",
      motivo: "Retorno ao depósito",
    };
    await Promise.all([run(cancelar), run(cancelar)]);
    assert.equal(
      (await db.doc(`escolas/deposito-municipal/estoque/${item}`).get()).data()
        .quantidadeAtual,
      50,
    );
  },
);

test(
  "Firestore real: recebimento e cancelamento concorrentes não efetivam juntos",
  { skip: !ativo },
  async () => {
    const item = "milho-" + randomUUID();
    await db
      .doc(`escolas/deposito-municipal/estoque/${item}`)
      .set({ nome: "Milho", unidade: "kg", quantidadeAtual: 50, ativo: true });
    const b = pedido(item, 20);
    await run(b);
    const receber = {
      ...b,
      acao: "receberEntrega",
      itens: [{ itemId: item, quantidadeRecebida: 20 }],
    };
    const cancelar = {
      ...b,
      acao: "cancelarEntrega",
      motivo: "Entrega interrompida",
    };
    const r = await Promise.allSettled([
      run(receber, { ...token, uid: "diretor" }),
      run(cancelar),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    const entrega = (
      await db.doc(`escolas/escola-a/entregas/${b.id}`).get()
    ).data();
    const deposito = (
      await db.doc(`escolas/deposito-municipal/estoque/${item}`).get()
    ).data().quantidadeAtual;
    const escola =
      (await db.doc(`escolas/escola-a/estoque/transf-${item}`).get()).data()
        ?.quantidadeAtual || 0;
    assert.equal(deposito + escola, 50);
    assert.ok(["recebido", "cancelado"].includes(entrega.status));
    const resumo = await run({
      acao: "resumoEntregas",
      escolaId: "deposito-municipal",
    });
    assert.ok(resumo.hoje >= 3);
    assert.equal(resumo.pendentes, 0);
  },
);
