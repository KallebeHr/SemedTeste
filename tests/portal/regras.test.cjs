const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc: rawSetDoc,
  updateDoc: rawUpdateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} = require("firebase/firestore");
let env;
const stamp = () => serverTimestamp();
const { loteAuditado, chaveNota } = require("../seguranca/apoio.cjs");
const donos = new WeakMap();
const banco = (uid, verified = true) => {
  const db = env
    .authenticatedContext(uid, {
      email: uid + "@example.test",
      email_verified: verified,
      auth_time: Math.floor(Date.now() / 1000),
    })
    .firestore();
  donos.set(db, uid);
  if (db._delegate) donos.set(db._delegate, uid);
  return db;
};
const seed = async (p, d) =>
  env.withSecurityRulesDisabled((c) => rawSetDoc(doc(c.firestore(), p), d));
function writeBatch(db) {
  const ops = new Map();
  const b = {
    set(r, data) {
      ops.set(r.path, { path: r.path, data });
      return b;
    },
    update(r, data) {
      ops.set(r.path, { path: r.path, data, tipo: "update" });
      return b;
    },
    delete(r) {
      ops.set(r.path, { path: r.path, tipo: "delete" });
      return b;
    },
    commit() {
      return loteAuditado(env, db, donos.get(db), [...ops.values()]);
    },
  };
  return b;
}
const setDoc = (r, data) =>
  donos.has(r.firestore)
    ? writeBatch(r.firestore).set(r, data).commit()
    : rawSetDoc(r, data);
const updateDoc = (r, data) =>
  Object.keys(data).join() === "ultimoAcesso"
    ? rawUpdateDoc(r, data)
    : writeBatch(r.firestore).update(r, data).commit();
const deleteDoc = (r) => writeBatch(r.firestore).delete(r).commit();
const pathNota = (aluno = "aluno-a", bimestre = 1) =>
  "alunos/" +
  aluno +
  "/notas/" +
  chaveNota("matematica", 2026, bimestre, "professor");
