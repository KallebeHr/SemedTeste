<template>
  <section class="p-card p-stack" aria-labelledby="titulo-importacao">
    <h2 id="titulo-importacao">Importar escolas por planilha</h2>
    <p>
      Escolha Excel (.xlsx) ou CSV, até 500 escolas e 2 MB. A primeira linha
      deve conter os nomes das colunas. Os dados serão cadastrados para uso
      interno; a publicação da ficha continua no editor de cada escola.
    </p>
    <button type="button" class="p-button" :disabled="ocupado" @click="modelo">
      Baixar modelo CSV
    </button>
    <label class="p-field"
      >Planilha de escolas<input
        type="file"
        accept=".xlsx,.csv"
        :disabled="ocupado"
        @change="ler"
    /></label>
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <template v-if="headers.length">
      <fieldset :disabled="ocupado" class="p-grid two">
        <legend>Associe as colunas da planilha</legend>
        <label v-for="(campo, key) in CAMPOS_ESCOLA" :key="key" class="p-field"
          >{{ campo[0]
          }}<select v-model.number="mapa[key]">
            <option :value="-1">Não importar</option>
            <option v-for="(h, i) in headers" :key="i" :value="i">
              {{ h || "Coluna " + (i + 1) }}
            </option>
          </select></label
        >
      </fieldset>
      <label class="p-check"
        ><input type="checkbox" v-model="atualizar" :disabled="ocupado" />
        Atualizar escolas correspondentes por INEP ou nome. Somente colunas
        associadas serão substituídas; células vazias nessas colunas limparão o
        campo.</label
      >
      <p v-if="mapa.nome < 0" role="alert">
        Associe a coluna Nome da escola para visualizar os registros.
      </p>
      <p>
        {{ previa.length }} linha(s) ·
        {{ previa.filter((l) => l.erro).length }} com erro. Revise antes de
        confirmar.
      </p>
      <div
        class="tabela"
        tabindex="0"
        role="region"
        aria-label="Prévia da importação"
      >
        <table>
          <thead>
            <tr>
              <th>Linha</th>
              <th>Escola</th>
              <th>INEP</th>
              <th>Alunos</th>
              <th>Funcionários</th>
              <th>Outras informações</th>
              <th>Resultado previsto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in previa" :key="l.linha">
              <td>{{ l.linha }}</td>
              <td>{{ l.dados.nome }}</td>
              <td>{{ l.dados.inep || "—" }}</td>
              <td>{{ l.dados.alunos ?? "—" }}</td>
              <td>{{ l.dados.funcionarios ?? "—" }}</td>
              <td>
                <details>
                  <summary>Ver dados</summary>
                  <p
                    v-for="key in Object.keys(CAMPOS_ESCOLA).filter(
                      (k) =>
                        !['nome', 'inep', 'alunos', 'funcionarios'].includes(
                          k,
                        ) && k in l.dados,
                    )"
                    :key="key"
                  >
                    {{ CAMPOS_ESCOLA[key][0] }}: {{ l.dados[key] || "—" }}
                  </p>
                </details>
              </td>
              <td>
                {{
                  l.erro ||
                  (l.existente
                    ? atualizar
                      ? "Atualizar"
                      : "Ignorar: já cadastrada"
                    : "Cadastrar")
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button
        class="p-button primary"
        :disabled="ocupado || !previa.length || previa.some((l) => l.erro)"
        @click="confirmar"
      >
        {{ ocupado ? "Importando…" : "Confirmar importação" }}
      </button>
    </template>
    <div v-if="resultado" role="status">
      <p>
        {{ resultado.criadas }} criada(s),
        {{ resultado.atualizadas }} atualizada(s),
        {{ resultado.ignoradas }} ignorada(s),
        {{ resultado.falhas.length }} falha(s).
      </p>
      <p v-for="f in resultado.falhas" :key="f.linha">
        Linha {{ f.linha }} — {{ f.nome }}: {{ f.erro }}
      </p>
      <p v-if="!ocupado">
        A importação terminou. Você pode repetir o arquivo: escolas confirmadas
        serão reconhecidas. Estoques, vínculos e vistorias foram preservados.
      </p>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, watch } from "vue";
import {
  CAMPOS_ESCOLA,
  lerCSV,
  mapearCabecalhos,
  prepararLinhas,
} from "../../../shared/importacao-escolas.mjs";
import { importarEscolas } from "../../services/importacaoEscolas";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
const props = defineProps({ escolas: { type: Array, default: () => [] } });
const headers = ref([]),
  rows = ref([]),
  mapa = ref({}),
  erro = ref(""),
  ocupado = ref(false),
  atualizar = ref(false),
  resultado = ref(null);
const previa = computed(() => {
  try {
    return prepararLinhas(rows.value, mapa.value, props.escolas);
  } catch {
    return [];
  }
});
watch(
  mapa,
  () => {
    erro.value = "";
    resultado.value = null;
  },
  { deep: true },
);
useSaidaSegura(() => ocupado.value);
async function ler(event) {
  const f = event.target.files?.[0];
  if (!f) return;
  erro.value = "";
  headers.value = [];
  rows.value = [];
  resultado.value = null;
  ocupado.value = true;
  try {
    if (f.size > 2 * 1024 * 1024)
      throw new Error("Use uma planilha de até 2 MB.");
    let data;
    if (/\.csv$/i.test(f.name)) data = lerCSV(await f.text());
    else if (/\.xlsx$/i.test(f.name)) {
      const { default: read } = await import("read-excel-file/browser");
      data = await read(f);
    } else
      throw new Error(
        "Use .xlsx ou .csv. Para .xls, salve novamente como .xlsx.",
      );
    data = data.filter((r) => r.some((v) => v !== null && String(v).trim()));
    if (data.length < 2 || data.length > 501)
      throw new Error("A planilha precisa ter cabeçalho e de 1 a 500 escolas.");
    if (data[0].length > 50) throw new Error("Use no máximo 50 colunas.");
    headers.value = data[0].map(String);
    rows.value = data.slice(1);
    mapa.value = mapearCabecalhos(headers.value);
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
    event.target.value = "";
  }
}
async function confirmar() {
  if (ocupado.value) return;
  if (mapa.value.nome < 0) {
    erro.value = "Associe a coluna Nome da escola.";
    return;
  }
  ocupado.value = true;
  erro.value = "";
  try {
    resultado.value = await importarEscolas(
      rows.value,
      mapa.value,
      atualizar.value,
      (r) => (resultado.value = r),
    );
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
function modelo() {
  const text =
    "\uFEFF" +
    Object.values(CAMPOS_ESCOLA)
      .map((c) => c[0])
      .join(";") +
    "\r\n";
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-escolas.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
<style scoped>
fieldset {
  border: 0;
  padding: 0;
}
.tabela {
  overflow: auto;
  max-height: 26rem;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th,
td {
  text-align: left;
  padding: 0.65rem;
  border-bottom: 1px solid #ccc;
}
th {
  background: var(--p-surface, #f3f4f6);
  position: sticky;
  top: 0;
}
</style>
