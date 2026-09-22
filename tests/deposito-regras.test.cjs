const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  documentId,
  Timestamp,
  serverTimestamp,
} = require("firebase/firestore");
const { loteAuditado } = require("./seguranca/apoio.cjs");
let env;
const depot = "deposito-municipal";
const banco = (uid) =>
  env
    .authenticatedContext(uid, { auth_time: Math.floor(Date.now() / 1000) })
    .firestore();
const seed = (p, d) =>
  env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), p), d));
const item = (q = 10) => ({
  nome: "Arroz",
  ativo: true,
  unidade: "kg",
  categoria: "nao_perecivel",
  quantidadeAtual: q,
  quantidadeMinima: 2,
  precoUnitario: 5,
  validade: null,
  localArmazenamento: "Prateleira A",
});
const write = (uid, ops) => loteAuditado(env, banco(uid), uid, ops);
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-seduc",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync(
        require("node:path").join(__dirname, "../firebase/firestore.rules"),
        "utf8",
      ),
    },
  });
  await env.clearFirestore();
  for (const papel of [
    "master",
    "admin",
    "nutricionista",
    "gerente",
    "alimentador",
    "diretor",
    "professor",
  ])
    await seed("usuarios/" + papel, {
      nome: papel + " Teste",
      papel,
      ativo: true,
      escolasVinculadas: ["a", depot],
    });
  await seed("escolas/a", { nome: "Escola A", ativo: true });
  await seed("escolas/" + depot, {
    nome: "Depósito municipal da Educação",
    tipoUnidade: "deposito",
    ativo: true,
  });
  await seed("escolas/" + depot + "/estoque/arroz", item());
  await seed("escolas/a/estoque/arroz", item());
});
after(async () => env?.cleanup());
test("gestão consulta depósito; visitante, editorial, professor e diretor vinculados não leem seu estoque", async () => {
  for (const uid of ["master", "admin", "nutricionista", "gerente"])
    await assertSucceeds(
      getDocs(collection(banco(uid), "escolas", depot, "estoque")),
    );
  for (const uid of ["alimentador", "diretor", "professor"])
    await assertFails(
      getDoc(doc(banco(uid), "escolas", depot, "estoque/arroz")),
    );
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        "escolas",
        depot,
        "estoque/arroz",
      ),
    ),
  );
  await assertSucceeds(getDocs(collection(banco("alimentador"), "escolas")));
  await assertSucceeds(
    getDocs(
      query(
        collection(banco("diretor"), "escolas"),
        where(documentId(), "in", ["a"]),
        where("ativo", "==", true),
      ),
    ),
  );
  await assertSucceeds(
    getDoc(doc(banco("diretor"), "escolas/a/estoque/arroz")),
  );
});
test("depósito exige gestão e tipo correto; não pode ser publicado como escola", async () => {
  await assertFails(
    write("alimentador", [
      {
        path: "escolas/" + depot,
        tipo: "update",
        data: { nome: "Mudança indevida" },
      },
    ]),
  );
  await assertFails(
    write("master", [
      {
        path: "escolas/" + depot,
        tipo: "update",
        data: { tipoUnidade: "escola" },
      },
    ]),
  );
  await assertSucceeds(
    write("gerente", [
      {
        path: "escolas/" + depot,
        tipo: "update",
        data: { nome: "Depósito municipal da Educação" },
      },
    ]),
  );
  await assertFails(
    write("master", [
      {
        path: "escolasPublicas/" + depot,
        data: {
          nome: "Depósito municipal da Educação",
          endereco: "",
          contato: "",
          etapas: "",
          horario: "",
          sobre: "",
          publicadoEm: serverTimestamp(),
        },
      },
    ]),
  );
});
test("cadastro e arquivamento auditados; saldo e unidade não podem ser adulterados", async () => {
  const path = "escolas/" + depot + "/estoque/cadastro";
  await assertSucceeds(write("master", [{ path, data: item() }]));
  await assertFails(
    updateDoc(doc(banco("master"), path), { nome: "Sem auditoria" }),
  );
  await assertFails(
    write("master", [{ path, tipo: "update", data: { quantidadeAtual: 0 } }]),
  );
  await assertFails(
    write("master", [{ path, tipo: "update", data: { ativo: false } }]),
  );
  await assertFails(
    write("master", [{ path, tipo: "update", data: { unidade: "l" } }]),
  );
  await assertFails(
    write("diretor", [
      { path: "escolas/" + depot + "/estoque/invasao", data: item() },
    ]),
  );
  const zero = "escolas/" + depot + "/estoque/zero";
  await assertSucceeds(write("master", [{ path: zero, data: item(0) }]));
  await assertSucceeds(
    write("master", [{ path: zero, tipo: "update", data: { ativo: false } }]),
  );
  await assertSucceeds(
    write("master", [{ path: zero, tipo: "update", data: { ativo: true } }]),
  );
  await assertFails(write("master", [{ path: zero, tipo: "delete" }]));
});
function operacoes(id, qtd = 3, unidade = "kg", antes = 10) {
  const uid = "nutricionista",
    prefix = "escolas/" + depot;
  const ident = {
    metodo: "identificacao_cpf",
    versao: 2,
    nomeSignatario: "Responsável Teste",
    cpf: "52998224725",
    papelSignatario: uid,
    hashDocumento: "a".repeat(64),
    dataHora: Timestamp.now(),
    criadoPor: uid,
    documentoId: id,
    documentoTipo: "movimentacao",
    cargoDocumento: "responsavel",
  };
  return [
    {
      path: prefix + "/estoque/arroz",
      tipo: "update",
      data: {
        quantidadeAtual: antes - qtd,
        ultimaMovimentacaoId: id,
        atualizadoPor: uid,
        atualizadoEm: serverTimestamp(),
      },
    },
    { path: prefix + "/assinaturas/" + id, data: ident },
    {
      path: prefix + "/movimentacoes/" + id,
      data: {
        tipo: "saida",
        itemId: "arroz",
        itemNome: "Arroz",
        unidade,
        quantidade: qtd,
        quantidadeAnterior: antes,
        quantidadeResultante: antes - qtd,
        motivo: "Distribuição",
        responsavelId: uid,
        responsavelNome: ident.nomeSignatario,
        registradoPorNome: uid + " Teste",
        identificacaoResponsavel: {
          nome: ident.nomeSignatario,
          cpfMascarado: "***.982.247-**",
          funcao: uid,
          metodo: "identificacao_cpf",
        },
        data: Timestamp.now(),
        assinaturaId: id,
        metodoConfirmacao: "identificacao_cpf",
      },
    },
  ];
}
test("retirada atômica impede saldo negativo, unidade falsa e movimento sem saldo", async () => {
  await assertFails(write("nutricionista", operacoes("excesso", 11)));
  await assertFails(write("nutricionista", operacoes("unidade", 3, "l")));
  await assertFails(write("nutricionista", operacoes("sem-saldo").slice(1)));
  await assertSucceeds(write("nutricionista", operacoes("correto")));
  assert.equal(
    (
      await getDoc(doc(banco("master"), "escolas/" + depot + "/estoque/arroz"))
    ).data().quantidadeAtual,
    7,
  );
  await assertFails(
    write("nutricionista", operacoes("saldo-antigo", 3, "kg", 10)),
  );
  await assertFails(write("nutricionista", operacoes("correto", 3, "kg", 7)));
  await assertSucceeds(write("nutricionista", operacoes("zerar", 7, "kg", 7)));
  const path = "escolas/" + depot + "/estoque/arroz";
  await assertSucceeds(
    write("master", [{ path, tipo: "update", data: { ativo: false } }]),
  );
  await assertSucceeds(
    write("master", [{ path, tipo: "update", data: { ativo: true } }]),
  );
  await assertFails(
    write("master", [{ path, tipo: "update", data: { unidade: "l" } }]),
  );
});
test("depósito inativo bloqueia novos cadastros de estoque", async () => {
  await seed("escolas/" + depot, {
    nome: "Depósito",
    tipoUnidade: "deposito",
    ativo: false,
  });
  await assertFails(
    write("master", [
      { path: "escolas/" + depot + "/estoque/inativo", data: item() },
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
function vistoriaPeriodica(
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

function operacaoPeriodica(tipo, unidade = depot, uid = "master") {
  const ops = vistoriaPeriodica(tipo + "-" + unidade + "-" + uid, { itens: 8 });
  for (const op of ops) {
    op.path = op.path.replace("escolas/a/", "escolas/" + unidade + "/");
    if (op.data.criadoPor) op.data.criadoPor = uid;
    if (op.data.responsavelId) {
      op.data.responsavelId = uid;
      op.data.registradoPorNome = uid + " Teste";
      op.data.tipo = tipo;
    }
  }
  return ops;
}
test("depósito: três periodicidades exigem gestão, auditoria e unidade ativa", async () => {
  await seed("escolas/" + depot, {
    nome: "Depósito municipal",
    tipoUnidade: "deposito",
    ativo: true,
  });
  for (const tipo of [
    "deposito_diaria",
    "deposito_semanal",
    "deposito_mensal",
  ]) {
    await assertSucceeds(write("master", operacaoPeriodica(tipo)));
    await assertFails(write("master", operacaoPeriodica(tipo, "a")));
    for (const uid of ["diretor", "professor", "alimentador"])
      await assertFails(write(uid, operacaoPeriodica(tipo, depot, uid)));
  }
  for (const uid of ["nutricionista", "gerente"])
    await assertSucceeds(
      write(uid, operacaoPeriodica("deposito_diaria", depot, uid)),
    );
  await seed("escolas/" + depot, {
    nome: "Depósito municipal",
    tipoUnidade: "deposito",
    ativo: false,
  });
  await assertFails(
    write(
      "nutricionista",
      operacaoPeriodica("deposito_mensal", depot, "nutricionista"),
    ),
  );
});
test("catálogo: cadastro com saldo zero exige auditoria e gestão", async () => {
  await seed("escolas/" + depot, {
    nome: "Depósito municipal",
    tipoUnidade: "deposito",
    ativo: true,
  });
  const produto = require("../src/data/catalogoEstoque.json")[0];
  const path = "escolas/" + depot + "/estoque/cat-" + produto.id;
  const data = {
    ...item(0),
    nome: produto.nome,
    categoria: produto.categoria,
    unidade: produto.unidade,
    atualizadoPor: "master",
    atualizadoEm: serverTimestamp(),
  };
  await assertFails(setDoc(doc(banco("master"), path), data));
  await assertFails(write("professor", [{ path, data }]));
  await assertSucceeds(write("master", [{ path, data }]));
});
