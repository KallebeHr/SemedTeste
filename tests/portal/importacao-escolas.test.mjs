import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lerCSV,
  prepararLinhas,
  mapearCabecalhos,
  validarEscola,
  CAMPOS_ESCOLA,
} from "../../shared/importacao-escolas.mjs";
test("CSV preserva aspas, delimitadores, BOM e linhas no texto", () => {
  const rows = lerCSV(
    '\uFEFFnome;sobre;inep\r\n"Escola; A";"linha 1\nlinha ""2""";00123456\r\n',
  );
  assert.equal(rows[1][0], "Escola; A");
  assert.equal(rows[1][1], 'linha 1\nlinha "2"');
  assert.equal(rows[1][2], "00123456");
  assert.throws(() => lerCSV('nome\n"sem fim'));
});
test("modelo gerado é associado e números inválidos são rejeitados", () => {
  const headers = Object.values(CAMPOS_ESCOLA).map((c) => c[0]);
  assert(Object.values(mapearCabecalhos(headers)).every((i) => i >= 0));
  for (const n of [-1, 1.5, "dez", 100001])
    assert.throws(() => validarEscola({ nome: "Escola A", alunos: n }));
  assert.equal(validarEscola({ nome: "Escola A", alunos: "0" }).alunos, 0);
  assert.equal(validarEscola({ nome: "Escola A" }).alunos, null);
  assert.throws(() => validarEscola({ nome: "Escola A", inep: "123" }));
});
test("detecta duplicados, conflitos e preserva ausência de colunas", () => {
  const m = { nome: 0, inep: 1 };
  const p = prepararLinhas(
    [
      ["Escola Á", "12345678"],
      ["Escola A", "12345678"],
    ],
    m,
    [{ id: "x", nome: "Escola Á", inep: "12345678" }],
  );
  assert.equal(p[0].existente.id, "x");
  assert(!("alunos" in p[0].dados));
  assert(p[1].erro);
  assert(
    prepararLinhas([["Escola A", "12345678"]], m, [
      { nome: "Escola A", inep: "87654321" },
    ])[0].erro,
  );
  assert.throws(() => prepararLinhas(Array(501).fill(["Escola"]), { nome: 0 }));
});
