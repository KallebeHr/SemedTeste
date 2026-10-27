<template>
  <section>
    <header class="p-section-head">
      <div>
        <h1>Escolas da rede</h1>
        <p>O cadastro interno é separado da ficha pública da escola.</p>
      </div>
      <button class="p-button primary" @click="editar()">
        + Adicionar escola
      </button>
    </header>
    <div class="p-grid indicadores">
      <div class="p-card">
        Cadastradas <strong>{{ todas.length }}</strong>
      </div>
      <div class="p-card">
        Ativas
        <strong>{{
          todas.filter((e) => e.ativo !== false && !e.arquivada).length
        }}</strong>
      </div>
      <div class="p-card">
        Inativas
        <strong>{{ todas.filter((e) => e.ativo === false).length }}</strong>
      </div>
    </div>
    <div class="filtros">
      <label class="p-field"
        >Pesquisar escola<input
          v-model="busca"
          type="search"
          placeholder="Nome da escola" /></label
      ><label class="p-field"
        >Situação<select v-model="situacao">
          <option value="">Todas</option>
          <option value="ativas">Ativas</option>
          <option value="inativas">Inativas</option>
          <option value="arquivadas">Arquivadas</option>
          <option value="pendentes">Informações incompletas</option>
        </select></label
      >
    </div>
    <details class="p-card">
      <summary>Importar escolas por planilha</summary>
      <ImportarEscolas :escolas="consulta.dados.value" />
    </details>
    <EstadoConsulta :consulta="consulta" />
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <form v-if="aberto" class="p-card p-stack" @submit.prevent="salvar">
      <h2>{{ form.id ? "Editar escola" : "Nova escola" }}</h2>
      <fieldset :disabled="ocupado" class="p-stack">
        <label class="p-field"
          >Nome da escola<input
            aria-label="Nome da escola"
            v-model="form.nome"
            required
            maxlength="160"
        /></label>
        <section v-for="grupo in grupos" :key="grupo.titulo" class="form-grupo">
          <h3>{{ grupo.titulo }}</h3>
          <div class="p-grid two">
            <label v-for="key in grupo.campos" :key="key" class="p-field"
              >{{ CAMPOS_ESCOLA[key][0] }}
              <textarea
                v-if="key === 'observacoes'"
                v-model="form[key]"
                maxlength="3000"
              />
              <select
                v-else-if="key === 'zona'"
                v-model="form[key]"
                aria-label="Zona urbana ou rural"
              >
                <option value="">Não informada</option>
                <option value="urbana">Urbana</option>
                <option value="rural">Rural</option>
              </select>
              <input
                v-else
                v-model="form[key]"
                :type="
                  ['alunos', 'funcionarios'].includes(key)
                    ? 'number'
                    : key === 'email'
                      ? 'email'
                      : key === 'contato'
                        ? 'tel'
                        : 'text'
                "
                :min="['alunos', 'funcionarios'].includes(key) ? 0 : undefined"
                :max="
                  ['alunos', 'funcionarios'].includes(key) ? 100000 : undefined
                "
                :step="['alunos', 'funcionarios'].includes(key) ? 1 : undefined"
                :maxlength="CAMPOS_ESCOLA[key][1] || undefined"
              />
            </label>
          </div>
        </section>
        <p class="p-small">
          Total de pessoas:
          <strong>{{
            totalPessoas(validarContagens) ??
            "Não informado — preencha alunos e funcionários"
          }}</strong
          >. Zero só deve ser informado quando a quantidade real for zero.
        </p>
        <h3>Publicação autorizada</h3>
        <label class="p-field"
          >Apresentação pública<textarea
            aria-label="Apresentação pública"
            v-model="form.sobre"
            maxlength="3000"
          /></label
        ><label class="p-check"
          ><input
            v-model="form.ativo"
            type="checkbox"
            :disabled="form.arquivada"
          />
          Escola ativa no sistema</label
        ><label class="p-check"
          ><input v-model="publicar" type="checkbox" :disabled="!form.ativo" />
          Exibir a ficha no portal público</label
        >
        <fieldset v-if="publicar" class="publicacao-campos">
          <legend>Autorizar dados públicos</legend>
          <p>
            O nome será exibido. Marque somente os outros dados que podem ser
            divulgados. Diretor, observações internas e quantidades não são
            publicados.
          </p>
          <label v-for="key in PUBLICAVEIS" :key="key" class="p-check"
            ><input type="checkbox" v-model="autorizados" :value="key" />{{
              CAMPOS_ESCOLA[key]?.[0] || key
            }}</label
          >
        </fieldset>
        <p class="p-small">
          Confirme que o contato e o texto podem ser divulgados. Desmarcar a
          publicação também retira os resumos públicos das vistorias da
          consulta.
        </p>
        <div class="p-actions">
          <button class="p-button primary">
            {{ ocupado ? "Salvando…" : "Salvar escola" }}</button
          ><button type="button" class="p-button" @click="aberto = false">
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
    <div class="p-stack">
      <article v-for="e in ordenadas" :key="e.id" class="p-card">
        <div class="p-section-head">
          <div>
            <h2>{{ e.nome }}</h2>
            <span class="p-badge"
              >{{
                e.arquivada
                  ? "Arquivada"
                  : e.ativo !== false
                    ? "Ativa"
                    : "Inativa"
              }}
              · {{ publicadas.has(e.id) ? "Publicada" : "Uso interno" }}</span
            >
            <p class="p-small">
              Alunos: {{ e.alunos ?? "Não informado" }} · Funcionários:
              {{ e.funcionarios ?? "Não informado" }}
            </p>
            <p class="p-small">
              Total de pessoas: {{ totalPessoas(e) ?? "Não informado" }}
            </p>
            <p v-for="a in alertasEscola(e)" :key="a" class="p-small pendencia">
              {{ a }}
            </p>
            <p class="p-small p-muted">Identificador: {{ e.id }}</p>
          </div>
          <div class="p-actions">
            <button class="p-button" :disabled="ocupado" @click="editar(e)">
              Editar informações</button
            ><button
              v-if="e.ativo === false || e.arquivada"
              class="p-button"
              :disabled="ocupado"
              @click="situar(e, 'reativar')"
            >
              Reativar</button
            ><button
              v-else
              class="p-button"
              :disabled="ocupado"
              @click="situar(e, 'desativar')"
            >
              Desativar</button
            ><button
              v-if="!e.arquivada"
              class="p-button danger"
              :disabled="ocupado"
              @click="situar(e, 'arquivar')"
            >
              Remover / arquivar
            </button>
          </div>
        </div>
        <details>
          <summary>Ver informações da escola</summary>
          <dl class="detalhes">
            <div v-for="(campo, key) in CAMPOS_ESCOLA" :key="key">
              <dt>{{ campo[0] }}</dt>
              <dd>{{ e[key] === 0 ? 0 : e[key] || "Não informado" }}</dd>
            </div>
          </dl>
        </details>
      </article>
      <p v-if="!ordenadas.length && !consulta.carregando.value" class="p-empty">
        Nenhuma escola cadastrada.
      </p>
    </div>
  </section>
