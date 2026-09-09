const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  getDoc,
  Timestamp,
  serverTimestamp,
} = require("firebase/firestore");
const { loteAuditado, chaveNota } = require("./apoio.cjs");
let env;
test('alertas exigem operação real do autor e identificador único por origem',async()=>{
  const data={tipo:'estoque_baixo',escolaId:'a',origemId:'origem-alerta',titulo:'Estoque baixo',mensagem:'Confira o saldo.',destinatarios:[],lida:false,criadoEm:serverTimestamp()};
  const path='notificacoes/estoque_baixo-a-origem-alerta';
  await assertFails(loteAuditado(env,banco('master'),'master',[{path,data}]));
  await seed('escolas/a/estoque/origem-item',{quantidadeMinima:5});
  await seed('escolas/a/movimentacoes/origem-alerta',{responsavelId:'master',quantidadeResultante:3,itemId:'origem-item'});
  await assertFails(loteAuditado(env,banco('nutricionista'),'nutricionista',[{path,data}]));
  await assertFails(loteAuditado(env,banco('master'),'master',[{path:'notificacoes/outro-id',data}]));
  await assertSucceeds(loteAuditado(env,banco('master'),'master',[{path,data}]));
  await assertFails(loteAuditado(env,banco('master'),'master',[{path,data}]));
});
const banco = (uid) =>
  env
    .authenticatedContext(uid, {
      email: uid + "@example.test",
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
    })
    .firestore();
const seed = (p, d) =>
  env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), p), d));
