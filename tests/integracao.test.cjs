// Testa os composables reais com serviços Firebase em memória, sem rede ou credenciais.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const vue = require("vue");
const root = path.resolve(__dirname, "..");

async function ambiente(papel = "admin", inicializar = true) {
  const values = new Map([
    ["qa-login", "1"],
    ["qa-role", papel],
  ]);
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    Blob,
    URL,
    TextEncoder,
    atob,
    crypto: require("node:crypto").webcrypto,
    navigator: { userAgent: "teste-local" },
    window: {},
    localStorage: {
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    },
  });
  const cache = new Map();
  const vueModule = new vm.SyntheticModule(
    ["ref", "computed", "toValue"],
    function () {
      for (const k of ["ref", "computed", "toValue"]) this.setExport(k, vue[k]);
    },
    { context },
  );
  const mockPath = path.join(__dirname, "firebase-local.mjs");
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = new vm.SourceTextModule(fs.readFileSync(file, "utf8"), {
      context,
      identifier: file,
    });
    cache.set(file, mod);
    return mod;
  }
  const linker = (specifier, importer) => {
    if (specifier === "vue") return vueModule;
    const target = path.resolve(path.dirname(importer.identifier), specifier);
    if (
      specifier.startsWith("firebase/") ||
      target === path.join(root, "src/firebase")
    )
      return load(mockPath);
    return load(path.extname(target) ? target : target + ".js");
  };
  async function importar(name) {
    const mod = load(path.join(root, "src/composables", name + ".js"));
    if (mod.status === "unlinked") await mod.link(linker);
    if (mod.status !== "evaluated") await mod.evaluate();
    return mod.namespace;
  }
  const auth = await importar("useAuth");
  if (inicializar) {
    await auth.aguardarAutenticacao();
    context.window.__qa.commits = 0;
  } // Desconta ultimoAcesso da preparação do teste.
  return { importar, auth, state: context.window.__qa, context };
}
function assinatura(id, extra = {}) {
  const identId = extra.id || "assinatura-" + id;
  return {
    id: identId,
    referencia: { path: "escolas/escola-a/assinaturas/" + identId },
    payload: {
      nomeSignatario: "Pessoa de teste",
      cpf: "52998224725",
      papelSignatario: "diretor",
      metodo: "identificacao_cpf",
      versao: 2,
      documentoId: id,
      documentoTipo: "movimentacao",
      criadoPor: "qa-user",
      hashDocumento: "a".repeat(64),
      ...extra,
    },
  };
}
function movimento(id = "mov-1", extra = {}) {
  return {
    movimentacaoId: id,
    itemId: "arroz",
    tipo: "entrada",
    quantidade: 3,
    motivo: "Recebimento",
    assinatura: assinatura(id),
    ...extra,
  };
}

test("autenticação aguarda carregar o perfil antes de liberar o usuário", async () => {
  const h = await ambiente("admin", false);
  const api = h.auth.useAuth();
  let pronto = false;
  const aguardar = h.auth.aguardarAutenticacao().then(() => {
    pronto = true;
  });
  assert.equal(api.usuario.value, null);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(pronto, false);
  await aguardar;
  assert.equal(api.usuario.value.papel, "admin");
});

test("conta sem cadastro não é liberada", async () => {
  const h = await ambiente("admin", false);
  h.state.records.delete("usuarios/qa-user");
  await h.auth.aguardarAutenticacao();
  assert.equal(h.auth.useAuth().usuario.value, null);
  assert.match(h.auth.useAuth().erro.value, /ainda não tem acesso/);
});

test("entrada grava saldo, assinatura e movimento juntos", async () => {
  const h = await ambiente();
  const api = (await h.importar("useEstoque")).useEstoque("escola-a");
  const salvo = await api.registrarMovimentacao(movimento());
  assert.equal(salvo.id, "mov-1");
  assert.equal(
    h.state.records.get("escolas/escola-a/estoque/arroz").quantidadeAtual,
    13,
  );
  assert.equal(
    h.state.records.get("escolas/escola-a/movimentacoes/mov-1").assinaturaId,
    "assinatura-mov-1",
  );
  assert.ok(
    h.state.records.has("escolas/escola-a/assinaturas/assinatura-mov-1"),
  );
});

