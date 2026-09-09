<template>
  <div class="p-container p-page">
    <header class="p-page-head">
      <p class="p-eyebrow">ACOMPANHAMENTO ESCOLAR</p>
      <h1>Boletim e notas</h1>
      <p>
        Somente a conta vinculada pela escola pode consultar o boletim do aluno.
      </p>
    </header>
    <ContaForm /><template v-if="conta?.emailVerified"
      ><EstadoConsulta :consulta="alunos" /><label
        v-if="alunos.dados.value.length"
        class="p-field p-section"
        >Aluno<select aria-label="Aluno" v-model="alunoId">
          <option value="">Selecione um aluno</option>
          <option v-for="a in alunos.dados.value" :key="a.id" :value="a.id">
            {{ a.nome }} · {{ a.turma }}
          </option>
        </select></label
      ><BoletimAluno
        v-if="alunoId"
        :key="alunoId"
        :aluno-id="alunoId"
        class="p-section"
      />
      <p
        v-else-if="!alunos.dados.value.length && !alunos.carregando.value"
        class="p-alert"
      >
        Nenhum aluno está vinculado a esta conta. Informe seu identificador de
        conta à direção da escola e solicite a conferência do vínculo.
      </p></template
    >
  </div>
</template>
<script setup>
import { ref, watch } from "vue";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../composables/useAuth";
import { useColecao } from "../../composables/useColecao";
import ContaForm from "../../components/portal/ContaForm.vue";
import BoletimAluno from "../../components/portal/BoletimAluno.vue";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { conta } = useAuth(),
  alunoId = ref(""),
  alunos = useColecao(
    () =>
      conta.value?.emailVerified
        ? query(
            collection(db, "alunos"),
            where("responsavelUid", "==", conta.value.uid),
          )
        : null,
    () => [conta.value?.uid, conta.value?.emailVerified],
  );
watch(alunos.dados, (d) => {
  if (!d.some((a) => a.id === alunoId.value))
    alunoId.value = d.length === 1 ? d[0].id : "";
});
</script>
