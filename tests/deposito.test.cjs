const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const util = import(
  "data:text/javascript;base64," +
    fs
      .readFileSync(
        require("node:path").join(__dirname, "../src/utils/estoque.js"),
      )
      .toString("base64")
);
test("precisão, limites e entradas inválidas", async () => {
  const { quantidadeValida, saldoApos } = await util;
  for (const n of ["", null, undefined, NaN, Infinity, -1, 1e9 + 1, 0.0000001])
    assert.throws(() => quantidadeValida(n));
  assert.equal(saldoApos(0.3, "saida", 0.1), 0.2);
  assert.equal(saldoApos(10, "perda", 10), 0);
  assert.throws(() => saldoApos(2, "saida", 3));
  assert.throws(() => saldoApos(1e9, "entrada", 1));
});
test("contagem registra diferença, inclusive zerar e aumentar", async () => {
  const { ajusteConferencia } = await util;
  assert.deepEqual(ajusteConferencia(10, 8), {
    tipo: "saida",
    quantidade: 2,
    quantidadeAnteriorConfirmada: 10,
    quantidadeContada: 8,
  });
  assert.equal(ajusteConferencia(10, 0).quantidade, 10);
  assert.equal(ajusteConferencia(10, 12).tipo, "entrada");
  assert.throws(() => ajusteConferencia(10, 10));
});
test("resumo exclui arquivados e não mistura unidades; validade inclusiva", async () => {
  const { resumoEstoque, estadoItem } = await util;
  const r = resumoEstoque([
    { ativo: true, quantidadeAtual: 2, quantidadeMinima: 3, precoUnitario: 5 },
    { ativo: false, quantidadeAtual: 0 },
    { ativo: true, quantidadeAtual: 0, quantidadeMinima: 1 },
  ]);
  assert.equal(r.ativos, 2);
  assert.equal(r.baixos, 2);
  assert.equal(r.zerados, 1);
  assert.equal(r.valor, 10);
  assert.equal(
    estadoItem(
      { quantidadeAtual: 1, validade: new Date("2026-09-16T12:00:00") },
      15,
      new Date("2026-09-16T22:00:00"),
    ).id,
    "vencendo",
  );
  assert.equal(
    estadoItem(
      { quantidadeAtual: 1, validade: new Date("2026-09-15T12:00:00") },
      15,
      new Date("2026-09-16T22:00:00"),
    ).id,
    "vencido",
  );
});