test("reenvio após perda de resposta não duplica quantidade", async () => {
  const h = await ambiente();
  const api = (await h.importar("useEstoque")).useEstoque("escola-a");
  h.state.failNext = "lost-response";
  await assert.rejects(
    api.registrarMovimentacao(movimento()),
    /Resposta perdida/,
  );
  await api.registrarMovimentacao(movimento());
  assert.equal(
    h.state.records.get("escolas/escola-a/estoque/arroz").quantidadeAtual,
    13,
  );
  assert.equal(
    [...h.state.records.keys()].filter((k) => k.includes("/movimentacoes/"))
      .length,
    1,
  );
});

test("falha antes da confirmação não grava parcialmente", async () => {
  const h = await ambiente();
  const api = (await h.importar("useEstoque")).useEstoque("escola-a");
  h.state.failNext = "transaction";
  await assert.rejects(
    api.registrarMovimentacao(movimento()),
    /Falha simulada/,
  );
  assert.equal(
    h.state.records.get("escolas/escola-a/estoque/arroz").quantidadeAtual,
    10,
  );
  assert.equal(
    h.state.records.has("escolas/escola-a/movimentacoes/mov-1"),
    false,
  );
  assert.equal(
    h.state.records.has("escolas/escola-a/assinaturas/assinatura-mov-1"),
    false,
  );
});

test("rejeita quantidade negativa, zero e saída acima do saldo", async () => {
  const h = await ambiente();
  const api = (await h.importar("useEstoque")).useEstoque("escola-a");
  await assert.rejects(
    api.registrarMovimentacao(movimento("neg", { quantidade: -2 })),
  );
  await assert.rejects(
    api.registrarMovimentacao(movimento("zero", { quantidade: 0 })),
  );
  await assert.rejects(
    api.registrarMovimentacao(
      movimento("excesso", { quantidade: 11, tipo: "saida" }),
    ),
    /insuficiente/,
  );
  assert.equal(
    h.state.records.get("escolas/escola-a/estoque/arroz").quantidadeAtual,
    10,
  );
});

test("edição cadastral preserva saldo atualizado por outra movimentação", async () => {
  const h = await ambiente();
  const api = (await h.importar("useEstoque")).useEstoque("escola-a");
  const antes = { ...h.state.records.get("escolas/escola-a/estoque/arroz") };
  await api.registrarMovimentacao(movimento());
  await api.editarItem("arroz", antes, { ...antes, nome: "Arroz integral" });
  const item = h.state.records.get("escolas/escola-a/estoque/arroz");
  assert.equal(item.nome, "Arroz integral");
  assert.equal(item.quantidadeAtual, 13);
  assert.equal(item.id, undefined);
});

test("troca de escola limpa resultados e ignora eventos antigos", async () => {
  const h = await ambiente();
  const id = vue.ref("escola-a");
  const api = (await h.importar("useEstoque")).useEstoque(id);
  api.escutarEstoque();
  await Promise.resolve();
  assert.equal(api.itens.value[0].nome, "Arroz teste");
  const antiga = [...h.state.listeners].find((l) => !l.q.id);
  id.value = "escola-b";
  api.escutarEstoque();
  assert.equal(api.itens.value.length, 0);
  antiga.callback({
    docs: [{ id: "velho", data: () => ({ nome: "Item errado" }) }],
  });
  await Promise.resolve();
  assert.equal(api.itens.value[0].nome, "Feijão teste");
  api.parar();
  assert.equal([...h.state.listeners].filter((l) => !l.q.id).length, 0);
});

test("professor não consegue registrar entrada ou vistoria pelo composable", async () => {
  const h = await ambiente("professor");
  const estoque = (await h.importar("useEstoque")).useEstoque("escola-a");
  await assert.rejects(estoque.registrarMovimentacao(movimento()), /gestão/);
  const vistorias = (await h.importar("useVistorias")).useVistorias("escola-a");
  await assert.rejects(vistorias.registrarVistoria({}), /não pode/);
});

test("vistoria desconsidera N/A na nota e exige plano para toda pendência", async () => {
  const h = await ambiente();
  const api = (await h.importar("useVistorias")).useVistorias("escola-a");
  assert.equal(
    api.calcularNota([{ status: "conforme" }, { status: "nao_aplicavel" }]),
    10,
  );
  const checklist = Array.from({ length: 6 }, (_, i) => ({
    item: "Item " + i,
    status: i ? "conforme" : "nao_conforme",
    observacao: "",
  }));
  await assert.rejects(
    api.registrarVistoria({
      vistoriaId: "v1",
      tipo: "sanitaria",
      checklist,
      assinaturas: [assinatura("v1"), assinatura("v1")],
    }),
    /plano/,
  );
});

