// Cardápios agora são gravados pela API, que verifica conflitos e versões.
// A leitura dos formatos anteriores permanece pública; clientes não podem
// contornar a transação do servidor, mesmo apresentando auditoria válida.
const { test, before, after, beforeEach } = require("node:test");
const { readFileSync } = require("node:fs");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc, serverTimestamp } = require("firebase/firestore");
const { loteAuditado } = require("./seguranca/apoio.cjs");
let env;
const legado = {
  tipo: "cardapio",
  titulo: "Cardápio anterior",
  resumo: "",
  texto: "Texto oficial",
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
};
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
      ["master", "master"],
      ["nutri", "nutricionista"],
      ["diretor", "diretor"],
      ["alimentador", "alimentador"],
      ["professor", "professor"],
    ])
      await setDoc(doc(c.firestore(), "usuarios", uid), {
        nome: uid,
        email: uid + "@example.test",
        papel,
        ativo: true,
        escolasVinculadas: ["e1"],
      });
    await setDoc(doc(c.firestore(), "conteudos", "legado"), {
      ...legado,
      versao: 1,
      publicado: true,
    });
    await setDoc(doc(c.firestore(), "publicacoes", "legado"), legado);
    await setDoc(doc(c.firestore(), "cardapiosArquivos", "pdf"), {
      key: "privado",
      version: "privada",
    });
  });
});
test("visitante lê cardápio antigo por escolaId, mas não o rascunho nem chave do B2", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "publicacoes", "legado")));
  await assertFails(getDoc(doc(db, "conteudos", "legado")));
  await assertFails(getDoc(doc(db, "cardapiosArquivos", "pdf")));
});
for (const uid of ["master", "nutri", "diretor", "alimentador", "professor"])
  test(
    uid + " não contorna API com escrita direta auditada de cardápios",
    async () => {
      const db = env
        .authenticatedContext(uid, {
          auth_time: Math.floor(Date.now() / 1000),
          email: uid + "@example.test",
        })
        .firestore();
      await assertFails(
        loteAuditado(env, db, uid, [
          {
            path: "conteudos/novo",
            data: {
              ...legado,
              publicado: true,
              versao: 1,
              atualizadoPor: uid,
              atualizadoEm: serverTimestamp(),
            },
          },
          {
            path: "publicacoes/novo",
            data: { ...legado, publicadoEm: serverTimestamp() },
          },
        ]),
      );
    },
  );
test("anônimo não grava nem registra arquivo como confirmado", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "publicacoes", "fraude"), legado));
  await assertFails(
    setDoc(doc(db, "cardapiosArquivos", "fraude"), { estado: "pronto" }),
  );
});
