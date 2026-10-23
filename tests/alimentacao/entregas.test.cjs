const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  executarEntrega,
  quantidade,
  saldo,
} = require("../../server/alimentacao/entregas.cjs");
const {
  criarHandler,
  arquivo,
} = require("../../server/alimentacao/handler.cjs");
const sharp = require("sharp");
// Simulador transacional: leituras antes de escritas, commit atômico e rollback.
// Testes complementares com o emulador exercitam a concorrência real do Firestore.
class Banco {
  constructor() {
    this.dados = new Map();
    this.fila = Promise.resolve();
    this.falhar = false;
  }
  doc(path) {
    return {
      path,
      id: path.split("/").at(-1),
      parent: { id: path.split("/").at(-2) },
      get: async () => this.snap(path),
    };
  }
  snap(path) {
    return {
      exists: this.dados.has(path),
      ref: this.doc(path),
      id: path.split("/").at(-1),
      data: () => this.dados.get(path),
    };
  }
  async runTransaction(fn) {
    const rodar = async () => {
      let escrevendo = false;
      const escritas = [];
      const tx = {
        get: async (ref) => {
          assert.equal(escrevendo, false, "não ler após escrever");
          return this.snap(ref.path);
        },
        set: (r, d) => {
          escrevendo = true;
          escritas.push([r.path, d]);
        },
        create: (r, d) => {
          assert.ok(!this.dados.has(r.path));
          escrevendo = true;
          escritas.push([r.path, d]);
        },
      };
      const result = await fn(tx);
      if (this.falhar) throw new Error("Falha de commit simulada");
      for (const [p, d] of escritas) this.dados.set(p, d);
      return result;
    };
    const result = this.fila.then(rodar);
    this.fila = result.catch(() => {});
    return result;
  }
}
function contexto() {
  const db = new Banco(),
    token = { uid: "gestor", auth_time: Date.now() / 1000 },
    perfil = { papel: "gerente", nome: "Gestor Municipal", ativo: true };
  db.dados.set("usuarios/gestor", perfil);
  db.dados.set("usuarios/diretor", {
    papel: "diretor",
    nome: "Diretor Escolar",
    escolasVinculadas: ["escola-a"],
    ativo: true,
  });
  db.dados.set("escolas/deposito-municipal", {
    nome: "Depósito",
    ativo: true,
    tipoUnidade: "deposito",
  });
  db.dados.set("escolas/escola-a", { nome: "Escola A", ativo: true });
  db.dados.set("escolas/escola-b", { nome: "Escola B", ativo: true });
  db.dados.set("escolas/deposito-municipal/estoque/arroz", {
    nome: "Arroz",
    unidade: "kg",
    ativo: true,
    quantidadeAtual: 100,
  });
  const b = {
    acao: "enviarEntrega",
    id: randomUUID(),
    escolaId: "escola-a",
    itens: [{ itemId: "arroz", quantidade: 20 }],
    fotos: [],
    responsavel: { nome: "Responsavel Teste", cpf: "52998224725" },
    observacao: "",
  };
  return { db, token, perfil, b };
}
const executar = (c) => executarEntrega(c);
const recebimento = (c) => ({
  ...c,
  token: { ...c.token, uid: "diretor" },
  b: {
    ...c.b,
    acao: "receberEntrega",
    itens: [
      {
        itemId: "arroz",
        quantidadeRecebida: 18,
        motivo: "quantidade diferente",
      },
    ],
  },
});
test("envio e repetição baixam uma só vez; recebimento parcial entra uma só vez", async () => {
  const c = contexto();
  await executar(c);
  await executar(c);
  assert.equal(
    c.db.dados.get("escolas/deposito-municipal/estoque/arroz").quantidadeAtual,
    80,
  );
  const r = recebimento(c);
  await executar(r);
  await executar(r);
  assert.equal(
    c.db.dados.get("escolas/escola-a/estoque/transf-arroz").quantidadeAtual,
    18,
  );
  assert.equal(
    c.db.dados.get("escolas/deposito-municipal/estoque/arroz").quantidadeAtual,
    80,
  );
  const d = c.db.dados.get(`escolas/escola-a/entregas/${c.b.id}`);
  assert.equal(d.status, "recebido");
  assert.equal(d.divergencia.status, "aberta");
  assert.ok(
    [...c.db.dados.keys()].some((k) => k.startsWith("auditoriaRegistros/")),
  );
  assert.ok(!JSON.stringify(d).includes("52998224725"));
});
test("duas retiradas de 80 sobre saldo 100: somente uma confirma", async () => {
  const c = contexto();
  c.b.itens[0].quantidade = 80;
  const resultados = await Promise.allSettled([
    executar(c),
    executar({ ...c, b: { ...c.b, id: randomUUID() } }),
  ]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    c.db.dados.get("escolas/deposito-municipal/estoque/arroz").quantidadeAtual,
    20,
  );
});
test("cancelamento estorna uma vez e impede recebimento posterior", async () => {
  const c = contexto();
  await executar(c);
  const cancelar = {
    ...c,
    b: { ...c.b, acao: "cancelarEntrega", motivo: "Veículo indisponível" },
  };
  await executar(cancelar);
  await executar(cancelar);
  assert.equal(
    c.db.dados.get("escolas/deposito-municipal/estoque/arroz").quantidadeAtual,
    100,
  );
  await assert.rejects(executar(recebimento(c)), /não aguarda/);
});
test("falha de commit não deixa baixa nem entrega parcial", async () => {
  const c = contexto();
  c.db.falhar = true;
  await assert.rejects(executar(c));
  assert.equal(
    c.db.dados.get("escolas/deposito-municipal/estoque/arroz").quantidadeAtual,
    100,
  );
  assert.ok(!c.db.dados.has(`escolas/escola-a/entregas/${c.b.id}`));
});
test("diretor não envia e não recebe em escola alheia", async () => {
  const c = contexto(),
    token = { ...c.token, uid: "diretor" };
  await assert.rejects(executar({ ...c, token }), /Somente a gestão/);
  await assert.rejects(
    executar({ ...c, token, b: { ...c.b, escolaId: "escola-b" } }),
    /não tem acesso/,
  );
});
test("valida dados, CPF, estoque, anexos e idempotência com payload diferente", async () => {
  for (const alterar of [
    (b) => (b.itens = []),
    (b) => (b.itens[0].quantidade = 101),
    (b) => (b.responsavel.cpf = "11111111111"),
    (b) => (b.fotos = [randomUUID()]),
    (b) => b.itens.push({ ...b.itens[0] }),
  ]) {
    const c = contexto();
    alterar(c.b);
    await assert.rejects(executar(c));
    assert.equal(
      c.db.dados.get("escolas/deposito-municipal/estoque/arroz")
        .quantidadeAtual,
      100,
    );
  }
  const c = contexto();
  await executar(c);
  c.b.itens[0].quantidade = 21;
  await assert.rejects(executar(c), /outros dados/);
  for (const n of [NaN, Infinity, -1, "2", null, 0.0000001])
    assert.throws(() => quantidade(n));
  assert.equal(saldo(0.3, -0.1), 0.2);
  assert.throws(() => saldo(1, -2));
});
test("recebimento rejeita aumento, divergência sem motivo e unidade incompatível", async () => {
  const c = contexto();
  await executar(c);
  const r = recebimento(c);
  r.b.itens[0].quantidadeRecebida = 21;
  await assert.rejects(executar(r));
  r.b.itens[0].quantidadeRecebida = 18;
  r.b.itens[0].motivo = "";
  await assert.rejects(executar(r));
  r.b.itens[0].motivo = "quantidade diferente";
  c.db.dados.set("escolas/escola-a/estoque/transf-arroz", {
    nome: "Arroz",
    unidade: "un",
    quantidadeAtual: 0,
  });
  await assert.rejects(executar(r), /mesmo nome/);
});
async function requisicao(c, body, b2, headers = {}) {
  const handler = criarHandler({
    db: c.db,
    auth: { verifyIdToken: async () => c.token },
    b2,
    origens: ["https://escola.test"],
    clienteId: "teste",
  });
  const res = {
    statusCode: 200,
    setHeader() {},
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(d) {
      this.body = d;
      return this;
    },
    send(d) {
      this.body = d;
      return this;
    },
  };
  await handler(
    {
      method: "POST",
      headers: {
        origin: "https://escola.test",
        "content-type": "application/json",
        authorization: "Bearer token-de-teste",
        ...headers,
      },
      body,
    },
    res,
  );
  return res;
}
test("upload verifica conteúdo WEBP e rejeita MIME falso / arquivo grande", async () => {
  const bytes = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#fff" },
  })
    .webp()
    .toBuffer();
  const f = {
    base64: bytes.toString("base64"),
    nome: "foto.webp",
    mime: "image/webp",
  };
  assert.equal((await arquivo(f)).mime, "image/webp");
  await assert.rejects(arquivo({ ...f, mime: "image/png" }));
  await assert.rejects(
    arquivo({ ...f, base64: Buffer.alloc(2100000).toString("base64") }),
  );
});
test("API bloqueia usuário sem token e origem não permitida", async () => {
  const c = contexto();
  assert.equal(
    (await requisicao(c, {}, null, { authorization: "" })).statusCode,
    401,
  );
  assert.equal(
    (await requisicao(c, {}, null, { origin: "https://intruso.test" }))
      .statusCode,
    403,
  );
});
test("falha no B2 preserva documento recuperável e não movimenta estoque", async () => {
  const c = contexto(),
    id = randomUUID();
  const bytes = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const b = {
    acao: "enviar",
    escolaId: "escola-a",
    id,
    nome: "foto.png",
    mime: "image/png",
    base64: bytes.toString("base64"),
    titulo: "Comprovante",
    revisado: true,
  };
  assert.equal(
    (
      await requisicao(c, b, {
        put: async () => {
          throw new Error("offline");
        },
      })
    ).statusCode,
    502,
  );
  assert.equal(
    c.db.dados.get(`escolas/escola-a/documentos/${id}`).estado,
    "falhou",
  );
  assert.equal(
    (await requisicao(c, b, { put: async () => "versao-1" })).statusCode,
    200,
  );
  assert.equal(
    c.db.dados.get(`escolas/escola-a/documentos/${id}`).estado,
    "pronto",
  );
  assert.equal(
    c.db.dados.get("escolas/deposito-municipal/estoque/arroz").quantidadeAtual,
    100,
  );
});

