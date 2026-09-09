<template>
  <section>
    <header class="p-section-head">
      <div>
        <h1>Alunos e vínculos</h1>
        <p>
          Vincule cada aluno aos professores e à conta do responsável. Esses
          dados são restritos.
        </p>
      </div>
      <button class="p-button primary" :disabled="!escolaId" @click="editar()">
        + Cadastrar aluno
      </button>
    </header>
    <EstadoConsulta :consulta="escolas" /><label class="p-field"
      >Escola<select aria-label="Escola" v-model="escolaId">
        <option value="">Selecione</option>
        <option v-for="e in escolas.dados.value" :key="e.id" :value="e.id">
          {{ e.nome }}
        </option>
      </select></label
    ><EstadoConsulta :consulta="alunos" />
    <p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
    <p v-if="mensagem" class="p-alert success" role="status">{{ mensagem }}</p>
    <form v-if="aberto" class="p-card p-stack" @submit.prevent="salvar">
      <fieldset :disabled="ocupado" class="p-stack">
        <h2>{{ form.id ? "Editar aluno" : "Novo aluno" }}</h2>
        <div class="p-grid two">
          <label class="p-field"
            >Nome do aluno<input
              aria-label="Nome do aluno"
              v-model="form.nome"
              required
              maxlength="160" /></label
          ><label class="p-field"
            >Turma<input
              aria-label="Turma"
              v-model="form.turma"
              required
              maxlength="100" /></label
          ><label class="p-field"
            >Ano letivo<input
              aria-label="Ano letivo"
              v-model.number="form.ano"
              type="number"
              min="2000"
              max="2100"
              required /></label
          ><label class="p-field"
            >UID da conta do responsável<input
              aria-label="UID da conta do responsável"
              v-model="form.responsavelUid"
              maxlength="128"
            /><small
              >O responsável encontra este identificador na conta de
              atendimento. Confirme o vínculo com a documentação da escola antes
              de liberar o boletim.</small
            ></label
          >
        </div>
        <fieldset>
          <legend>Professores autorizados a registrar notas</legend>
          <EstadoConsulta :consulta="equipe" /><label
            v-for="p in professores"
            :key="p.id"
            class="p-check"
            ><input
              v-model="form.professoresUids"
              type="checkbox"
              :value="p.id"
            />{{ p.nome }}</label
          >
          <p v-if="!professores.length">
            O Master precisa cadastrar os professores e vinculá-los a esta
            escola.
          </p>
          <small>Até 8 professores por aluno neste cadastro.</small>
        </fieldset>
        <label class="p-check"
          ><input v-model="form.ativo" type="checkbox" /> Vínculo ativo (permite
          novos registros de notas)</label
        >
        <div class="p-actions">
          <button class="p-button primary">
            {{ ocupado ? "Salvando…" : "Salvar aluno e vínculos" }}</button
          ><button class="p-button" type="button" @click="aberto = false">
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
    <div class="p-table-wrap" v-if="escolaId">
      <table class="p-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Turma</th>
            <th>Família</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in alunos.dados.value" :key="a.id">
            <td>{{ a.nome }} <span v-if="!a.ativo">(inativo)</span></td>
            <td>{{ a.turma }} · {{ a.ano }}</td>
            <td>{{ a.responsavelUid ? "Vinculada" : "Sem vínculo" }}</td>
            <td>
              <button class="p-button" @click="editar(a)">Editar</button
              ><router-link
                :to="'/administracao/boletim/' + a.id"
                class="p-button"
                >Consultar boletim</router-link
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup>
import { transacaoConfirmada } from "../../portal/transacao";
import { ref, reactive, computed, watch } from "vue";
import {
  collection,
  query,
  where,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { useEscolasAcesso } from "../../composables/useEscolasAcesso";
import { mensagemErro } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const escolas = useEscolasAcesso(),
  escolaId = ref(""),
  aberto = ref(false),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  form = reactive({}),
  alunos = useColecao(
    () =>
      escolaId.value
        ? query(
            collection(db, "alunos"),
            where("escolaId", "==", escolaId.value),
          )
        : null,
    escolaId,
  ),
  equipe = useColecao(() => collection(db, "equipe")),
  professores = computed(() =>
    equipe.dados.value.filter(
      (p) =>
        p.ativo &&
        p.papel === "professor" &&
        p.escolasVinculadas.includes(escolaId.value),
    ),
  );
watch(escolaId, () => (aberto.value = false));
function editar(a) {
  Object.keys(form).forEach((k) => delete form[k]);
  Object.assign(form, {
    id: a?.id || "",
    nome: a?.nome || "",
    turma: a?.turma || "",
    ano: a?.ano || new Date().getFullYear(),
    responsavelUid: a?.responsavelUid || "",
    professoresUids: [...(a?.professoresUids || [])],
    ativo: a?.ativo !== false,
    versao: a?.versao || 0,
  });
  aberto.value = true;
  erro.value = "";
}
async function salvar() {
  ocupado.value = true;
  erro.value = "";
  try {
    if (form.professoresUids.length > 8)
      throw new Error("Selecione até 8 professores por aluno.");
    const r = form.id
      ? doc(db, "alunos", form.id)
      : doc(collection(db, "alunos"));
    form.id = r.id;
    await transacaoConfirmada(async (t) => {
      const s = await t.get(r);
      if (s.exists() && s.data().versao !== form.versao)
        throw new Error(
          "O cadastro foi atualizado. Reabra o aluno para editar.",
        );
      t.set(r, {
        nome: form.nome.trim(),
        turma: form.turma.trim(),
        ano: form.ano,
        responsavelUid: form.responsavelUid.trim(),
        professoresUids: [...new Set(form.professoresUids)],
        ativo: form.ativo,
        escolaId: escolaId.value,
        versao: form.versao + 1,
        atualizadoEm: serverTimestamp(),
      });
    });
    aberto.value = false;
    mensagem.value = "Cadastro e vínculos salvos.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
fieldset {
  border: 0;
  min-width: 0;
}
fieldset fieldset {
  border: 1px solid var(--p-border);
  padding: 1rem;
}
form,
.p-table-wrap {
  margin-block: 1.5rem;
}
</style>