test("gestão lista escolas ativas em ordem alfabética sem índice composto", async () => {
  const h = await ambiente();
  h.state.missingCompositeIndexes = true;
  h.state.records.set("escolas/zzz", { nome: "Abacate", ativo: true });
  h.state.records.set("escolas/aaa", { nome: "Zebra", ativo: true });
  h.state.records.set("escolas/inativa", {
    nome: "Escola inativa",
    ativo: false,
  });
  const api = (await h.importar("useEscolas")).useEscolas();
  api.escutarEscolas();
  await Promise.resolve();
  assert.equal(api.erro.value, "");
  assert.equal(api.carregando.value, false);
  assert.equal(api.escolas.value[0].nome, "Abacate");
  assert.equal(api.escolas.value.at(-1).nome, "Zebra");
  assert.equal(
    api.escolas.value.some((e) => e.id === "inativa"),
    false,
  );
  api.parar();
});

test("professor continua recebendo apenas escolas vinculadas e ativas", async () => {
  const h = await ambiente("professor");
  h.state.records.set("escolas/fora", { nome: "Fora do vínculo", ativo: true });
  h.state.records.set("escolas/escola-b", {
    nome: "Escola B inativa",
    ativo: false,
  });
  const api = (await h.importar("useEscolas")).useEscolas();
  api.escutarEscolas();
  await Promise.resolve();
  assert.equal(api.escolas.value.length, 1);
  assert.equal(api.escolas.value[0].id, "escola-a");
  api.parar();
});

test("estoque mantém ordem e filtro de ativos sem índice composto", async () => {
  const h = await ambiente();
  h.state.missingCompositeIndexes = true;
  h.state.records.set("escolas/escola-a/estoque/z", {
    nome: "Abóbora",
    ativo: true,
  });
  h.state.records.set("escolas/escola-a/estoque/inativo", {
    nome: "Inativo",
    ativo: false,
  });
  const api = (await h.importar("useEstoque")).useEstoque("escola-a");
  api.escutarEstoque();
  await Promise.resolve();
  assert.equal(api.erro.value, "");
  assert.equal(api.itens.value[0].nome, "Abóbora");
  assert.equal(
    api.itens.value.some((i) => i.id === "inativo"),
    false,
  );
  api.parar();
});

test("mensagens distinguem índice ausente, permissão e conexão", async () => {
  const h = await ambiente();
  h.context.console = { ...console, error() {} };
  for (const [codigo, mensagem] of [
    ["permission-denied", /negou a leitura/],
    ["failed-precondition", /índices/],
    ["unavailable", /conectar/],
  ]) {
    h.state.queryError = { code: codigo, message: "Falha simulada" };
    for (const nome of ["useEscolas", "useEstoque"]) {
      const mod = await h.importar(nome);
      const api =
        nome === "useEscolas" ? mod.useEscolas() : mod.useEstoque("escola-a");
      (api.escutarEscolas || api.escutarEstoque)();
      await Promise.resolve();
      assert.equal(api.carregando.value, false);
      assert.match(api.erro.value, mensagem);
      assert.ok(api.erro.value.includes(codigo));
      api.parar();
    }
  }
});

function parVistoria(id, extra = {}) {
  return [
    assinatura(id, { documentoTipo: "vistoria" }),
    assinatura(id, {
      id: "testemunha-" + id,
      documentoTipo: "vistoria",
      cpf: "11144477735",
      ...extra,
    }),
  ];
}
function vistoriaDados(id, assinaturas = parVistoria(id)) {
  return {
    vistoriaId: id,
    tipo: "recebimento",
    checklist: [
      { item: "Embalagens íntegras", status: "conforme", observacao: "" },
    ],
    assinaturas,
  };
}
function capturarPrazo(h) {
  let vencer;
  h.context.setTimeout = (callback, ms) => {
    if (ms === 45000 || ms === 120000) {
      vencer = callback;
      return 0;
    }
    return setTimeout(callback, ms);
  };
  return () => {
    assert.ok(vencer);
    vencer();
  };
}
async function microtarefas() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

