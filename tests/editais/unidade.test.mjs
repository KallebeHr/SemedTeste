import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  configuracao,
  campos,
  validarFicha,
  abertura,
  DECLARACAO,
} from "../../shared/editais.mjs";
const require = createRequire(import.meta.url),
  { validarArquivo } = require("../../server/editais/arquivos.cjs"),
  { PDFDocument, PDFName, PDFString } = require("pdf-lib");
const config = configuracao({
  ativo: true,
  validado: true,
  privacidade: "Aviso institucional de teste",
  categorias: ["Oficial"],
  obrigatorios: ["relato"],
});
const dados = () => ({
  ...Object.fromEntries(campos(config).map((f) => [f.id, "Texto de teste"])),
  telefone: "(86) 99999-1234",
  email: "teste@example.com",
  categoria: "Oficial",
  coautores: "",
  aceite: true,
});
test("campos e declaração oficial, regras configuradas e horários", () => {
  assert.equal(campos(config).length, 14);
  assert.match(DECLARACAO, /proteção da imagem e dos dados das crianças/);
  assert.throws(() => configuracao({ ativo: true }));
  assert.throws(() => configuracao({ maxMB: 3 }));
  assert.equal(
    abertura(
      { ...config, fim: "2026-01-01T00:00:00Z" },
      Date.parse("2026-01-01T00:00:00Z"),
    ),
    "Inscrições encerradas.",
  );
  assert.equal(
    abertura(
      { ...config, inicio: "2026-01-01T00:00:00Z" },
      Date.parse("2026-01-01T00:00:00Z"),
    ),
    "",
  );
});
test("valida obrigatórios, categoria, contato, anexos e aceite sem truncar dados", () => {
  assert.throws(() => validarFicha(dados(), config, []));
  const anexos = [{ tipo: "relato", estado: "pronto" }];
  assert.equal(
    validarFicha(dados(), config, anexos).responsavel,
    "Texto de teste",
  );
  for (const patch of [
    { aceite: false },
    { email: "invalido" },
    { categoria: "Inventada" },
    { diagnostico: "x".repeat(20001) },
    { telefone: "1" },
  ])
    assert.throws(() => validarFicha({ ...dados(), ...patch }, config, anexos));
});
test("modelo personalizado não herda campos específicos do seminário", () => {
  const c = configuracao({
    modelo: "personalizado",
    camposExtras: ["Proposta"],
  });
  assert.equal(campos(c).length, 3);
  assert.equal(campos(c)[2].label, "Proposta");
});
test("PDF conserva bytes e rejeita conteúdo ativo, arquivo falso e MIME inválido", async () => {
  const p = await PDFDocument.create();
  p.addPage();
  const bytes = Buffer.from(await p.save());
  const r = await validarArquivo({
    base64: bytes.toString("base64"),
    mime: "application/pdf",
    nome: "oficial.pdf",
  });
  assert.deepEqual(r.bytes, bytes);
  await assert.rejects(
    validarArquivo({
      base64: Buffer.from("not pdf").toString("base64"),
      mime: "application/pdf",
    }),
  );
  await assert.rejects(
    validarArquivo({ base64: bytes.toString("base64"), mime: "text/html" }),
  );
  p.catalog.set(
    PDFName.of("OpenAction"),
    p.context.obj({
      S: PDFName.of("JavaScript"),
      JS: PDFString.of("alert(1)"),
    }),
  );
  await assert.rejects(
    validarArquivo({
      base64: Buffer.from(await p.save()).toString("base64"),
      mime: "application/pdf",
    }),
  );
});