</template>
<script setup>
import ImportarEscolas from "../../components/admin/ImportarEscolas.vue";
import {
  CAMPOS_ESCOLA,
  totalPessoas,
  alertasEscola,
  normalizar,
} from "../../../shared/importacao-escolas.mjs";
import { ehDeposito } from "../../utils/estoque";
import {
  salvarFichaEscola,
  alterarSituacaoEscola,
  PUBLICAVEIS,
} from "../../services/escolasCadastro";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
import { ref, reactive, computed } from "vue";
import { collection } from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { usePortal } from "../../composables/usePortal";

import { mensagemErro } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const grupos = [
  { titulo: "Identificação e gestão", campos: ["inep", "responsavel"] },
  { titulo: "Pessoas na escola", campos: ["alunos", "funcionarios"] },
  {
    titulo: "Endereço e localização",
    campos: ["endereco", "bairro", "zona", "latitude", "longitude"],
  },
  {
    titulo: "Contato e funcionamento",
    campos: ["contato", "email", "etapas", "turnos", "horario"],
  },
  { titulo: "Anotações internas", campos: ["observacoes"] },
];
const consulta = useColecao(() => collection(db, "escolas")),
  { escolas } = usePortal(),
  publicadas = computed(() => new Set(escolas.dados.value.map((e) => e.id))),
  todas = computed(() => consulta.dados.value.filter((e) => !ehDeposito(e.id))),
  busca = ref(""),
  situacao = ref(""),
  autorizados = ref([]),
  ordenadas = computed(() =>
    todas.value
      .filter(
        (e) =>
          normalizar(e.nome).includes(normalizar(busca.value)) &&
          (!situacao.value ||
            (situacao.value === "ativas" &&
              e.ativo !== false &&
              !e.arquivada) ||
            (situacao.value === "inativas" && e.ativo === false) ||
            (situacao.value === "arquivadas" && e.arquivada) ||
            (situacao.value === "pendentes" && alertasEscola(e).length)),
      )
      .sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
      ),
  ),
  aberto = ref(false),
  ocupado = ref(false),
  publicar = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  form = reactive({});