test("B2 concluído e commit final falha: registro permite repetição segura", async () => {
  const c = contexto(),
    id = randomUUID();
  const bytes = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const b = {
    acao: "enviar",
    escolaId: "escola-a",
    id,
    nome: "foto.png",
    mime: "image/png",
    base64: bytes.toString("base64"),
    titulo: "Comprovante",
    revisado: true,
  };
  const original = c.db.runTransaction.bind(c.db);
  let falharProxima = false,
    puts = 0;
  c.db.runTransaction = async (fn) => {
    if (falharProxima) {
      falharProxima = false;
      throw new Error("Firestore temporariamente indisponível");
    }
    return original(fn);
  };
  const b2 = {
    put: async () => {
      puts++;
      if (puts === 1) falharProxima = true;
      return "versao-" + puts;
    },
  };
  assert.equal((await requisicao(c, b, b2)).statusCode, 502);
  assert.equal(
    c.db.dados.get(`escolas/escola-a/documentos/${id}`).estado,
    "falhou",
  );
  assert.equal((await requisicao(c, b, b2)).statusCode, 200);
  assert.equal(
    c.db.dados.get(`escolas/escola-a/documentos/${id}`).versionId,
    "versao-2",
  );
});
test("comprovante oficial não pode ser arquivado; conta revogada não opera", async () => {
  const c = contexto(),
    id = randomUUID();
  c.db.dados.set(`escolas/escola-a/documentos/${id}`, {
    estado: "pronto",
    criadoPor: "gestor",
    vinculo: { tipo: "entregas", id: randomUUID() },
  });
  assert.equal(
    (
      await requisicao(
        c,
        { acao: "arquivar", escolaId: "escola-a", id },
        { check: async () => {} },
      )
    ).statusCode,
    409,
  );
  c.token.auth_time = Date.now() / 1000 - 9 * 3600;
  assert.equal(
    (await requisicao(c, { acao: "status", escolaId: "escola-a" }, {}))
      .statusCode,
    401,
  );
});