const resumo = (nome, cpf) => ({
  nome,
  cpfMascarado: "***." + cpf.slice(3, 6) + "." + cpf.slice(6, 9) + "-**",
  funcao: "diretor",
  metodo: "identificacao_cpf",
});
const perfil = (papel, escolas = ["a"]) => ({
  nome: papel + " Teste",
  email: papel + "@example.test",
  papel,
  ativo: true,
  escolasVinculadas: escolas,
});
const publicar = (db, id, c) => {
  const b = writeBatch(db);
  b.set(doc(db, "conteudos", id), {
    ...c,
    versao: 1,
    publicado: true,
    atualizadoPor: db.app.options.projectId ? "master" : "master",
    atualizadoEm: stamp(),
  });
  b.set(doc(db, "publicacoes", id), { ...c, publicadoEm: stamp() });
  return b;
};
const conteudo = (extra = {}) => ({
  tipo: "noticia",
  titulo: "Notícia de teste",
  resumo: "Resumo",
  texto: "Texto público",
  categoria: "Rede",
  slug: "",
  url: "",
  imagemUrl: "",
  imagemAlt: "",
  dataInicio: "2026-09-03",
  dataFim: "",
  local: "",
  numero: "",
  destaque: false,
  ordem: 0,
  escolaId: "",
  ...extra,
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-seduc",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync(
        path.join(__dirname, "../../firebase/firestore.rules"),
        "utf8",
      ),
    },
  });
  await env.clearFirestore();
  for (const p of [
    "master",
    "alimentador",
    "nutricionista",
    "diretor",
    "professor",
  ])
    await seed("usuarios/" + p, perfil(p));
  await seed("usuarios/legado", perfil("admin"));
  await seed("usuarios/suspenso", { ...perfil("master"), ativo: false });
  await seed("usuarios/professor-b", perfil("professor", ["b"]));
  await seed("usuarios/diretor-b", perfil("diretor", ["b"]));
  for (const id of ["a", "b"]) {
    await seed("escolas/" + id, { nome: "Escola " + id, ativo: true });
    await seed("escolasPublicas/" + id, {
      nome: "Escola " + id,
      endereco: "",
      contato: "",
      etapas: "",
      horario: "",
      sobre: "",
      publicadoEm: Timestamp.now(),
    });
  }
  await seed("conteudos/rascunho", {
    ...conteudo(),
    versao: 1,
    publicado: false,
    atualizadoPor: "master",
    atualizadoEm: Timestamp.now(),
  });
  await seed("alunos/aluno-a", {
    nome: "Aluno de teste A",
    turma: "Turma A",
    ano: 2026,
    responsavelUid: "familia",
    professoresUids: ["professor"],
    escolaId: "a",
    ativo: true,
    versao: 1,
    atualizadoEm: Timestamp.now(),
  });
  await seed("alunos/aluno-b", {
    nome: "Aluno de teste B",
    turma: "Turma B",
    ano: 2026,
    responsavelUid: "outra-familia",
    professoresUids: ["professor-b"],
    escolaId: "b",
    ativo: true,
    versao: 1,
    atualizadoEm: Timestamp.now(),
  });
  await seed("escolas/a/estoque/arroz", {
    nome: "Arroz",
    quantidadeAtual: 10,
    quantidadeMinima: 1,
    precoUnitario: 5,
    ativo: true,
  });
  await seed("escolas/a/assinaturas/identificacao", {
    cpf: "52998224725",
    criadoPor: "nutricionista",
  });
  await seed("escolas/a/assinaturas/publicavel", {
    metodo: "identificacao_cpf",
    versao: 2,
    nomeSignatario: "Responsável de teste",
    cpf: "52998224725",
    papelSignatario: "nutricionista",
    hashDocumento: "a".repeat(64),
    dataHora: Timestamp.now(),
    criadoPor: "nutricionista",
    documentoId: "v1",
    documentoTipo: "vistoria",
    cargoDocumento: "responsavel",
  });
  await seed("escolas/a/vistorias/v1", {
    tipo: "sanitaria",
    status: "conforme",
    notaGeral: 10,
    data: Timestamp.fromMillis(1788390000000),
    responsavelNome: "Responsável de teste",
    assinaturaResponsavelId: "publicavel",
    metodoConfirmacao: "identificacao_cpf",
    responsavelId: "nutricionista",
    planoDeAcao: "Interno",
  });
});
after(async () => {
  await env?.cleanup();
});
test("anônimo lê somente publicações e fichas públicas", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(db, "publicacoes")));
  await assertSucceeds(getDocs(collection(db, "escolasPublicas")));
  for (const p of [
    "usuarios/master",
    "escolas/a",
    "escolas/a/estoque/arroz",
    "escolas/a/assinaturas/identificacao",
    "escolas/a/vistorias/v1",
    "alunos/aluno-a",
    "conteudos/rascunho",
  ])
    await assertFails(getDoc(doc(db, p)));
  await assertFails(setDoc(doc(db, "publicacoes/invasao"), conteudo()));
});
test("cargo legado admin mantém acesso de Master; conta suspensa perde acesso", async () => {
  await assertSucceeds(getDocs(collection(banco("legado"), "usuarios")));
  await assertFails(getDocs(collection(banco("suspenso"), "usuarios")));
  await assertFails(getDoc(doc(banco("suspenso"), "escolas/a")));
});
test("próprio usuário não eleva cargo nem altera vínculos; Master não remove o próprio acesso", async () => {
  await assertFails(
    updateDoc(doc(banco("professor"), "usuarios/professor"), {
      papel: "master",
    }),
  );
  await assertFails(
    updateDoc(doc(banco("diretor"), "usuarios/diretor"), {
      escolasVinculadas: ["a", "b"],
    }),
  );
  await assertFails(
    updateDoc(doc(banco("master"), "usuarios/master"), { ativo: false }),
  );
  await assertSucceeds(
    updateDoc(doc(banco("professor"), "usuarios/professor"), {
      ultimoAcesso: stamp(),
    }),
  );
  await assertFails(
    setDoc(doc(banco("familia"), "usuarios/familia"), perfil("master")),
  );
});
test("Alimentador publica conteúdo, mas não gerencia contas, CPFs ou notas", async () => {
  const db = banco("alimentador"),
    c = conteudo(),
    b = writeBatch(db);
  b.set(doc(db, "conteudos/noticia-alimentador"), {
    ...c,
    versao: 1,
    publicado: true,
    atualizadoPor: "alimentador",
    atualizadoEm: stamp(),
  });
  b.set(doc(db, "publicacoes/noticia-alimentador"), {
    ...c,
    publicadoEm: stamp(),
  });
  await assertSucceeds(b.commit());
  for (const p of [
    "usuarios/master",
    "escolas/a/assinaturas/identificacao",
    "alunos/aluno-a",
  ])
    await assertFails(getDoc(doc(db, p)));
  await assertFails(setDoc(doc(db, "usuarios/invasao"), perfil("master")));
  await assertFails(
    setDoc(doc(db, "conteudos/cardapio-invasao"), {
      ...conteudo({ tipo: "cardapio", numero: "2026-09", escolaId: "a" }),
      versao: 1,
      publicado: false,
      atualizadoPor: "alimentador",
      atualizadoEm: stamp(),
    }),
  );
});
test("rascunho não é público; publicação rejeita campo CPF e alteração fora do rascunho", async () => {
  const db = banco("master"),
    c = conteudo(),
    b = publicar(db, "noticia-cpf", c);
  b.set(doc(db, "publicacoes/noticia-cpf"), {
    ...c,
    cpf: "52998224725",
    publicadoEm: stamp(),
  });
  await assertFails(b.commit());
  const b2 = publicar(db, "noticia-inconsistente", c);
  b2.set(doc(db, "publicacoes/noticia-inconsistente"), {
    ...c,
    texto: "Diferente do rascunho",
    publicadoEm: stamp(),
  });
  await assertFails(b2.commit());
  await assertSucceeds(publicar(db, "noticia-real", c).commit());
  await assertFails(
    updateDoc(doc(db, "publicacoes/noticia-real"), { titulo: "Edição direta" }),
  );
});
test("Nutricionista só edita cardápios; Diretor não publica resultados nem entra em escola alheia", async () => {
  const db = banco("nutricionista"),
    c = conteudo({ tipo: "cardapio", numero: "2026-09", escolaId: "a" }),
    b = writeBatch(db);
  b.set(doc(db, "conteudos/cardapio-a"), {
    ...c,
    versao: 1,
    publicado: true,
    atualizadoPor: "nutricionista",
    atualizadoEm: stamp(),
  });
  b.set(doc(db, "publicacoes/cardapio-a"), { ...c, publicadoEm: stamp() });
  await assertSucceeds(b.commit());
  await assertFails(
    setDoc(doc(db, "conteudos/noticia-nutri"), {
      ...conteudo(),
      versao: 1,
      publicado: false,
      atualizadoPor: "nutricionista",
      atualizadoEm: stamp(),
    }),
  );
  await assertSucceeds(
    getDocs(
      query(collection(db, "conteudos"), where("tipo", "==", "cardapio")),
    ),
  );
  await assertFails(getDocs(collection(db, "conteudos")));
  await assertSucceeds(getDoc(doc(banco("diretor"), "escolas/a/vistorias/v1")));
  await assertFails(getDoc(doc(banco("diretor-b"), "escolas/a/vistorias/v1")));
});
test("resumo de vistoria deve corresponder ao documento real e não aceita informações extras", async () => {
  const db = banco("nutricionista"),
    r = doc(db, "escolasPublicas/a/vistorias/v1"),
    d = {
      escolaId: "a",
      tipo: "sanitaria",
      status: "conforme",
      nota: 10,
      data: Timestamp.fromMillis(1788390000000),
      responsavelNome: "Responsável de teste",
      publicadoEm: stamp(),
    };
  await assertSucceeds(setDoc(r, d));
  await assertFails(setDoc(r, { ...d, cpf: "52998224725" }));
  await assertFails(setDoc(r, { ...d, nota: 1 }));
  await assertFails(
    setDoc(doc(banco("diretor"), "escolasPublicas/a/vistorias/v1"), d),
  );
  await assertSucceeds(
    getDocs(
      collection(
        env.unauthenticatedContext().firestore(),
        "escolasPublicas/a/vistorias",
      ),
    ),
  );
});
test("família consulta somente os alunos vinculados e nunca grava notas", async () => {
  const db = banco("familia");
  await assertSucceeds(
    getDocs(
      query(collection(db, "alunos"), where("responsavelUid", "==", "familia")),
    ),
  );
  await assertFails(getDocs(collection(db, "alunos")));
  await assertFails(getDoc(doc(db, "alunos/aluno-b")));
  await assertFails(getDoc(doc(banco("familia", false), "alunos/aluno-a")));
  await assertFails(setDoc(doc(db, "alunos/aluno-a/notas/x"), { nota: 10 }));
});
const nota = (uid, extra = {}) => ({
  componente: "Matemática",
  ano: 2026,
  bimestre: 1,
  nota: 8,
  frequencia: 95,
  observacao: "",
  professorUid: uid,
  versao: 1,
  atualizadoEm: stamp(),
  ...extra,
});
test("Professor registra somente alunos e escolas vinculados; valida nota e frequência", async () => {
  const db = banco("professor");
  await assertSucceeds(
    getDocs(
      query(
        collection(db, "alunos"),
        where("professoresUids", "array-contains", "professor"),
        where("escolaId", "in", ["a"]),
      ),
    ),
  );
  await assertSucceeds(setDoc(doc(db, pathNota()), nota("professor")));
  await assertFails(setDoc(doc(db, pathNota("aluno-b")), nota("professor")));
  await assertFails(
    setDoc(
      doc(db, pathNota("aluno-a", 2)),
      nota("professor", { nota: 11, bimestre: 2 }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db, pathNota("aluno-a", 3)),
      nota("professor", { frequencia: -1, bimestre: 3 }),
    ),
  );
  await assertFails(
    updateDoc(doc(db, "alunos/aluno-a"), { responsavelUid: "professor" }),
  );
  await assertSucceeds(getDoc(doc(banco("familia"), pathNota())));
});
test("Diretor não vincula professor de outra escola ao aluno", async () => {
  await assertFails(
    updateDoc(doc(banco("diretor"), "alunos/aluno-a"), {
      professoresUids: ["professor-b"],
      versao: 2,
      atualizadoEm: stamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(banco("diretor"), "alunos/aluno-a"), {
      professoresUids: ["professor"],
      versao: 2,
      atualizadoEm: stamp(),
    }),
  );
});
function pedido(uid, extra = {}) {
  return {
    tipo: "matricula",
    nome: "Responsável teste",
    email: uid + "@example.test",
    assunto: "Solicitação de matrícula",
    mensagem: "Solicito orientações.",
    escolaId: "a",
    alunoNome: "Aluno teste",
    serie: "5º ano",
    donoUid: uid,
    status: "recebida",
    resposta: "",
    versao: 1,
    criadoEm: stamp(),
    atualizadoEm: stamp(),
    ...extra,
  };
}
function enviar(db, id, d) {
  const b = writeBatch(db);
  b.set(doc(db, "solicitacoes", id), d);
  b.set(doc(db, "limitesAtendimento", d.donoUid), {
    ultimoEnvio: stamp(),
    ultimoProtocolo: id,
  });
  return b.commit();
}
test("solicitação exige e-mail confirmado, propriedade, protocolo e intervalo entre envios", async () => {
  await assertFails(
    enviar(
      banco("nao-verificado", false),
      "pedido-nao-verificado",
      pedido("nao-verificado"),
    ),
  );
  await assertFails(
    setDoc(doc(banco("familia"), "solicitacoes/sem-limite"), pedido("familia")),
  );
  await assertSucceeds(enviar(banco("familia"), "pedido-1", pedido("familia")));
  await assertFails(
    enviar(banco("familia"), "pedido-rapido", pedido("familia")),
  );
  await assertFails(
    getDoc(doc(banco("outra-familia"), "solicitacoes/pedido-1")),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(banco("familia"), "solicitacoes"),
        where("donoUid", "==", "familia"),
      ),
    ),
  );
  await assertFails(
    updateDoc(doc(banco("familia"), "solicitacoes/pedido-1"), {
      status: "deferida",
    }),
  );
});
test("Diretor atende apenas protocolos escolares da sua unidade; resposta não altera titular", async () => {
  const db = banco("diretor");
  await assertSucceeds(
    getDocs(
      query(
        collection(db, "solicitacoes"),
        where("escolaId", "==", "a"),
        where("tipo", "in", ["matricula", "transporte"]),
      ),
    ),
  );
  await assertFails(getDocs(collection(db, "solicitacoes")));
  await assertSucceeds(
    updateDoc(doc(db, "solicitacoes/pedido-1"), {
      status: "em_analise",
      resposta: "Em análise pela escola.",
      atendidoPor: "diretor",
      versao: 2,
      atualizadoEm: stamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(db, "solicitacoes/pedido-1"), {
      donoUid: "diretor",
      versao: 3,
      atualizadoEm: stamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(banco("diretor-b"), "solicitacoes/pedido-1"), {
      status: "deferida",
      resposta: "Aprovado",
      atendidoPor: "diretor-b",
      versao: 3,
      atualizadoEm: stamp(),
    }),
  );
});
test("auditoria é restrita ao Master e imutável", async () => {
  const db = banco("professor"),
    r = doc(db, "auditoriaPortal/evento-teste");
  await assertFails(
    setDoc(r, {
      acao: "registrar_nota",
      tipo: "nota",
      documentoId: "aluno-a/matematica",
      usuarioId: "professor",
      usuarioNome: "professor Teste",
      timestamp: stamp(),
    }),
  );
  await seed("auditoriaPortal/evento-teste", {
    acao: "historico-legado",
    usuarioId: "professor",
  });
  await assertFails(getDoc(r));
  await assertSucceeds(
    getDoc(doc(banco("master"), "auditoriaPortal/evento-teste")),
  );
  await assertFails(
    updateDoc(doc(banco("master"), "auditoriaPortal/evento-teste"), {
      acao: "alterada",
    }),
  );
  await assertFails(
    deleteDoc(doc(banco("master"), "auditoriaPortal/evento-teste")),
  );
});

test("saldo de estoque não pode ser editado sem movimentação; saldo e identificação são atômicos", async () => {
  const db = banco("nutricionista");
  await assertFails(
    updateDoc(doc(db, "escolas/a/estoque/arroz"), { quantidadeAtual: 99 }),
  );
  const movId = "mov-regra",
    identId = "ident-regra";
  const identidade = {
    metodo: "identificacao_cpf",
    versao: 2,
    nomeSignatario: "Responsável Teste",
    cpf: "52998224725",
    papelSignatario: "nutricionista",
    hashDocumento: "a".repeat(64),
    dataHora: Timestamp.now(),
    criadoPor: "nutricionista",
    documentoId: movId,
    documentoTipo: "movimentacao",
    cargoDocumento: "responsavel",
  };
  const mov = {
    tipo: "entrada",
    itemId: "arroz",
    itemNome: "Arroz",
    quantidade: 3,
    quantidadeAnterior: 10,
    quantidadeResultante: 13,
    motivo: "Recebimento",
    responsavelId: "nutricionista",
    responsavelNome: identidade.nomeSignatario,
    registradoPorNome: 'nutricionista Teste',
    identificacaoResponsavel: { ...resumo(identidade.nomeSignatario, identidade.cpf), funcao: 'nutricionista' },
    data: Timestamp.now(),
    assinaturaId: identId,
    metodoConfirmacao: "identificacao_cpf",
  };
  const b = writeBatch(db);
  b.update(doc(db, "escolas/a/estoque/arroz"), {
    quantidadeAtual: 13,
    ultimaMovimentacaoId: movId,
    atualizadoEm: stamp(),
    atualizadoPor: "nutricionista",
  });
  b.set(doc(db, "escolas/a/assinaturas", identId), identidade);
  b.set(doc(db, "escolas/a/movimentacoes", movId), mov);
  await assertSucceeds(b.commit());
  assert.equal(
    (await getDoc(doc(db, "escolas/a/estoque/arroz"))).data().quantidadeAtual,
    13,
  );
  await assertFails(
    setDoc(doc(db, "escolas/a/assinaturas/solta"), {
      ...identidade,
      documentoId: "inexistente",
    }),
  );
});

test("vistoria exige duas identificações vinculadas com CPFs distintos", async () => {
  const db = banco("diretor"),
    id = "vistoria-regra",
    r1 = id + "-responsavel",
    r2 = id + "-testemunha";
  const identidade = (cpf, nome) => ({
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
    cargoDocumento: nome === "Testemunha Teste" ? "testemunha" : "responsavel",
  });
  const dados = {
    responsavelId: "diretor",
    assinaturaResponsavelId: r1,
    assinaturaTestemunhaId: r2,
    metodoConfirmacao: "identificacao_cpf",
    tipo: "rotina",
    checklist: [{ item: "Higiene", status: "conforme", observacao: "" }],
    planoDeAcao: "",
    status: "conforme",
    notaGeral: 10,
    data: Timestamp.now(),
    responsavelNome: "Responsável Teste",
    registradoPorNome: "diretor Teste",
    identificacaoResponsavel: resumo("Responsável Teste", "52998224725"),
    identificacaoTestemunha: resumo("Testemunha Teste", "11144477735"),
  };
  const b = writeBatch(db);
  b.set(
    doc(db, "escolas/a/assinaturas", r1),
    identidade("52998224725", "Responsável Teste"),
  );
  b.set(
    doc(db, "escolas/a/assinaturas", r2),
    identidade("11144477735", "Testemunha Teste"),
  );
  b.set(doc(db, "escolas/a/vistorias", id), dados);
  await assertSucceeds(b.commit());
  const c = writeBatch(db),
    id2 = "vistoria-iguais";
  c.set(doc(db, "escolas/a/assinaturas/igual-1"), {
    ...identidade("52998224725", "Responsável Teste"),
    documentoId: id2,
  });
  c.set(doc(db, "escolas/a/assinaturas/igual-2"), {
    ...identidade("52998224725", "Testemunha Teste"),
    documentoId: id2,
  });
  c.set(doc(db, "escolas/a/vistorias", id2), {
    ...dados,
    assinaturaResponsavelId: "igual-1",
    assinaturaTestemunhaId: "igual-2",
  });
  await assertFails(c.commit());
});

test("checklist exige respostas e confere nota e plano de ação no servidor, inclusive com 8 itens", async () => {
  const db = banco("diretor");
  async function gravar(id, checklist, notaGeral, status, planoDeAcao = "") {
    const b = writeBatch(db),
      r1 = id + "-resp",
      r2 = id + "-test";
    for (const [r, cpf, nome] of [
      [r1, "52998224725", "Responsável Teste"],
      [r2, "11144477735", "Testemunha Teste"],
    ])
      b.set(doc(db, "escolas/a/assinaturas", r), {
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
        cargoDocumento: r === r1 ? "responsavel" : "testemunha",
      });
    b.set(doc(db, "escolas/a/vistorias", id), {
      responsavelId: "diretor",
      assinaturaResponsavelId: r1,
      assinaturaTestemunhaId: r2,
      metodoConfirmacao: "identificacao_cpf",
      tipo: "rotina",
      checklist,
      planoDeAcao,
      status,
      notaGeral,
      data: Timestamp.now(),
      responsavelNome: "Responsável Teste",
      registradoPorNome: "diretor Teste",
      identificacaoResponsavel: resumo("Responsável Teste", "52998224725"),
      identificacaoTestemunha: resumo("Testemunha Teste", "11144477735"),
    });
    return b.commit();
  }
  const item = (status) => ({
    item: "Item de avaliação",
    status,
    observacao: "",
  });
  await assertFails(gravar("vazia", [], 10, "conforme"));
  await assertFails(
    gravar("nota-forjada", [item("nao_conforme")], 10, "conforme"),
  );
  await assertFails(
    gravar("sem-plano", [item("nao_conforme")], 0, "conforme_com_ressalvas"),
  );
  await assertSucceeds(
    gravar(
      "vinte",
      Array.from({ length: 8 }, () => item("conforme")),
      10,
      "conforme",
    ),
  );
  await assertFails(
    gravar(
      "vinte-um",
      Array.from({ length: 9 }, () => item("conforme")),
      10,
      "conforme",
    ),
  );
  await assertSucceeds(
    gravar(
      "arredondamento",
      [
        ...Array.from({ length: 5 }, () => item("conforme")),
        item("nao_conforme"),
      ],
      8.3,
      "conforme_com_ressalvas",
      "Revisar armazenamento.",
    ),
  );
  await assertSucceeds(
    gravar("na", [item("nao_aplicavel")], null, "nao_aplicavel"),
  );
});

test("suspensão revoga também alertas destinados à conta", async () => {
  await seed("notificacoes/revogacao", {
    destinatarios: ["suspenso"],
    escolaId: "a",
    lida: false,
  });
  await assertFails(getDoc(doc(banco("suspenso"), "notificacoes/revogacao")));
  await assertFails(
    updateDoc(doc(banco("suspenso"), "notificacoes/revogacao"), { lida: true }),
  );
});
