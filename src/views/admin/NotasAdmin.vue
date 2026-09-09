<template>
  <section>
    <header class="p-page-head">
      <h1>Notas e frequência</h1>
      <p>
        Selecione um aluno autorizado para consultar ou registrar seu
        desempenho.
      </p>
    </header>
    <EstadoConsulta :consulta="consulta" /><label class="p-field"
      >Aluno<select aria-label="Aluno" v-model="alunoId">
        <option value="">Selecione</option>
        <option v-for="a in consulta.dados.value" :key="a.id" :value="a.id">
          {{ a.nome }} · {{ a.turma }} / {{ a.ano }}
        </option>
      </select></label
    ><BoletimAluno
      v-if="alunoId"
      :key="alunoId"
      :aluno-id="alunoId"
      editar
      class="p-section"
    />
    <p
      v-else-if="!consulta.dados.value.length && !consulta.carregando.value"
      class="p-empty"
    >
      Nenhum aluno vinculado. Solicite à direção o vínculo com suas turmas.
    </p>
  </section>
</template>
<script setup>
import { ref } from "vue";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../composables/useAuth";
import { useColecao } from "../../composables/useColecao";
import BoletimAluno from "../../components/portal/BoletimAluno.vue";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { usuario, pode } = useAuth(),
  alunoId = ref(""),
  consulta = useColecao(() =>
    pode("usuarios")
      ? collection(db, "alunos")
      : usuario.value.escolasVinculadas.length
        ? query(
            collection(db, "alunos"),
            where("professoresUids", "array-contains", usuario.value.uid),
            where(
              "escolaId",
              "in",
              usuario.value.escolasVinculadas.slice(0, 20),
            ),
          )
        : null,
  );
</script>