test("CPF aceita máscara e rejeita tamanho, repetição e dígitos verificadores incorretos", async () => {
  const h = await ambiente();
  const u = await h.importar("../utils/identificacao");
  for (const cpf of ["529.982.247-25", "11144477735", "01234567890"])
    assert.equal(u.cpfValido(cpf), true, cpf);
  for (const cpf of [
    "",
    "123",
    "52998224724",
    "11111111111",
    "00000000000",
    "529982247251",
  ])
    assert.equal(u.cpfValido(cpf), false, cpf);
  assert.equal(u.formatarCpf("52998224725"), "529.982.247-25");
  assert.equal(u.mascararCpf("52998224725"), "***.982.247-**");
});

test("identificação exige nome e sobrenome; aceita acentos, apóstrofo e nome composto", async () => {
  const h = await ambiente();
  const { validarIdentificacao } = await h.importar("../utils/identificacao");
  const dados = { cpf: "529.982.247-25", papelSignatario: "diretor" };
  assert.equal(
    validarIdentificacao({ ...dados, nomeSignatario: "  João   D'Ávila  " })
      .nomeSignatario,
    "João D'Ávila",
  );
  for (const nomeSignatario of ["João", "  ", "João 123", ". ."])
    assert.throws(
      () => validarIdentificacao({ ...dados, nomeSignatario }),
      /sobrenome/,
    );
});

test("preparar identificação não lê nem grava no Storage ou no Firestore", async () => {
  const h = await ambiente();
  h.state.storageError = { code: "storage/bucket-not-found" };
  const api = (await h.importar("useAssinaturas")).useAssinaturas("escola-a");
  const pessoa = {
    nomeSignatario: "Nome Sobrenome",
    cpf: "529.982.247-25",
    papelSignatario: "diretor",
  };
  const preparada = await api.prepararIdentificacao(
    pessoa,
    {
      documentoTipo: "vistoria",
      documentoId: "v1",
      documentoDados: { tipo: "recebimento" },
    },
    "v1-responsavel",
  );
  assert.equal(preparada.payload.cpf, "52998224725");
  assert.equal(preparada.payload.metodo, "identificacao_cpf");
  assert.equal(preparada.payload.hashDocumento.length, 64);
  assert.equal(preparada.payload.imagemUrl, undefined);
  assert.equal(h.state.storageReads, 0);
  assert.equal(h.state.uploads, 0);
  assert.equal(h.state.commits, 0);
});

test("CPF inválido não produz identificação preparada", async () => {
  const h = await ambiente();
  const api = (await h.importar("useAssinaturas")).useAssinaturas("escola-a");
  await assert.rejects(
    api.prepararIdentificacao(
      {
        nomeSignatario: "Nome Sobrenome",
        cpf: "11111111111",
        papelSignatario: "diretor",
      },
      { documentoTipo: "vistoria", documentoId: "v1" },
    ),
    /CPF válido/,
  );
  assert.equal(h.state.commits, 0);
});

test("vistoria exige responsável e testemunha com CPFs diferentes em todos os tipos", async () => {
  const h = await ambiente();
  const api = (await h.importar("useVistorias")).useVistorias("escola-a");
  for (const tipo of ["recebimento", "sanitaria", "estrutural", "rotina"]) {
    await assert.rejects(
      api.registrarVistoria({
        ...vistoriaDados("v1"),
        tipo,
        assinaturas: parVistoria("v1").slice(0, 1),
      }),
      /testemunha/,
    );
    await assert.rejects(
      api.registrarVistoria({
        ...vistoriaDados("v1", parVistoria("v1", { cpf: "52998224725" })),
        tipo,
      }),
      /CPFs diferentes/,
    );
  }
  assert.equal(h.state.commits, 0);
});

test("vistorias e movimentações rejeitam identificação de outra escola, operação ou conta", async () => {
  const h = await ambiente();
  const v = (await h.importar("useVistorias")).useVistorias("escola-a");
  const e = (await h.importar("useEstoque")).useEstoque("escola-a");
  for (const alterar of [
    (a) => {
      a.referencia.path = "escolas/outra/assinaturas/" + a.id;
    },
    (a) => {
      a.payload.documentoId = "outro";
    },
    (a) => {
      a.payload.criadoPor = "outra-conta";
    },
    (a) => {
      a.payload.cpf = "00000000000";
    },
  ]) {
    const par = parVistoria("v1");
    alterar(par[0]);
    await assert.rejects(v.registrarVistoria(vistoriaDados("v1", par)));
    const mov = movimento();
    alterar(mov.assinatura);
    await assert.rejects(e.registrarMovimentacao(mov));
  }
  assert.equal(h.state.commits, 0);
});

