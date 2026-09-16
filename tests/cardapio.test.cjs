const { test, before } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
let m;
before(
  async () =>
    (m = await import(
      "data:text/javascript;base64," +
        Buffer.from(
          fs.readFileSync("src/portal/cardapioMensal.js", "utf8"),
        ).toString("base64")
    )),
);
test("setembro de 2026 tem cinco semanas e dias fora do mês vazios", () => {
  assert.deepEqual(
    m.semanasDoMes("2026-09").map((s) => s.rotulo),
    ["01-04", "07-11", "14-18", "21-25", "28-30"],
  );
  assert.equal(m.semanasDoMes("2026-09")[0].dias[0], null);
});
test("calendário 2000–2099 inclui cada dia útil uma única vez", () => {
  for (let y = 2000; y <= 2099; y++)
    for (let n = 1; n <= 12; n++) {
      const mes = `${y}-${String(n).padStart(2, "0")}`,
        list = m.semanasDoMes(mes).flatMap((s) => s.dias.filter(Boolean));
      const expected = Array.from(
        { length: m.diasNoMes(mes) },
        (_, i) => i + 1,
      ).filter((d) => m.diaUtil(mes, d));
      assert.deepEqual(list, expected);
    }
});
test("fevereiro bissexto e mês inválido", () => {
  assert.equal(m.diasNoMes("2028-02"), 29);
  assert.equal(m.diasNoMes("2026-02"), 28);
  assert.equal(m.diasNoMes("2026-13"), 0);
});
test("segundas distintas persistem na serialização", () => {
  const g = m.novoCardapio("2026-09");
  g.dias[13].segundo = "LEITE";
  g.dias[20].segundo = "SUCO";
  const v = m.validarCardapio(
    JSON.parse(JSON.stringify(m.serializarCardapio(g))),
  );
  assert.equal(v.dias[13].segundo, "LEITE");
  assert.equal(v.dias[20].segundo, "SUCO");
});
test("rascunho incompleto permitido; publicação incompleta rejeitada", () => {
  const g = m.novoCardapio("2026-09");
  assert.doesNotThrow(() => m.validarCardapio(g));
  assert.throws(() => m.validarCardapio(g, { publicar: true }), /dia 01/);
});
test("feriado dispensa lanches e publicação completa funciona", () => {
  const g = m.novoCardapio("2026-09");
  g.dias.forEach((d) => {
    d.primeiro = "FRUTA";
    d.segundo = "ARROZ";
  });
  Object.assign(g.dias[6], { situacao: "feriado", primeiro: "", segundo: "" });
  assert.doesNotThrow(() => m.validarCardapio(g, { publicar: true }));
});
test("copiar semana preserva origem e dias sem correspondência", () => {
  const g = m.novoCardapio("2026-09");
  g.dias[0].segundo = "SOPA";
  g.dias[6].evento = "FERIADO";
  const c = m.copiarSemana(g, 0, 1);
  assert.equal(c.dias[7].segundo, "SOPA");
  assert.equal(c.dias[6].evento, "FERIADO");
  c.dias[7].segundo = "OUTRO";
  assert.equal(g.dias[0].segundo, "SOPA");
});
test("validação rejeita mês divergente, tipo, excesso e separadores", () => {
  const g = m.novoCardapio("2026-09");
  assert.throws(() => m.validarCardapio(g, { mes: "2026-10" }));
  for (const value of [123, "x".repeat(501), "a\u001fb"]) {
    g.dias[30].segundo = value;
    assert.throws(() => m.validarCardapio(g));
  }
});
test("grade antiga ausente ou inválida mantém fallback", () => {
  assert.equal(m.gradeValida(undefined), null);
  assert.equal(m.gradeValida({ dias: [] }), null);
});
test("texto público contém datas, preparações e observações", () => {
  const g = m.novoCardapio("2026-09");
  g.dias[0].segundo = "SOPA\nLEGUMES";
  g.dias[0].observacao = "Sem adição de açúcar.";
  const text = m.textoCardapio(g);
  assert.match(text, /TERÇA 01\/09/);
  assert.match(text, /SOPA\nLEGUMES/);
  assert.match(text, /Sem adição de açúcar/);
});
