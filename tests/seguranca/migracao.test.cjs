const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { deleteApp } = require("firebase-admin/app");
const { ambiente, gerar } = require("../../scripts/recuperacao.cjs");
const { abrir } = require("../../scripts/arquivo-backup.cjs");
const { chave, planejar, aplicar } = require("../../scripts/migrar-notas.cjs");
let ctx, backup;
const senha = "SomenteTesteDeMigracao-2026";
before(async () => {
  ctx = ambiente("demo-migracao");
  await fetch(
    "http://127.0.0.1:8080/emulator/v1/projects/demo-migracao/databases/(default)/documents",
    { method: "DELETE" },
  );
  const d = {
    componente: "Matemática",
    ano: 2026,
    bimestre: 1,
    professorUid: "professor",
    versao: 1,
    nota: 7,
    frequencia: 90,
  };
  for (const [p, n] of [
    ["alunos/a/notas/antiga", d],
    ["alunos/b/notas/duplicada1", d],
    [
      "alunos/b/notas/duplicada2",
      { ...d, componente: " MATEMATICA ", nota: 9 },
    ],
  ])
    await ctx.db.doc(p).set(n);
  backup = abrir(
    (
      await gerar(ctx, {
        cliente: { id: "teste", firebase: { projectId: "demo-migracao" } },
        senha,
      })
    ).arquivo,
    senha,
  );
});
after(async () => {
  await deleteApp(ctx.app);
});
test("planejamento identifica duplicadas com acentos e não altera notas", async () => {
  const p = await planejar(ctx.db);
  assert.equal(p.alteracoes.length, 2);
  assert.equal(
    p.alteracoes.find((g) => g.registros.length === 2).escolhido,
    null,
  );
  assert.equal((await ctx.db.collectionGroup("notas").get()).size, 3);
  await assert.rejects(aplicar(ctx, p, backup, "Operador Teste"), /decisões/);
});
test("aplicação exige backup atual, preserva descartadas e registra histórico", async () => {
  const id = chave({
    componente: "Matemática",
    ano: 2026,
    bimestre: 1,
    professorUid: "professor",
    versao: 1,
  });
  const p = await planejar(ctx.db, {
    ["alunos/b/notas/" + id]: "alunos/b/notas/duplicada2",
  });
  await aplicar(ctx, p, backup, "Operador Teste");
  assert.equal((await ctx.db.collectionGroup("notas").get()).size, 2);
  assert.equal((await ctx.db.doc("alunos/b/notas/" + id).get()).data().nota, 9);
  assert.equal((await ctx.db.collection("migracoesNotas").get()).size, 2);
  assert.equal((await ctx.db.collection("auditoriaRegistros").get()).size, 5);
  assert.equal((await planejar(ctx.db)).alteracoes.length, 0);
});
