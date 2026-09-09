const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  carregarCliente,
  validarImplantacao,
  raiz,
} = require("../../scripts/cliente.cjs");
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "seduc-clientes-"));
const cliente = {
  id: "cliente-a",
  nome: "Secretaria A",
  municipio: "Cidade A",
  firebase: {
    projectId: "projeto-a",
    apiKey: "chave-publica-ficticia",
    appId: "app-ficticio",
    authDomain: "projeto-a.firebaseapp.com",
  },
};
const gravar = (c) =>
  fs.writeFileSync(path.join(pasta, c.id + ".json"), JSON.stringify(c));
after(() => fs.rmSync(pasta, { recursive: true, force: true }));
test("cada cliente exige configuração explícita e projeto exclusivo", () => {
  gravar(cliente);
  assert.equal(
    carregarCliente("cliente-a", pasta).firebase.projectId,
    "projeto-a",
  );
  gravar({ ...cliente, id: "cliente-b" });
  assert.throws(() => carregarCliente("cliente-a", pasta), /compartilhar/);
  gravar({
    ...cliente,
    id: "cliente-b",
    firebase: {
      ...cliente.firebase,
      projectId: "projeto-b",
      authDomain: "projeto-b.firebaseapp.com",
    },
  });
  assert.equal(
    carregarCliente("cliente-b", pasta).firebase.projectId,
    "projeto-b",
  );
  assert.throws(() => carregarCliente("../cliente-a", pasta), /inválido/);
});
test("publicação rejeita build ou confirmação de outra instituição", () => {
  assert.throws(
    () =>
      validarImplantacao(
        cliente,
        { cliente: "cliente-b", projectId: "projeto-b" },
        "projeto-a",
      ),
    /outro cliente/,
  );
  assert.throws(
    () =>
      validarImplantacao(
        cliente,
        { cliente: "cliente-a", projectId: "projeto-a" },
        "projeto-b",
      ),
    /Confirme/,
  );
  assert.doesNotThrow(() =>
    validarImplantacao(
      cliente,
      { cliente: "cliente-a", projectId: "projeto-a" },
      "projeto-a",
    ),
  );
});
test("build sem seleção de cliente falha antes de gerar artefatos", () => {
  const r = spawnSync(process.execPath, ["scripts/build.cjs"], {
    cwd: raiz,
    encoding: "utf8",
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /cliente inválido/);
});