test("vistoria salva identificações e auditoria atomicamente; CPF completo não vaza no resumo", async () => {
  const h = await ambiente();
  h.state.storageError = { code: "storage/bucket-not-found" };
  const api = (await h.importar("useVistorias")).useVistorias("escola-a");
  const par = parVistoria("v1");
  await api.registrarVistoria(vistoriaDados("v1", par));
  const registro = h.state.records.get("escolas/escola-a/vistorias/v1");
  assert.equal(registro.assinaturaResponsavelId, par[0].id);
  assert.equal(registro.assinaturaTestemunhaId, par[1].id);
  assert.equal(
    registro.identificacaoResponsavel.cpfMascarado,
    "***.982.247-**",
  );
  assert.equal(h.state.records.get(par[0].referencia.path).cpf, "52998224725");
  const publico = JSON.stringify(
    [...h.state.records].filter(([k]) => !k.includes("/assinaturas/")),
  );
  assert.equal(publico.includes("52998224725"), false);
  assert.equal(publico.includes("11144477735"), false);
  assert.equal(h.state.storageReads, 0);
  assert.equal(h.state.uploads, 0);
});

test("falha de transação não deixa CPF ou vistoria parcialmente gravados", async () => {
  const h = await ambiente();
  const api = (await h.importar("useVistorias")).useVistorias("escola-a");
  h.state.failNext = "transaction";
  await assert.rejects(api.registrarVistoria(vistoriaDados("v1")));
  assert.equal(h.state.records.has("escolas/escola-a/vistorias/v1"), false);
  assert.equal(
    [...h.state.records.keys()].some((k) => k.includes("/assinaturas/")),
    false,
  );
  await api.registrarVistoria(vistoriaDados("v1"));
  assert.equal(h.state.records.has("escolas/escola-a/vistorias/v1"), true);
});

test("vistoria reenviada após perda de resposta não duplica documento ou auditoria", async () => {
  const h = await ambiente();
  const api = (await h.importar("useVistorias")).useVistorias("escola-a");
  h.state.failNext = "lost-response";
  await assert.rejects(
    api.registrarVistoria(vistoriaDados("v1")),
    /Resposta perdida/,
  );
  await api.registrarVistoria(vistoriaDados("v1"));
  assert.equal(
    [...h.state.records.keys()].filter((k) => k.includes("/vistorias/")).length,
    1,
  );
  assert.equal(
    [...h.state.records.keys()].filter((k) =>
      k.startsWith("auditoriaRegistros/"),
    ).length,
    1,
  );
});

test("checklist incompleto é bloqueado e avaliação toda N/A não recebe nota 10", async () => {
  const h = await ambiente();
  const api = (await h.importar("useVistorias")).useVistorias("escola-a");
  await assert.rejects(
    api.registrarVistoria({
      ...vistoriaDados("v1"),
      checklist: [{ item: "Pendente", status: null }],
    }),
    /Preencha/,
  );
  assert.equal(
    api.calcularNota([{ item: "Item", status: "nao_aplicavel" }]),
    null,
  );
  assert.equal(
    api.calcularStatus([{ item: "Item", status: "nao_aplicavel" }]),
    "nao_aplicavel",
  );
  await api.registrarVistoria({
    ...vistoriaDados("v1"),
    checklist: [{ item: "Item", status: "nao_aplicavel" }],
  });
  assert.equal(
    h.state.records.get("escolas/escola-a/vistorias/v1").notaGeral,
    null,
  );
});

test("prazo de vistoria e movimentação libera espera e bloqueia gravação tardia", async () => {
  for (const nome of ["useVistorias", "useEstoque"]) {
    const h = await ambiente();
    const vencer = capturarPrazo(h);
    h.state.stallTransaction = true;
    const mod = await h.importar(nome);
    const api =
      nome === "useVistorias"
        ? mod.useVistorias("escola-a")
        : mod.useEstoque("escola-a");
    const envio =
      nome === "useVistorias"
        ? api.registrarVistoria(vistoriaDados("v1"))
        : api.registrarMovimentacao(movimento());
    const rejeicao = assert.rejects(envio, /timeout/);
    await microtarefas();
    vencer();
    await rejeicao;
    h.state.resumeTransaction();
    await microtarefas();
    assert.equal(h.state.commits, 0);
  }
});