useSaidaSegura(() => aberto.value);
const validarContagens = computed(() => ({
  alunos:
    form.alunos === "" || form.alunos == null ? null : Number(form.alunos),
  funcionarios:
    form.funcionarios === "" || form.funcionarios == null
      ? null
      : Number(form.funcionarios),
}));
function editar(e = {}) {
  if (
    aberto.value &&
    !window.confirm("Descartar os dados do formulário aberto?")
  )
    return;
  const p = escolas.dados.value.find((p) => p.id === e.id) || {};
  Object.keys(form).forEach((k) => delete form[k]);
  Object.assign(form, {
    id: e.id || "",
    nome: e.nome || "",
    ativo: e.ativo !== false,
    arquivada: e.arquivada === true,
    versao: e.versao || 0,
    ...Object.fromEntries(
      Object.keys(CAMPOS_ESCOLA)
        .filter((k) => k !== "nome")
        .map((k) => [k, e[k] ?? p[k] ?? ""]),
    ),
    endereco: e.endereco ?? p.endereco ?? "",
    contato: e.contato ?? p.contato ?? "",
    etapas: e.etapas ?? p.etapas ?? "",
    horario: e.horario ?? p.horario ?? "",
    sobre: e.sobre ?? p.sobre ?? "",
  });
  publicar.value = publicadas.value.has(e.id);
  autorizados.value = PUBLICAVEIS.filter(
    (k) => p[k] !== undefined && p[k] !== "",
  );
  aberto.value = true;
  erro.value = "";
  window.scrollTo({ top: 0 });
}
async function salvar() {
  if (ocupado.value) return;
  ocupado.value = true;
  erro.value = "";
  try {
    await salvarFichaEscola(form, publicar.value, autorizados.value);
    aberto.value = false;
    mensagem.value =
      "Escola salva. Os dados existentes de estoque e vistorias foram preservados.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
async function situar(e, acao) {
  if (aberto.value) {
    erro.value =
      "Salve ou cancele o formulário aberto antes de alterar a situação de uma escola.";
    return;
  }
  if (ocupado.value) return;
  const texto =
    acao === "arquivar"
      ? "Remover esta escola da operação ativa por arquivamento? Nenhum cadastro, aluno, usuário, estoque, vistoria ou histórico será apagado. A escola poderá ser reativada."
      : acao === "desativar"
        ? "Desativar a escola e retirar a ficha pública, preservando os vínculos e históricos?"
        : "Reativar a escola? A publicação pública deverá ser autorizada novamente.";
  if (!window.confirm(texto)) return;
  ocupado.value = true;
  erro.value = "";
  try {
    await alterarSituacaoEscola(e, acao);
    mensagem.value =
      acao === "reativar"
        ? "Escola reativada com o mesmo identificador."
        : "Escola retirada das seleções ativas; dados e histórico preservados.";
  } catch (f) {
    erro.value = mensagemErro(f);
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
h1 {
  font-size: clamp(1.4rem, 3vw, 1.95rem);
}
article h2 {
  font-size: 1.15rem;
}

fieldset {
  border: 0;
}
form {
  margin-block: 1.5rem;
}
.filtros {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-block: 1rem;
}
.filtros > label {
  flex: 1 1 220px;
}
.indicadores {
  margin-block: 1rem;
}
.indicadores strong {
  display: block;
  font-size: 1.5rem;
}
.publicacao-campos {
  display: grid;
  gap: 0.5rem;
}
.detalhes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 0.8rem;
}
.detalhes dt {
  font-size: 0.8rem;
  color: var(--p-muted);
}
.detalhes dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.pendencia {
  color: var(--p-muted);
}
.form-grupo {
  display: grid;
  gap: 0.7rem;
  border-top: 1px solid var(--p-border);
  padding-top: 1rem;
}
.form-grupo h3 {
  font-size: 1rem;
  margin: 0;
}
</style>
