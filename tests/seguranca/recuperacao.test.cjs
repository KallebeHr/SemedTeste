const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { deleteApp } = require("firebase-admin/app");
const { Timestamp, GeoPoint } = require("firebase-admin/firestore");
const {
  ambiente,
  gerar,
  restaurar,
  todosDocumentos,
} = require("../../scripts/recuperacao.cjs");
const { abrir, criptografar } = require("../../scripts/arquivo-backup.cjs");
let origem, destino, arquivo, dados;
const senha = "Senha-local-de-recuperacao-2026!";
test('agendador grava cópia criptografada verificável e registra o resultado',async()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {executarBackup}=require('../../scripts/backup-agendado.cjs');
  const pasta=fs.mkdtempSync(path.join(os.tmpdir(),'seduc-agenda-'));
  const r=await executarBackup(origem,{id:'teste-agenda',firebase:{projectId:'demo-seduc'}},{destino:pasta,senha});
  const copia=abrir(fs.readFileSync(r.arquivo),senha);
  assert(copia.documentos.some(d=>d.path==='alunos/a/notas/matematica'));
  assert.equal((await origem.db.doc('operacao/backupAgendado').get()).data().estado,'concluido');
  fs.unlinkSync(r.arquivo);fs.rmdirSync(pasta);
});
before(async () => {
  assert.match(
    process.env.FIRESTORE_EMULATOR_HOST || "",
    /^(127\.0\.0\.1|localhost):8080$/,
  );
  origem = ambiente("demo-seduc");
  destino = ambiente("demo-recuperado");
  for (const p of ["demo-seduc", "demo-recuperado"]) {
    await fetch(
      `http://127.0.0.1:8080/emulator/v1/projects/${p}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${p}/accounts`, {
      method: "DELETE",
    });
  }
  await origem.auth.createUser({
    uid: "master",
    email: "master@example.test",
    password: "Senha-de-teste-2026!",
    emailVerified: true,
    displayName: "Master Teste",
  });
  await origem.auth.setCustomUserClaims("master", { teste: true });
  const b = origem.db.batch();
  const itens = {
    "usuarios/master": {
      nome: "Master Teste",
      email: "master@example.test",
      papel: "master",
      ativo: true,
      escolasVinculadas: [],
    },
    "alunos/a": { nome: "Aluno fictício", responsavelUid: "master" },
    "alunos/a/notas/matematica": { nota: 8, frequencia: 95 },
    "conteudos/cardapio": { tipo: "cardapio", texto: "Cardápio completo" },
    "publicacoes/cardapio": { tipo: "cardapio", texto: "Cardápio publicado" },
    "solicitacoes/p1": { donoUid: "master", mensagem: "Teste" },
    "escolas/a": { nome: "Escola A", ativo: true },
    "escolas/a/estoque/arroz": { quantidadeAtual: 4 },
    "escolas/a/assinaturas/s1": { cpf: "52998224725" },
    "escolasPublicas/a": { nome: "Escola A" },
    "escolasPublicas/a/vistorias/v1": { nota: 10 },
    "auditoriaRegistros/teste": {
      alvo: origem.db.doc("alunos/a"),
      timestamp: new Timestamp(1700000000, 123456789),
    },
    "qualquerColecao/paiAusente/filhos/f1": {
      ponto: new GeoPoint(-4.4, -41.4),
      bytes: Buffer.from([0, 1, 255]),
      lista: [null, true, "teste", 3.14],
      infinito: Infinity,
    },
  };
  for (const [p, d] of Object.entries(itens)) b.set(origem.db.doc(p), d);
  await b.commit();
  const r = await gerar(origem, {
    cliente: { id: "instituicao-teste", firebase: { projectId: "demo-seduc" } },
    senha,
  });
  arquivo = r.arquivo;
  dados = abrir(arquivo, senha);
});
after(async () => {
  if (origem) await deleteApp(origem.app);
  if (destino) await deleteApp(destino.app);
});
test("backup inclui todas as coleções, subcoleções órfãs e contas, sem CPF visível no arquivo", () => {
  assert.equal(dados.documentos.length, 13);
  assert.equal(dados.contas.length, 1);
  assert.ok(
    dados.documentos.some((r) => r.path === "alunos/a/notas/matematica"),
  );
  assert.ok(dados.documentos.some((r) => r.path === "conteudos/cardapio"));
  assert.ok(
    dados.documentos.some(
      (r) => r.path === "qualquerColecao/paiAusente/filhos/f1",
    ),
  );
  assert.equal(arquivo.includes(Buffer.from("52998224725")), false);
});
test("senha incorreta e arquivo alterado não são aceitos", () => {
  assert.throws(() => abrir(arquivo, "senha-incorreta"), /Senha incorreta/);
  const d = JSON.parse(arquivo);
  d.dados = (d.dados[0] === "A" ? "B" : "A") + d.dados.slice(1);
  assert.throws(
    () => abrir(Buffer.from(JSON.stringify(d)), senha),
    /Senha incorreta/,
  );
  assert.throws(() => criptografar({}, "curta"), /16 caracteres/);
});
test("plano de restauração não grava dados", async () => {
  const r = await restaurar(destino, dados);
  assert.equal(r.aplicar, false);
  assert.equal((await todosDocumentos(destino.db)).length, 0);
  assert.equal((await destino.auth.listUsers()).users.length, 0);
});
test("restauração recupera documentos, tipos Firebase, contas e vínculos", async () => {
  const r = await restaurar(destino, dados, { aplicar: true });
  assert.equal(r.verificada, true);
  assert.deepEqual(await todosDocumentos(destino.db), dados.documentos);
  const user = await destino.auth.getUser("master");
  assert.equal(user.email, "master@example.test");
  assert.deepEqual(user.customClaims, { teste: true });
  const d = (
    await destino.db.doc("qualquerColecao/paiAusente/filhos/f1").get()
  ).data();
  assert.ok(d.ponto instanceof GeoPoint);
  assert.deepEqual(d.bytes, Buffer.from([0, 1, 255]));
  const audit = (await destino.db.doc("auditoriaRegistros/teste").get()).data();
  assert.ok(audit.timestamp instanceof Timestamp);
  assert.equal(audit.alvo.firestore.projectId, "demo-recuperado");
  assert.equal(
    (await destino.db.doc("operacao/estado").get()).data().bloqueado,
    true,
  );
});
test("destino existente não é sobrescrito e instituições permanecem separadas", async () => {
  await assert.rejects(
    restaurar(destino, dados, { aplicar: true }),
    /destino deve estar vazio/,
  );
  await origem.db
    .doc("escolas/a")
    .update({ nome: "Alterada apenas na origem" });
  assert.equal(
    (await destino.db.doc("escolas/a").get()).data().nome,
    "Escola A",
  );
});
test("arquivo com manifesto inconsistente é rejeitado antes de restaurar", async () => {
  const alterado = structuredClone(dados);
  alterado.documentos.pop();
  await assert.rejects(restaurar(destino, alterado), /integridade/);
});

test("restauração interrompida retoma sem duplicar nem substituir dados divergentes", async () => {
  await destino.db.doc("alunos/a").delete();
  await destino.db.doc("publicacoes/cardapio").delete();
  await restaurar(destino, dados, { aplicar: true, retomar: true });
  assert.deepEqual(await todosDocumentos(destino.db), dados.documentos);
  await destino.db.doc("alunos/a").update({ nome: "Alteração inesperada" });
  await assert.rejects(
    restaurar(destino, dados, { aplicar: true, retomar: true }),
    /Conflito no destino/,
  );
  assert.equal(
    (await destino.db.doc("alunos/a").get()).data().nome,
    "Alteração inesperada",
  );
});
test("restauração preserva login por senha no Authentication", async () => {
  await fetch(
    "http://127.0.0.1:8080/emulator/v1/projects/demo-seduc/databases/(default)/documents",
    { method: "DELETE" },
  );
  await fetch(
    "http://127.0.0.1:9099/emulator/v1/projects/demo-seduc/accounts",
    { method: "DELETE" },
  );
  await restaurar(origem, dados, { aplicar: true });
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-seduc",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "master@example.test",
        password: "Senha-de-teste-2026!",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).localId, "master");
});
