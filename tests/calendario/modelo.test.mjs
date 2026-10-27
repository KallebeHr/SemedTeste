import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validarCalendario,
  novoCalendario,
  atualizarVinculos,
} from "../../shared/calendario.mjs";
const base = () =>
  JSON.parse(
    fs.readFileSync(
      new URL("../../src/data/calendario2026.json", import.meta.url),
    ),
  );
test("importa 365 dias, 45 eventos e totais oficiais sem inferir dias letivos", () => {
  const c = validarCalendario(base());
  assert.equal(c.dias.length, 365);
  assert.equal(c.eventos.length, 45);
  assert.equal(c.totalDiasLetivos, 202);
  assert.equal(c.dias[0].eventoIds.length, 2);
  assert.deepEqual(c.diasLetivosPorMes, base().diasLetivosPorMes);
});
test("rejeita dias ausentes, repetidos, datas inválidas, duplicação e referências soltas", () => {
  for (const alterar of [
    (c) => c.dias.pop(),
    (c) => (c.dias[1] = c.dias[0]),
    (c) => (c.eventos[0].dataFim = "2026-02-30"),
    (c) => c.eventos.push({ ...c.eventos[0], id: "outro-id" }),
    (c) => c.dias[0].eventoIds.push("inexistente"),
    (c) => (c.categorias.feriado.cor = "url(https://example.com)"),
  ]) {
    const c = base();
    alterar(c);
    assert.throws(() => validarCalendario(c));
  }
});
test("ano bissexto tem 366 dias; edição de intervalo atualiza todas as referências", () => {
  assert.equal(validarCalendario(novoCalendario(2028)).dias.length, 366);
  const c = base();
  c.eventos[0].dataFim = "2026-01-03";
  const r = validarCalendario(atualizarVinculos(c));
  assert.equal(r.dias[3].eventoIds.includes(c.eventos[0].id), false);
});
