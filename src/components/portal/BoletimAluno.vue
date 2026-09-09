<template>
  <section class="p-stack">
    <EstadoConsulta :consulta="cadastro" /><template v-if="aluno"
      ><header>
        <h2>{{ aluno.nome }}</h2>
        <p>{{ aluno.turma }} · {{ aluno.ano }}</p>
      </header>
      <EstadoConsulta :consulta="notas" />
      <div class="p-table-wrap">
        <table class="p-table">
          <caption class="sr-only">
            Boletim escolar de
            {{
              aluno.nome
            }}
          </caption>
          <thead>
            <tr>
              <th>Componente</th>
              <th>Período</th>
              <th>Nota</th>
              <th>Frequência</th>
              <th>Observação</th>
              <th v-if="editar">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in ordenadas" :key="n.id">
              <td>{{ n.componente }}</td>
              <td>{{ n.bimestre }}º bimestre / {{ n.ano }}</td>
              <td>{{ n.nota.toLocaleString("pt-BR") }}</td>
              <td>{{ n.frequencia }}%</td>
              <td>{{ n.observacao }}</td>
              <td v-if="editar">
                <button
                  v-if="pode('usuarios') || n.professorUid === usuario?.uid"
                  class="p-button"
                  @click="abrir(n)"
                >
                  Editar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="!notas.dados.value.length && !notas.carregando.value"
        class="p-empty"
      >
        Ainda não há notas registradas para este aluno.
      </p>
      <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
      <p v-if="mensagem" role="status" class="p-alert success">
        {{ mensagem }}
      </p>
      <div class="p-actions">
        <button
          class="p-button"
          :disabled="notas.carregando.value || !ordenadas.length"
          @click="pdf"
        >
          Baixar boletim em PDF</button
        ><button
          v-if="editar && aluno.ativo"
          class="p-button primary"
          @click="abrir()"
        >
          + Registrar nota
        </button>
      </div>
      <form
        v-if="aberto && editar"
        class="p-card p-stack"
        @submit.prevent="salvar"
      >
        <fieldset class="p-stack" :disabled="ocupado">
          <h3>{{ form.id ? "Editar registro" : "Novo registro" }}</h3>
          <div class="p-grid two">
            <label class="p-field"
              >Componente curricular<input
                aria-label="Componente curricular"
                v-model="form.componente"
                :disabled="!!form.id"
                maxlength="100"
                required /></label
            ><label class="p-field"
              >Bimestre<select
                aria-label="Bimestre"
                v-model.number="form.bimestre"
                :disabled="!!form.id"
              >
                <option v-for="n in 4" :key="n" :value="n">{{ n }}º</option>
              </select></label
            ><label class="p-field"
              >Ano<input
                aria-label="Ano"
                v-model.number="form.ano"
                :disabled="!!form.id"
                type="number"
                min="2000"
                max="2100"
                required /></label
            ><label class="p-field"
              >Nota (0 a 10)<input
                aria-label="Nota (0 a 10)"
                v-model.number="form.nota"
                type="number"
                min="0"
                max="10"
                step="0.1"
                required /></label
            ><label class="p-field"
              >Frequência (%)<input
                aria-label="Frequência (%)"
                v-model.number="form.frequencia"
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
            /></label>
          </div>
          <label class="p-field"
            >Observação para a família<textarea
              aria-label="Observação para a família"
              v-model="form.observacao"
              maxlength="1000"
            />
          </label>
          <div class="p-actions">
            <button class="p-button primary">
              {{ ocupado ? "Salvando…" : "Salvar registro" }}</button
            ><button type="button" class="p-button" @click="aberto = false">
              Cancelar
            </button>
          </div>
        </fieldset>
      </form></template
    >
  </section>
