const { test, before, after, beforeEach } = require("node:test");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const { readFileSync } = require("node:fs");
const { doc, setDoc, getDoc, serverTimestamp } = require("firebase/firestore");
const { loteAuditado } = require("./seguranca/apoio.cjs");
let env;
const grade = () => ({
  versao: 1,
  mes: "2026-09",
  etapa: "ENS.INFANTIL",
  turno: "PARCIAL",
  observacoes: "Observação.",
  dias: Array.from({ length: 31 }, () => ({
    situacao: "letivo",
    primeiro: "FRUTA",
    segundo: "ARROZ\nFEIJÃO",
    evento: "",
    observacao: "",
  })),
});
const corpo = () => ({
  tipo: "cardapio",
  titulo: "Setembro 2026",
  resumo: "",
  texto: "Cardápio.",
  categoria: "",
  slug: "",
  url: "",
  imagemUrl: "",
  imagemAlt: "",
  dataInicio: "",
  dataFim: "",
  local: "",
  numero: "2026-09",
  destaque: false,
  ordem: 0,
  escolaId: "e1",
  gradeCardapio: grade(),
});
function codificar(p) {
  if (p.gradeCardapio)
    p.gradeCardapio.dias = p.gradeCardapio.dias.map((d) =>
      Object.keys(d).length === 5
        ? [d.situacao, d.primeiro, d.segundo, d.evento, d.observacao].join(
            "\u001f",
          )
        : d,
    );
  return p;
}
async function publicar(uid = "nutri", mudar = (x) => x) {
  const db = env
      .authenticatedContext(uid, {
        auth_time: Math.floor(Date.now() / 1000),
        email: uid + "@example.test",
      })
      .firestore(),
    p = codificar(mudar(corpo()));
  return loteAuditado(env, db, uid, [
    {
      path: "conteudos/c1",
      data: {
        ...p,
        publicado: true,
        versao: 1,
        atualizadoPor: uid,
        atualizadoEm: serverTimestamp(),
      },
    },
    { path: "publicacoes/c1", data: { ...p, publicadoEm: serverTimestamp() } },
  ]);
}
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cardapio",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const [uid, papel] of [
      ["nutri", "nutricionista"],
      ["master", "master"],
      ["alimentador", "alimentador"],
      ["diretor", "diretor"],
      ["professor", "professor"],
    ])
      await setDoc(doc(c.firestore(), "usuarios", uid), {
        nome: uid,
        email: uid + "@example.test",
        papel,
        ativo: true,
        escolasVinculadas: ["e1"],
      });
    await setDoc(doc(c.firestore(), "escolasPublicas", "e1"), {
      nome: "Escola teste",
    });
  });
});
test("nutricionista publica grade de 31 dias com auditoria e visitante lê", async () => {
  await assertSucceeds(publicar());
  await assertSucceeds(
    getDoc(doc(env.unauthenticatedContext().firestore(), "publicacoes", "c1")),
  );
});
test("master publica", async () => assertSucceeds(publicar("master")));
test("texto antigo permanece válido", async () =>
  assertSucceeds(
    publicar("nutri", (p) => {
      delete p.gradeCardapio;
      return p;
    }),
  ));
for (const uid of ["alimentador", "diretor", "professor"])
  test(uid + " não publica cardápio", async () => assertFails(publicar(uid)));
for (const [nome, mudar] of [
  ["mês divergente", (g) => (g.mes = "2026-10")],
  ["mês inválido", (g) => (g.mes = "2026-13")],
  ["dia ausente", (g) => g.dias.pop()],
  ["campo extra", (g) => (g.cpf = "123")],
  ["campo extra no dia 31", (g) => (g.dias[30].cpf = "123")],
  ["texto grande no dia 31", (g) => (g.dias[30].segundo = "x".repeat(501))],
  ["delimitador em texto", (g) => (g.dias[30].primeiro = "x\u001fextra")],
  ["feriado com refeição", (g) => (g.dias[0].situacao = "feriado")],
])
  test("rejeita " + nome, async () =>
    assertFails(
      publicar("nutri", (p) => {
        mudar(p.gradeCardapio);
        return p;
      }),
    ),
  );
test("bloqueia gravação direta sem auditoria", async () => {
  const db = env
    .authenticatedContext("nutri", {
      auth_time: Math.floor(Date.now() / 1000),
      email: "nutri@example.test",
    })
    .firestore();
  await assertFails(
    setDoc(doc(db, "conteudos", "c1"), {
      ...codificar(corpo()),
      publicado: false,
      versao: 1,
      atualizadoPor: "nutri",
      atualizadoEm: serverTimestamp(),
    }),
  );
});
test("bloqueia grade pública diferente do rascunho", async () => {
  const db = env
      .authenticatedContext("nutri", {
        auth_time: Math.floor(Date.now() / 1000),
        email: "nutri@example.test",
      })
      .firestore(),
    p = corpo(),
    p2 = corpo();
  p2.gradeCardapio.dias[0].segundo = "OUTRO ALIMENTO";
  codificar(p);
  codificar(p2);
  await assertFails(
    loteAuditado(env, db, "nutri", [
      {
        path: "conteudos/c1",
        data: {
          ...p,
          publicado: true,
          versao: 1,
          atualizadoPor: "nutri",
          atualizadoEm: serverTimestamp(),
        },
      },
      {
        path: "publicacoes/c1",
        data: { ...p2, publicadoEm: serverTimestamp() },
      },
    ]),
  );
});

test("rascunho posterior não altera a grade pública", async () => {
  await assertSucceeds(publicar());
  const db = env
    .authenticatedContext("nutri", {
      auth_time: Math.floor(Date.now() / 1000),
      email: "nutri@example.test",
    })
    .firestore();
  const p = corpo();
  p.gradeCardapio.dias[0].segundo = "ALTERAÇÃO EM RASCUNHO";
  codificar(p);
  await assertSucceeds(
    loteAuditado(env, db, "nutri", [
      {
        path: "conteudos/c1",
        data: {
          ...p,
          publicado: true,
          versao: 2,
          atualizadoPor: "nutri",
          atualizadoEm: serverTimestamp(),
        },
      },
    ]),
  );
  const s = await getDoc(
    doc(env.unauthenticatedContext().firestore(), "publicacoes", "c1"),
  );
  require("node:assert/strict").ok(
    !s.data().gradeCardapio.dias[0].includes("ALTERAÇÃO"),
  );
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), "conteudos", "c1")),
  );
});
test("aceita os limites máximos de texto em todos os dias", async () =>
  assertSucceeds(
    publicar("nutri", (p) => {
      p.gradeCardapio.dias.forEach((d) => {
        d.primeiro = "P".repeat(300);
        d.segundo = "S".repeat(500);
        d.evento = "E".repeat(80);
        d.observacao = "O".repeat(200);
      });
      return p;
    }),
  ));