test('pendência só pode ser concluída pelo destinatário ou Master e sem alterar o conteúdo', async()=>{
  const path='pendencias/teste',data={tipo:'documento',titulo:'Conferir documento',mensagem:'Controle interno',destinatarioUid:'professor',prazo:'2026-12-01',status:'pendente',versao:1,criadoPor:'master',criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()};
  await assertSucceeds(loteAuditado(env,banco('master'),'master',[{path,data}]));
  await assertFails(getDoc(doc(banco('diretor'),path)));
  await assertFails(loteAuditado(env,banco('professor'),'professor',[{path,tipo:'update',data:{status:'concluida',titulo:'Adulterado',versao:2,atualizadoEm:serverTimestamp()}}]));
  await assertSucceeds(loteAuditado(env,banco('professor'),'professor',[{path,tipo:'update',data:{status:'concluida',versao:2,atualizadoEm:serverTimestamp()}}]));
});
test('leitura individual de notificação não pode ser forjada por outro usuário',async()=>{
  const path='usuarios/professor/leituras/a-teste';
  await assertFails(loteAuditado(env,banco('diretor'),'diretor',[{path,data:{lidaEm:serverTimestamp()}}]));
  await assertSucceeds(loteAuditado(env,banco('professor'),'professor',[{path,data:{lidaEm:serverTimestamp()}}]));
});
test('parâmetros operacionais são exclusivos do Master e versionados',async()=>{
  const path='parametros/sistema',data={diasVistoria:30,diasValidade:15,categoriasTexto:'arroz\nfeijao',versao:1,atualizadoEm:serverTimestamp()};
  await assertFails(loteAuditado(env,banco('nutricionista'),'nutricionista',[{path,data}]));
  await assertSucceeds(loteAuditado(env,banco('master'),'master',[{path,data}]));
  await assertFails(loteAuditado(env,banco('master'),'master',[{path,tipo:'update',data:{...data,diasVistoria:0,versao:2}}]));
});
test('sessão com mais de oito horas não acessa estoque', async () => {
  const db = env.authenticatedContext('master', { auth_time: Math.floor(Date.now()/1000) - 9*3600 }).firestore();
  await assertFails(getDoc(doc(db, 'escolas/a')));
  await assertSucceeds(getDoc(doc(banco('master'), 'escolas/a')));
});
test('estoque rejeita campos inesperados mesmo com auditoria', async () => {
  await assertFails(loteAuditado(env, banco('master'), 'master', [{path:'escolas/a/estoque/campo-extra', data: {
    nome:'Arroz', ativo:true, quantidadeAtual:1, quantidadeMinima:0, precoUnitario:3, segredo:'campo não permitido',
  }}]));
});
test('notificação rejeita destinatário arbitrário e conteúdo excessivo', async () => {
  const base = {tipo:'estoque_baixo', escolaId:'a', titulo:'Alerta', mensagem:'Repor', destinatarios:[], lida:false, criadoEm:serverTimestamp()};
  for (const extra of [{destinatarios:['professor']}, {mensagem:'x'.repeat(1001)}, {url:'https://example.test'}]) {
    await assertFails(loteAuditado(env, banco('master'), 'master', [{path:'notificacoes/invalida',data:{...base,...extra}}]));
  }
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-seduc",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  for (const p of ["master", "professor", "diretor", "nutricionista"])
    await seed("usuarios/" + p, {
      nome: p + " Teste",
      email: p + "@example.test",
      papel: p,
      ativo: true,
      escolasVinculadas: ["a"],
    });
  await seed("escolas/a", { nome: "Escola A", ativo: true });
  await seed("alunos/a", {
    nome: "Aluno Teste",
    turma: "5 A",
    ano: 2026,
    responsavelUid: "familia",
    professoresUids: ["professor"],
    escolaId: "a",
    ativo: true,
    versao: 1,
    atualizadoEm: Timestamp.now(),
  });
});
after(async () => {
  await env.cleanup();
});
const nota = () => ({
  componente: "Matemática",
  ano: 2026,
  bimestre: 1,
  nota: 8,
  frequencia: 95,
  observacao: "",
  professorUid: "professor",
  versao: 1,
  atualizadoEm: serverTimestamp(),
});
test("R01: operação sem auditoria é rejeitada, com histórico é aceita", async () => {
  const path =
      "alunos/a/notas/" + chaveNota("matematica", 2026, 1, "professor"),
    db = banco("professor");
  await assertFails(setDoc(doc(db, path), nota()));
  await assertSucceeds(
    loteAuditado(env, db, "professor", [{ path, data: nota() }]),
  );
  assert.equal((await getDoc(doc(db, path))).data().nota, 8);
});
test("R05: evento sem operação e histórico com estado falso são rejeitados", async () => {
  const path =
      "alunos/a/notas/" + chaveNota("matematica", 2026, 1, "professor"),
    op = {
      path,
      tipo: "update",
      data: { nota: 9, versao: 2, atualizadoEm: serverTimestamp() },
    };
  await assertFails(
    loteAuditado(env, banco("professor"), "professor", [op], ({ b, ar, e }) =>
      b.set(ar, e),
    ),
  );
  await assertFails(
    loteAuditado(
      env,
      banco("professor"),
      "professor",
      [op],
      ({ b, r, ar, e, depois }) => {
        b.set(r, depois);
        b.set(ar, { ...e, dadosAntes: { nota: 0 } });
      },
    ),
  );
  await assertSucceeds(
    loteAuditado(env, banco("professor"), "professor", [op]),
  );
});
test("R02: duplicação por ID diferente é negada mesmo acompanhada de auditoria", async () => {
  await assertFails(
    loteAuditado(env, banco("professor"), "professor", [
      { path: "alunos/a/notas/outro-id", data: nota() },
    ]),
  );
});
test("normalização de componente evita duplicidade por acento Unicode decomposto", async () => {
  const path =
    "alunos/a/notas/" + chaveNota("matematica", 2026, 1, "professor");
  await assertFails(
    loteAuditado(env, banco("professor"), "professor", [
      { path, data: { ...nota(), componente: "Matema\u0301tica" } },
    ]),
  );
});
test("exclusão de publicação exige evento correspondente, inclusive registro legado", async () => {
  await seed("escolasPublicas/a", {
    nome: "Escola A",
    publicadoEm: Timestamp.now(),
  });
  await assertSucceeds(
    loteAuditado(env, banco("master"), "master", [
      { path: "escolasPublicas/a", tipo: "delete" },
    ]),
  );
});
function identificacao(id, cpf, nome, cargo) {
  return {
    metodo: "identificacao_cpf",
    versao: 2,
    nomeSignatario: nome,
    cpf,
    papelSignatario: "diretor",
    hashDocumento: "a".repeat(64),
    dataHora: Timestamp.now(),
    criadoPor: "diretor",
    documentoId: id,
    documentoTipo: "vistoria",
    cargoDocumento: cargo,
  };
}
function vistoria(
  id,
  {
    cpf = "52998224725",
    nome = "Responsável Teste",
    divergente = false,
    itens = 1,
  } = {},
) {
  const r = identificacao(id, cpf, nome, "responsavel"),
    t = identificacao(id, "11144477735", "Testemunha Teste", "testemunha");
  const resumo = (i) => ({
    nome: i.nomeSignatario,
    cpfMascarado: "***." + i.cpf.slice(3, 6) + "." + i.cpf.slice(6, 9) + "-**",
    funcao: i.papelSignatario,
    metodo: "identificacao_cpf",
  });
  const v = {
    responsavelId: "diretor",
    responsavelNome: divergente ? "Outra Pessoa" : nome,
    registradoPorNome: "diretor Teste",
    assinaturaResponsavelId: id + "-r",
    assinaturaTestemunhaId: id + "-t",
    identificacaoResponsavel: resumo(r),
    identificacaoTestemunha: resumo(t),
    metodoConfirmacao: "identificacao_cpf",
    tipo: "rotina",
    checklist: Array.from({ length: itens }, (_, n) => ({
      item: "Item " + n,
      status: "conforme",
      observacao: "",
    })),
    planoDeAcao: "",
    status: "conforme",
    notaGeral: 10,
    data: Timestamp.now(),
  };
  return [
    { path: "escolas/a/assinaturas/" + id + "-r", data: r },
    { path: "escolas/a/assinaturas/" + id + "-t", data: t },
    { path: "escolas/a/vistorias/" + id, data: v },
  ];
}
test("R03/R04: CPF inválido e responsável divergente são negados", async () => {
  const db = banco("diretor");
  await assertFails(
    loteAuditado(
      env,
      db,
      "diretor",
      vistoria("nome-sem-letras", { nome: "-- --" }),
    ),
  );
  await assertFails(
    loteAuditado(env, db, "diretor", vistoria("cpf", { cpf: "12345678900" })),
  );
  await assertFails(
    loteAuditado(env, db, "diretor", vistoria("nome", { divergente: true })),
  );
  await assertSucceeds(loteAuditado(env, db, "diretor", vistoria("valida")));
});
test("vistoria completa com oito itens conserva validade e auditoria", async () => {
  await assertSucceeds(
    loteAuditado(
      env,
      banco("diretor"),
      "diretor",
      vistoria("oito", { itens: 8 }),
    ),
  );
});
test("todos os itens do checklist são validados, incluindo o último", async () => {
  const ops = vistoria("ultimo-invalido", { itens: 8 });
  ops[2].data.checklist[7].campoExtra = "indevido";
  await assertFails(loteAuditado(env, banco("diretor"), "diretor", ops));
});
test("histórico novo é imutável e não aceita nome de autor forjado", async () => {
  const db = banco("master");
  await assertFails(
    loteAuditado(
      env,
      db,
      "master",
      [{ path: "escolas/autor", data: { nome: "Escola A", ativo: true } }],
      ({ b, r, ar, e, depois }) => {
        b.set(r, depois);
        b.set(ar, { ...e, usuarioNome: "Outra Pessoa" });
      },
    ),
  );
  const path =
    "alunos/a/notas/" + chaveNota("matematica", 2026, 1, "professor");
  const id = (await getDoc(doc(db, path))).data()._auditoria;
  await assertFails(
    setDoc(doc(db, "auditoriaRegistros", id), { acao: "outra" }),
  );
  await assertFails(getDoc(doc(banco("professor"), "auditoriaRegistros", id)));
});
test("cadastro com oito professores ativos da mesma escola continua permitido", async () => {
  const uids = [];
  for (let i = 0; i < 8; i++) {
    const uid = "p-" + i;
    uids.push(uid);
    await seed("usuarios/" + uid, {
      nome: "Professor " + i,
      papel: "professor",
      ativo: true,
      escolasVinculadas: ["a"],
    });
  }
  await assertSucceeds(
    loteAuditado(env, banco("diretor"), "diretor", [
      {
        path: "alunos/oito",
        data: {
          nome: "Aluno Oito",
          turma: "8 A",
          ano: 2026,
          responsavelUid: "familia",
          professoresUids: uids,
          escolaId: "a",
          ativo: true,
          versao: 1,
          atualizadoEm: serverTimestamp(),
        },
      },
    ]),
  );
});
test("manutenção bloqueia operações auditadas", async () => {
  await seed("operacao/estado", { bloqueado: true });
  await assertFails(
    loteAuditado(env, banco("master"), "master", [
      { path: "escolas/bloqueada", data: { nome: "Escola B", ativo: true } },
    ]),
  );
  await seed("operacao/estado", { bloqueado: false });
});