</template>
<script setup>
import { chaveNota } from "../../portal/notas";
import { transacaoConfirmada } from "../../portal/transacao";
import { computed, ref, reactive, watch } from "vue";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { useAuth } from "../../composables/useAuth";
import { mensagemErro } from "../../portal/validacao";
import EstadoConsulta from "./EstadoConsulta.vue";
const props = defineProps({
    alunoId: { type: String, required: true },
    editar: Boolean,
  }),
  { usuario, pode } = useAuth(),
  cadastro = useColecao(
    () => (props.alunoId ? doc(db, "alunos", props.alunoId) : null),
    () => props.alunoId,
  ),
  aluno = computed(() => cadastro.dados.value[0]),
  notas = useColecao(
    () =>
      props.alunoId ? collection(db, "alunos", props.alunoId, "notas") : null,
    () => props.alunoId,
  ),
  ordenadas = computed(() =>
    [...notas.dados.value].sort(
      (a, b) =>
        b.ano - a.ano ||
        a.bimestre - b.bimestre ||
        a.componente.localeCompare(b.componente),
    ),
  ),
  aberto = ref(false),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  form = reactive({});
watch(
  () => props.alunoId,
  () => {
    aberto.value = false;
    erro.value = "";
    mensagem.value = "";
  },
);
function abrir(n) {
  Object.assign(form, {
    id: n?.id || "",
    componente: n?.componente || "",
    bimestre: n?.bimestre || 1,
    ano: n?.ano || aluno.value.ano,
    nota: n?.nota ?? "",
    frequencia: n?.frequencia ?? "",
    observacao: n?.observacao || "",
    professorUid: n?.professorUid || usuario.value.uid,
    versao: n?.versao || 0,
  });
  aberto.value = true;
}
async function salvar() {
  ocupado.value = true;
  erro.value = "";
  try {
    if (
      !Number.isFinite(form.nota) ||
      form.nota < 0 ||
      form.nota > 10 ||
      !Number.isFinite(form.frequencia) ||
      form.frequencia < 0 ||
      form.frequencia > 100
    )
      throw new Error("Confira nota e frequência.");
    const id = await chaveNota(
      form.componente,
      form.ano,
      form.bimestre,
      form.professorUid,
    );
    if (form.id && form.id !== id)
      throw new Error(
        "Este lançamento é anterior à validação de unicidade. Solicite ao Master a regularização das notas antes de editar.",
      );
    const r = doc(db, "alunos", props.alunoId, "notas", id);
    await transacaoConfirmada(async (t) => {
      const s = await t.get(r);
      if (s.exists() && (!form.id || s.data().versao !== form.versao))
        throw new Error(
          "Já existe um registro para este componente e período, ou ele foi alterado. Edite o registro existente.",
        );
      t.set(r, {
        componente: form.componente.trim(),
        bimestre: form.bimestre,
        ano: form.ano,
        nota: form.nota,
        frequencia: form.frequencia,
        observacao: form.observacao.trim(),
        professorUid: form.professorUid,
        versao: form.versao + 1,
        atualizadoEm: serverTimestamp(),
      });
    });
    aberto.value = false;
    mensagem.value = "Registro salvo. A família vinculada já pode consultar.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
async function pdf() {
  try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const p = new jsPDF();
    p.setFontSize(14);
    p.text("Boletim escolar · SEDUC Pedro II", 14, 18);
    autoTable(p, {
      startY: 25,
      body: [[aluno.value.nome], [aluno.value.turma + " · " + aluno.value.ano]],
      theme: "plain",
    });
    autoTable(p, {
      startY: p.lastAutoTable.finalY + 8,
      head: [["Componente", "Período", "Nota", "Frequência", "Observação"]],
      body: ordenadas.value.map((n) => [
        n.componente,
        `${n.bimestre}º/${n.ano}`,
        n.nota,
        `${n.frequencia}%`,
        n.observacao,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 110, 102] },
    });
    p.save("boletim-escolar.pdf");
  } catch (e) {
    erro.value = mensagemErro(e);
  }
}
</script>
<style scoped>
fieldset {
  border: 0;
  min-width: 0;
}
</style>
