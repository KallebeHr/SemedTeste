import { test } from "node:test";
import assert from "node:assert/strict";
import {
  idsEscolas,
  conflitosCardapio,
  filtrarCardapios,
  conferirExemplo,
} from "../../shared/cardapios.mjs";
test("IDs antigos, múltiplos vínculos e separação por mês, etapa e turno", () => {
  const a = {
    id: "a",
    tipo: "cardapio",
    escolaId: "legado",
    numero: "2026-10",
    etapa: "Educação Infantil",
    turno: "Parcial",
  };
  assert.deepEqual(idsEscolas(a), ["legado"]);
  assert.deepEqual(idsEscolas({ ...a, escolaIds: ["e1", "e1", "e2"] }), [
    "e1",
    "e2",
  ]);
  assert.equal(filtrarCardapios([a], "legado", "2026-10").length, 1);
  assert.equal(filtrarCardapios([a], "outra", "2026-10").length, 0);
  assert.equal(filtrarCardapios([a], "legado", "2026-11").length, 0);
  assert.equal(conflitosCardapio({ ...a, id: "b" }, [a]).length, 1);
  assert.equal(
    conflitosCardapio({ ...a, id: "b", turno: "Integral" }, [a]).length,
    0,
  );
  assert.equal(
    conflitosCardapio({ ...a, id: "b", etapa: "Ensino Fundamental" }, [a])
      .length,
    0,
  );
});
test("exemplo exige correspondência única exata com cadastro, nunca corrige nomes", () => {
  const escolas = [
    { id: "real-1", nome: "E. M. Vovó Inácia" },
    {
      id: "real-2",
      nome: "E. de E. Infantil Maria de Lurdes Viana dos Santos",
    },
  ];
  assert.deepEqual(
    conferirExemplo(escolas).map((x) => x.registros[0].id),
    ["real-1", "real-2"],
  );
  assert.equal(
    conferirExemplo([{ nome: "Maria de Lourdes Viana" }])[1].registros.length,
    0,
  );
});
