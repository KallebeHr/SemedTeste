const { test, before, after } = require("node:test");
const { readFileSync } = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc, serverTimestamp } = require("firebase/firestore");
const { loteAuditado } = require("../seguranca/apoio.cjs");
let env;
const form = {
  tipo: "servico",
  titulo: "Matrícula online",
  resumo: "Acesse a matrícula.",
  texto: "",
  categoria: "vida-escolar",
  slug: "vida-escolar-teste",
  url: "https://example.com/matricula",
  imagemUrl: "https://example.com/imagem.jpg",
  imagemAlt: "Matrícula online",
  dataInicio: "",
  dataFim: "",
  local: "",
  numero: "",
  destaque: false,
  ordem: 0,
  escolaId: "",
};
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-vida-escolar",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const uid of ["master", "alimentador", "professor"])
      await setDoc(doc(c.firestore(), "usuarios", uid), {
        nome: uid,
        email: uid + "@example.test",
        papel: uid,
        ativo: true,
      });
  });
});
after(async () => env.cleanup());
for (const uid of ["master", "alimentador", "professor"])
  test(uid + " — permissões para publicar tópicos com auditoria", async () => {
    const db = env
      .authenticatedContext(uid, {
        auth_time: Math.floor(Date.now() / 1000),
        email: uid + "@example.test",
      })
      .firestore();
    const acao = loteAuditado(env, db, uid, [
      {
        path: "conteudos/vida-" + uid,
        data: {
          ...form,
          versao: 1,
          publicado: true,
          atualizadoPor: uid,
          atualizadoEm: serverTimestamp(),
        },
      },
      {
        path: "publicacoes/vida-" + uid,
        data: { ...form, publicadoEm: serverTimestamp() },
      },
    ]);
    if (uid === "professor") await assertFails(acao);
    else await assertSucceeds(acao);
  });
test("visitante consulta tópico publicado, não altera e não lê rascunho", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "publicacoes", "vida-master")));
  await assertFails(getDoc(doc(db, "conteudos", "vida-master")));
  await assertFails(setDoc(doc(db, "publicacoes", "fraude"), form));
});
