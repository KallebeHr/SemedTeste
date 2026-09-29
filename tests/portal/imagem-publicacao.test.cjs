const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const {
  criarHandlerImagem,
  autorizarEditor,
  tratarImagem,
} = require("../../server/publicacoes/imagem.cjs");
const token = { uid: "editor", auth_time: Date.now() / 1000 };
test("papéis, expiração e revogação protegem upload", () => {
  autorizarEditor(token, { papel: "alimentador" }, "noticia");
  assert.throws(() => autorizarEditor(token, { papel: "diretor" }, "noticia"));
  assert.throws(() =>
    autorizarEditor(token, { papel: "nutricionista" }, "noticia"),
  );
  assert.throws(() =>
    autorizarEditor({ ...token, auth_time: 1 }, { papel: "master" }, "noticia"),
  );
  assert.throws(() =>
    autorizarEditor(
      token,
      { papel: "master", sessaoRevogadaEm: Date.now() / 1000 + 1 },
      "noticia",
    ),
  );
});
test("valida conteúdo e converte imagens em JPEG", async () => {
  await assert.rejects(
    tratarImagem({
      mime: "image/jpeg",
      base64: Buffer.from("<svg/>").toString("base64"),
    }),
  );
  await assert.rejects(tratarImagem({ mime: "image/svg+xml", base64: "AAAA" }));
  const png = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "#004488" },
  })
    .png()
    .toBuffer();
  const out = await tratarImagem({
    mime: "image/png",
    base64: png.toString("base64"),
  });
  assert.equal((await sharp(out).metadata()).format, "jpeg");
});
test("GET público bloqueia rascunho e retirada, libera apenas imagem vinculada", async () => {
  const id = "11111111-1111-4111-8111-111111111111",
    origin = "https://www.semedpii.com.br";
  let publicada = false,
    gets = 0;
  const db = {
    doc: (path) => ({
      get: async () => ({
        data: () =>
          path.startsWith("midias")
            ? {
                estado: "pronto",
                conteudoId: "post",
                key: "safe",
                version: "1",
              }
            : publicada
              ? { imagemUrl: origin + "/api/publicacoes/imagem?id=" + id }
              : undefined,
      }),
    }),
  };
  const handler = criarHandlerImagem({
    db,
    auth: {},
    b2: {
      get: async () => {
        gets++;
        return Buffer.from("image");
      },
    },
    origens: [origin],
    clienteId: "pedro-ii",
  });
  const call = async () => {
    const r = {
      setHeader() {},
      status(n) {
        this.code = n;
        return this;
      },
      json(d) {
        this.body = d;
      },
      send(d) {
        this.body = d;
      },
    };
    await handler({ method: "GET", query: { id } }, r);
    return r;
  };
  assert.equal((await call()).code, 404);
  assert.equal(gets, 0);
  publicada = true;
  assert.equal((await call()).code, 200);
  assert.equal(gets, 1);
  publicada = false;
  assert.equal((await call()).code, 404);
  assert.equal(gets, 1);
});