test("movimentação rejeita motivo vazio e quantidade abaixo da precisão do estoque", async () => {
  const h = await ambiente();
  const api = (await h.importar("useEstoque")).useEstoque("escola-a");
  await assert.rejects(
    api.registrarMovimentacao(movimento("m1", { motivo: " " })),
    /motivo/,
  );
  await assert.rejects(
    api.registrarMovimentacao(movimento("m2", { quantidade: 0.00000001 })),
    /quantidade/,
  );
  await assert.rejects(
    api.registrarMovimentacao(movimento("m3", { quantidade: 0.1234567 })),
    /seis casas/,
  );
  assert.equal(h.state.commits, 0);
});

test("backup local inclui identificações sem nenhuma dependência do Storage", async () => {
  const h = await ambiente();
  h.state.storageError = { code: "storage/bucket-not-found" };
  const vistoria = (await h.importar("useVistorias")).useVistorias("escola-a");
  await vistoria.registrarVistoria(vistoriaDados("v1"));
  const api = (await h.importar("useBackup")).useBackup();
  const backup = await api.gerarBackup(["escola-a", "escola-b", "escola-a"]);
  const json = JSON.parse(backup.json);
  assert.equal(json.versaoEsquema, 2);
  assert.deepEqual(Object.keys(json.escolas), ["escola-a", "escola-b"]);
  assert.equal(json.escolas["escola-a"].dados.assinaturas.length, 2);
  assert.equal(backup.totalDocumentos, 8);
  assert.equal(api.gerando.value, false);
  assert.equal(h.state.storageReads, 0);
  assert.equal(h.state.uploads, 0);
});

test("backup recusa professor, seleção vazia e escola inexistente", async () => {
  const h = await ambiente();
  const api = (await h.importar("useBackup")).useBackup();
  await assert.rejects(api.gerarBackup([]), /Selecione/);
  await assert.rejects(api.gerarBackup(["ausente"]), /não foi encontrada/);
  const prof = await ambiente("professor");
  const proibido = (await prof.importar("useBackup")).useBackup();
  await assert.rejects(proibido.gerarBackup(["escola-a"]), /gestão/);
});

test("falha e prazo da leitura do backup não deixam a interface ocupada", async () => {
  const h = await ambiente();
  const api = (await h.importar("useBackup")).useBackup();
  h.state.readError = { code: "permission-denied" };
  await assert.rejects(api.gerarBackup(["escola-a"]));
  assert.equal(api.gerando.value, false);
  assert.match(api.erro.value, /permission-denied/);
  h.state.readError = null;
  h.state.stallRead = true;
  const vencer = capturarPrazo(h);
  const pendente = api.gerarBackup(["escola-a"]);
  const rejeicao = assert.rejects(pendente, /backup\/timeout/);
  await microtarefas();
  vencer();
  await rejeicao;
  h.state.resumeRead();
  await microtarefas();
  assert.equal(api.gerando.value, false);
  assert.equal(api.progresso.value, 0);
});

test("históricos ignoram eventos antigos após encerrar a escuta", async () => {
  const h = await ambiente();
  for (const nome of ["useVistorias", "useMovimentacoes"]) {
    const mod = await h.importar(nome);
    const api = mod[nome]("escola-a");
    api.escutar();
    await microtarefas();
    const antiga = [...h.state.listeners].find((l) => !l.q.id);
    api.parar();
    antiga.callback({
      docs: [{ id: "antigo", data: () => ({ tipo: "rotina" }) }],
    });
    assert.equal((api.vistorias || api.movimentacoes).value.length, 0);
    assert.equal(api.carregando.value, false);
  }
});

test("Master assume gestão e Alimentador não ganha acesso operacional à merenda", async () => {
  const master = await ambiente("master");
  assert.equal(master.auth.useAuth().ehGestao.value, true);
  assert.equal(master.auth.useAuth().pode("usuarios"), true);
  const alimentador = await ambiente("alimentador");
  assert.equal(alimentador.auth.useAuth().pode("conteudo"), true);
  assert.equal(alimentador.auth.useAuth().pode("usuarios"), false);
  assert.equal(alimentador.auth.useAuth().ehGestao.value, false);
});

test("suspensão do perfil em tempo real remove o acesso antes de uma nova operação", async () => {
  const h = await ambiente("master");
  const perfil = [...h.state.listeners].find(
    (l) => l.q.path === "usuarios/qa-user",
  );
  perfil.callback({
    exists: () => true,
    data: () => ({ ...h.state.records.get("usuarios/qa-user"), ativo: false }),
  });
  assert.equal(h.auth.useAuth().usuario.value, null);
  assert.throws(() => h.auth.useAuth().exigirUsuario(), /Entre na sua conta/);
});
