<template>
  <div
    class="cardapio-scroll"
    role="region"
    tabindex="0"
    :aria-label="'Cardápio mensal de ' + (escola || 'alimentação escolar')"
  >
    <article v-if="grade" class="cardapio-folha">
      <header class="folha-cabecalho">
        <div class="marca marca-semed">
          <img :src="MARCAS" alt="SEMED Pedro II" />
        </div>
        <div
          class="instituicao"
          :style="{
            fontSize: `${Math.min(1.84, 95 / Math.max(52, grade.etapa.length + grade.turno.length))}cqw`,
          }"
        >
          <div>PREFEITURA MUNICIPAL DE PEDRO II-PIAUÍ</div>
          <div>SECRETARIA MUNICIPAL DE EDUCAÇÃO</div>
          <div>PROGRAMA NACIONAL DE ALIMENTAÇÃO ESCOLAR-PNAE</div>
          <div>{{ grade.etapa }}-{{ grade.turno }}</div>
          <div>{{ tituloMes(grade.mes) }}</div>
        </div>
        <div class="marca marca-pnae">
          <img
            :src="MARCAS"
            alt="PNAE Programa Nacional de Alimentação Escolar"
          />
        </div>
      </header>
      <table class="folha-tabela">
        <caption class="folha-sr">
          {{
            tituloMes(grade.mes)
          }}.
          {{
            escola
          }}. Primeiro e segundo lanches por data.
        </caption>
        <colgroup>
          <col style="width: 6.5%" />
          <col style="width: 10.3%" />
          <col style="width: 13.1%" />
          <col style="width: 24.3%" />
          <col style="width: 13.1%" />
          <col style="width: 16.8%" />
          <col style="width: 15.9%" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">DIA</th>
            <th scope="col">LANCHES</th>
            <th v-for="dia in DIAS_SEMANA" :key="dia" scope="col">{{ dia }}</th>
          </tr>
        </thead>
        <tbody
          v-for="semana in semanas"
          :key="semana.indice"
          :class="{
            cinza:
              semana.indice % 2 === 0 &&
              (semana.indice === 0 || semana.dias.every(Boolean)),
          }"
        >
          <tr class="primeiro-lanche">
            <th rowspan="2" scope="rowgroup" class="intervalo">
              {{ semana.rotulo }}
            </th>
            <th scope="row" class="vermelho">1º</th>
            <template v-for="(dia, index) in semana.dias" :key="index">
              <td v-if="!dia" rowspan="2" aria-label="Fora do mês"></td>
              <td
                v-else-if="grade.dias[dia - 1].situacao !== 'letivo'"
                rowspan="2"
                class="vermelho evento"
                :aria-label="
                  rotulo(dia, index) + ': ' + legendaDia(grade.dias[dia - 1])
                "
              >
                {{ legendaDia(grade.dias[dia - 1]) }}
              </td>
              <td
                v-else
                class="vermelho"
                :aria-label="
                  rotulo(dia, index) +
                  ' primeiro lanche: ' +
                  grade.dias[dia - 1].primeiro
                "
              >
                {{ grade.dias[dia - 1].primeiro
                }}<sup v-if="grade.dias[dia - 1].observacao">*</sup>
              </td>
            </template>
          </tr>
          <tr class="segundo-lanche">
            <th scope="row">2º</th>
            <template v-for="(dia, index) in semana.dias" :key="index"
              ><td
                v-if="dia && grade.dias[dia - 1].situacao === 'letivo'"
                :aria-label="
                  rotulo(dia, index) +
                  ' segundo lanche: ' +
                  grade.dias[dia - 1].segundo
                "
              >
                {{ grade.dias[dia - 1].segundo }}
              </td></template
            >
          </tr>
        </tbody>
      </table>
      <footer class="folha-rodape">
        <p v-if="grade.observacoes" class="nota">{{ grade.observacoes }}</p>
        <p v-for="d in observacoes" :key="d.dia" class="nota-dia">
          * {{ d.dia }}/{{ grade.mes.slice(5) }} — {{ d.texto }}
        </p>
        <p v-if="responsavel" class="responsavel">
          Responsável técnico: {{ responsavel }}
        </p>
      </footer>
    </article>
    <p v-else role="alert">
      Não foi possível apresentar a grade deste cardápio. Consulte o texto da
      publicação.
    </p>
  </div>
