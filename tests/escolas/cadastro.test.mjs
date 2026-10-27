import { test } from "node:test";
import assert from "node:assert/strict";
import { ESCOLAS_REDE } from "../../src/data/escolasRede.mjs";
import {
  validarEscola,
  prepararLinhas,
  mesclarImportacao,
  totalPessoas,
  alertasEscola,
  idPorNome,
} from "../../shared/importacao-escolas.mjs";
test("43 nomes exatos, sem duplicações e sem correção de grafias", () => {
  assert.equal(ESCOLAS_REDE.length, 43);
  assert.equal(new Set(ESCOLAS_REDE).size, 43);
  assert(ESCOLAS_REDE.includes("E. M. Educação Infatil Tia Alice"));
  for (const nome of ["E. M. Olho d água dos", "Outra escola"])
    assert(alertasEscola({ nome }).some((a) => a.includes("Nome incompleto")));
});
test("nome único obrigatório; desconhecido não é zero e total só existe com ambos informados", () => {
  const e = validarEscola({ nome: "Escola A" });
  assert.equal(e.alunos, null);
  assert.equal(e.funcionarios, null);
  assert.equal(e.totalPessoasEscola, null);
  assert.equal(totalPessoas({ alunos: 0, funcionarios: null }), null);
  assert.equal(
    validarEscola({ nome: "Escola A", alunos: 0, funcionarios: 0 })
      .totalPessoasEscola,
    0,
  );
  assert.equal(
    validarEscola({ nome: "Escola A", alunos: 17, funcionarios: 3 })
      .totalPessoasEscola,
    20,
  );
  assert.throws(() => validarEscola({ nome: "Escola A", latitude: 91 }));
});
test("reimportação reconhece IDs antigos; vazio preserva preenchimentos, zeros reais e metadados", () => {
  const existentes = ESCOLAS_REDE.map((nome, i) => ({
    id: "legado-" + i,
    nome,
    endereco: "Rua existente",
    alunos: 0,
    funcionarios: 3,
    versao: 2,
  }));
  const previa = prepararLinhas(
    ESCOLAS_REDE.map((n) => [n]),
    { nome: 0 },
    existentes,
  );
  assert(previa.every((r, i) => r.existente.id === "legado-" + i && !r.erro));
  const mesclado = mesclarImportacao(
    existentes[0],
    validarEscola({ nome: ESCOLAS_REDE[0], endereco: "", alunos: "" }, true),
  );
  assert.equal(mesclado.id, "legado-0");
  assert.equal(mesclado.endereco, "Rua existente");
  assert.equal(mesclado.alunos, 0);
  assert.equal(mesclado.totalPessoasEscola, 3);
});
test("cadastro rápido, importação e cadastro manual usam identidade determinística comum", async () => {
  assert.equal(await idPorNome("Escola Á"), await idPorNome(" escola a "));
  assert.notEqual(await idPorNome("Escola A"), await idPorNome("Escola B"));
});