</template>
<script setup>
import { computed } from "vue";
import {
  DIAS_SEMANA,
  MARCAS,
  gradeValida,
  semanasDoMes,
  tituloMes,
  legendaDia,
  diaUtil,
} from "../../portal/cardapioMensal";
const props = defineProps({
  cardapio: { type: Object, required: true },
  escola: { type: String, default: "" },
  responsavel: { type: String, default: "" },
});
const grade = computed(() => gradeValida(props.cardapio));
const semanas = computed(() => semanasDoMes(grade.value?.mes));
const observacoes = computed(
  () =>
    grade.value?.dias.flatMap((d, i) =>
      d.observacao && diaUtil(grade.value.mes, i + 1)
        ? [{ dia: String(i + 1).padStart(2, "0"), texto: d.observacao }]
        : [],
    ) || [],
);
function rotulo(dia, index) {
  return `${DIAS_SEMANA[index]}, ${String(dia).padStart(2, "0")}/${grade.value.mes.slice(5)}`;
}
</script>
<style scoped>
.cardapio-scroll {
  max-width: 100%;
  overflow: auto;
  background: #fff;
  color: #000;
  border: 1px solid #dce5e4;
  border-radius: 4px;
}
.cardapio-scroll:focus-visible {
  outline: 3px solid #007b74;
  outline-offset: 3px;
}
.cardapio-folha {
  container-type: inline-size;
  min-width: 1040px;
  box-sizing: border-box;
  padding: 6px 4.8% 24px;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
}
.folha-cabecalho {
  position: relative;
  min-height: 10.4cqw;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.3cqw;
}
.instituicao {
  font:
    400 1.84cqw/1.15 Arial,
    Helvetica,
    sans-serif;
  text-align: center;
  white-space: nowrap;
  transform: translateX(-1.8cqw);
}
.marca {
  position: absolute;
  overflow: hidden;
  top: 0.8cqw;
}
.marca img {
  position: absolute;
  max-width: none !important;
  width: 111.1cqw !important;
  height: auto !important;
}
.marca-semed {
  left: -1.7cqw;
  width: 13.8cqw;
  height: 9.7cqw;
}
.marca-semed img {
  left: -3.34cqw;
  top: -1.42cqw;
}
.marca-pnae {
  right: -2.5cqw;
  width: 16cqw;
  height: 8.8cqw;
}
.marca-pnae img {
  left: -92.14cqw;
  top: -2.26cqw;
}
.folha-tabela {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font:
    400 1.84cqw/1.15 Arial,
    Helvetica,
    sans-serif;
  color: #000;
}
.folha-tabela th,
.folha-tabela td {
  border: 1px solid #000;
  text-align: center;
  padding: 0 0.45cqw;
  white-space: pre-line;
  overflow-wrap: anywhere;
  font-weight: 400;
}
.folha-tabela thead th {
  white-space: nowrap;
  background: white;
}
.cinza {
  background: #f0f0f0;
}
.primeiro-lanche td {
  vertical-align: top;
}
.segundo-lanche td,
.segundo-lanche th {
  vertical-align: top;
  height: 6.5cqw;
}
.folha-tabela .intervalo,
.folha-tabela .evento {
  vertical-align: middle;
}
.vermelho {
  color: #f00;
}
.folha-rodape {
  font:
    400 1.58cqw/1.35 Arial,
    Helvetica,
    sans-serif;
}
.folha-rodape p {
  margin: 1.7cqw 0 0;
}
.folha-rodape .nota {
  font-weight: bold;
  text-align: center;
}
.folha-rodape .nota-dia,
.folha-rodape .responsavel {
  margin-top: 0.6cqw;
  font-size: 1.1cqw;
}
.folha-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
}
@media print {
  .cardapio-scroll {
    overflow: visible;
    border: 0;
  }
  .cardapio-folha {
    min-width: 0;
    width: 100%;
    padding: 0;
  }
  .folha-tabela {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .folha-tabela tbody {
    break-inside: avoid;
  }
  .folha-cabecalho {
    break-after: avoid;
  }
}
@media (forced-colors: active) {
  .vermelho {
    color: CanvasText;
  }
}
</style>
