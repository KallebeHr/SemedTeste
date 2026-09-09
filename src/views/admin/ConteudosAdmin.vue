<template>
  <section>
    <header class="p-section-head">
      <div>
        <p class="p-eyebrow">PUBLICAÇÃO NO PORTAL</p>
        <h1>
          {{ nutricionista ? "Cardápios mensais" : "Conteúdos e serviços" }}
        </h1>
        <p>
          Salve rascunhos e revise antes de publicar. Um rascunho não altera a
          versão que já está no portal.
        </p>
      </div>
      <button class="p-button primary" @click="novo">+ Novo conteúdo</button>
    </header>
    <label class="p-field"
      >Tipo de conteúdo<select
        aria-label="Tipo de conteúdo"
        v-model="tipo"
        :disabled="!!editando"
      >
        <option v-for="(rotulo, chave) in tipos" :key="chave" :value="chave">
          {{ rotulo }}
        </option>
      </select></label
    ><EstadoConsulta :consulta="registros" />
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <form
      v-if="editando"
      class="p-card p-stack"
      @submit.prevent="salvar(false)"
    >
      <div class="p-section-head">
        <h2>{{ form.id ? "Editar" : "Criar" }} {{ TIPOS_CONTEUDO[tipo] }}</h2>
        <button
          type="button"
          class="p-button"
          :disabled="salvando"
          @click="editando = false"
        >
          Fechar editor
        </button>
      </div>
      <fieldset class="editor-fields p-stack" :disabled="salvando">
        <div class="p-grid two">
          <label class="p-field"
            >Título<input
              aria-label="Título"
              v-model="form.titulo"
              required
              minlength="3"
              maxlength="200" /></label
          ><label v-if="tipo === 'pagina'" class="p-field">
            Destino<select
              aria-label="Destino"
              v-model="form.slug"
              required
              :disabled="!!form.id"
            >
              <option value="">Selecione</option>
              <option v-for="p in PAGINAS" :key="p[0]" :value="p[0]">
                {{ p[1] }}
              </option>
            </select></label
          ><label v-else-if="tipo === 'servico'" class="p-field">
            Identificador do serviço<input
              aria-label="Identificador do serviço"
              v-model="form.slug"
              required
              maxlength="80"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              list="servicos-editar"
              :disabled="!!form.id"
            />
            <datalist id="servicos-editar">
              <option v-for="s in SERVICOS" :key="s.id" :value="s.id">
                {{ s.titulo }}
              </option>
            </datalist>
            <small
              >Escolha um identificador existente ou crie outro, como
              “segunda-via-declaracao”. Use letras minúsculas, números e
              hífens.</small
            > </label
          ><label v-else class="p-field"
            >Categoria<select
              aria-label="Categoria"
              v-if="tipo === 'documento'"
              v-model="form.categoria"
            >
              <option value="">Geral</option>
              <option
                v-for="c in [
                  'transparencia',
                  'legislacao',
                  'planejamento',
                  'acesso-a-informacao',
                ]"
                :key="c"
              >
                {{ c }}
              </option></select
            ><input
              v-else
              v-model="form.categoria"
              maxlength="200"
              placeholder="Ex.: Educação infantil"
          /></label>
        </div>
        <label class="p-field"
          >Resumo<textarea
            aria-label="Resumo"
            v-model="form.resumo"
            maxlength="800"
            rows="2"
          /></label
        ><template v-if="tipo === 'cardapio'"
          ><div class="p-grid two">
            <label class="p-field"
              >Escola<select
                aria-label="Escola"
                v-model="form.escolaId"
                required
              >
                <option value="">Selecione a escola</option>
                <option
                  v-for="e in escolas.dados.value"
                  :key="e.id"
                  :value="e.id"
                >
                  {{ e.nome }}
                </option>
              </select></label
            ><label class="p-field"
              >Mês de referência<input
                aria-label="Mês de referência"
                v-model="form.numero"
                type="month"
                required
            /></label>
          </div>
          <p class="p-small">
            Preencha o cardápio por semana/dia e turno. Informe preparações,
            substituições e observações nutricionais. A publicação só fica
            disponível para escolas publicadas.
          </p></template
        ><label class="p-field"
          >{{ tipo === "cardapio" ? "Cardápio completo" : "Conteúdo completo"
          }}<textarea
            v-model="form.texto"
            maxlength="30000"
            rows="12"
            :required="tipo === 'cardapio'"
            :placeholder="
              tipo === 'servico'
                ? 'Quem pode solicitar, documentos necessários, etapas, prazos, custos e canal de atendimento.'
                : 'Digite o texto público. Não inclua CPFs, dados de alunos ou informações internas.'
            "
          /><small
            >Texto simples, sem HTML. {{ form.texto.length }}/30.000
            caracteres.</small
          ></label
        >
        <div class="p-grid two">
          <label v-if="tipo !== 'cardapio'" class="p-field"
            >Número / referência<input
              aria-label="Número / referência"
              v-model="form.numero"
              maxlength="200"
              placeholder="Número do edital, período ou fonte do indicador" /></label
          ><label class="p-field"
            >{{
              tipo === "cardapio"
                ? "Responsável técnico e CRN"
                : "Local / fonte"
            }}<input v-model="form.local" maxlength="200" /></label
          ><label class="p-field"
            >{{
              tipo === "edital"
                ? "Início do prazo"
                : "Data inicial / publicação"
            }}<input
              v-model="form.dataInicio"
              type="date"
              :required="tipo === 'evento'" /></label
          ><label class="p-field"
            >Data final<input
              aria-label="Data final"
              v-model="form.dataFim"
              type="date"
              :min="form.dataInicio"
          /></label>
        </div>
        <label class="p-field"
          >Endereço do documento ou serviço (opcional)<input
            aria-label="Endereço do documento ou serviço (opcional)"
            v-model="form.url"
            maxlength="2000"
            placeholder="https://… ou /caminho-do-portal"
          /><small
            >Use um link público já existente. O texto também poderá ser baixado
            em PDF, sem upload.</small
          ></label
        >
        <details>
          <summary>Imagem e destaque</summary>
          <div class="p-stack">
            <label class="p-field"
              >URL pública da imagem (HTTPS)<input
                aria-label="URL pública da imagem (HTTPS)"
                v-model="form.imagemUrl"
                type="url"
                maxlength="2000" /></label
            ><label class="p-field"
              >Descrição da imagem para acessibilidade<input
                aria-label="Descrição da imagem para acessibilidade"
                v-model="form.imagemAlt"
                maxlength="200" /></label
            ><label class="p-check"
              ><input v-model="form.destaque" type="checkbox" /> Destacar na
              página inicial (notícias)</label
            ><label class="p-field"
              >Ordem de exibição<input
                aria-label="Ordem de exibição"
                v-model.number="form.ordem"
                type="number"
                min="0"
                max="9999"
            /></label>
          </div>
        </details>
        <details>
          <summary>Prévia do texto público</summary>
          <article class="p-card">
            <h2>{{ form.titulo }}</h2>
            <p>{{ form.resumo }}</p>
            <p class="p-prose">{{ form.texto }}</p>
          </article>
        </details>
        <label class="p-check"
          ><input v-model="revisado" type="checkbox" /> Revisei o conteúdo, os
          links e a ausência de dados pessoais restritos para publicação.</label
        >
        <div class="p-actions">
          <button class="p-button" type="submit">
            {{ salvando ? "Salvando…" : "Salvar rascunho" }}</button
          ><button
            class="p-button primary"
            type="button"
            :disabled="!revisado || salvando"
            @click="salvar(true)"
          >
            Publicar no portal
          </button>
        </div>
      </fieldset>
    </form>
    <div v-else class="p-stack">
      <article v-for="c in registros.dados.value" :key="c.id" class="p-card">
        <div class="p-section-head">
          <div>
            <span class="p-badge">{{
              c.publicado ? "Tem versão pública" : "Rascunho"
            }}</span>
            <h2>{{ c.titulo }}</h2>
            <p class="p-small">Atualizado em {{ dataTexto(c.atualizadoEm) }}</p>
          </div>
          <div class="p-actions">
            <button class="p-button" @click="editar(c)">Editar</button
            ><router-link
              v-if="c.publicado"
              class="p-button"
              :to="'/publicacao/' + c.id"
              >Ver no portal</router-link
            ><button
              v-if="c.publicado"
              class="p-button danger"
              :disabled="salvando"
              @click="retirar(c)"
            >
              Retirar do portal
            </button>
          </div>
        </div>
      </article>
      <p
        v-if="!registros.dados.value.length && !registros.carregando.value"
        class="p-empty"
      >
        Nenhum registro deste tipo. Use “Novo conteúdo” para começar.
      </p>
    </div>
  </section>
</template>
<script setup>
import { ref, reactive } from "vue";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../composables/useAuth";
import { useColecao } from "../../composables/useColecao";
import { TIPOS_CONTEUDO, PAGINAS, SERVICOS } from "../../portal/catalogo";
import { salvarConteudo, retirarPublicacao } from "../../portal/editorial";
import { useSaidaSegura } from '../../composables/useSaidaSegura';
import { dataTexto, mensagemErro, dataHoje } from "../../portal/validacao";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const { pode } = useAuth(),
  nutricionista = !pode("conteudo"),
  tipos = nutricionista
    ? { cardapio: TIPOS_CONTEUDO.cardapio }
    : Object.fromEntries(
        Object.entries(TIPOS_CONTEUDO).filter(
          ([k]) => k !== "cardapio" || pode("nutricao"),
        ),
      ),
  tipo = ref(nutricionista ? "cardapio" : "noticia"),
  editando = ref(false),
  salvando = ref(false),
  revisado = ref(false),
  erro = ref(""),
  mensagem = ref("");
const registros = useColecao(
    () => query(collection(db, "conteudos"), where("tipo", "==", tipo.value)),
    tipo,
  ),
  escolas = useColecao(() => collection(db, "escolasPublicas"));
const inicial = () => ({
    tipo: tipo.value,
    titulo: "",
    resumo: "",
    texto: "",
    categoria: "",
    slug: "",
    url: "",
    imagemUrl: "",
    imagemAlt: "",
    dataInicio: dataHoje(),
    dataFim: "",
    local: "",
    numero: tipo.value === "cardapio" ? dataHoje().slice(0, 7) : "",
    destaque: false,
    ordem: 0,
    escolaId: "",
  }),
  form = reactive(inicial());
useSaidaSegura(() => editando.value);
function reset(d) {
  Object.keys(form).forEach((k) => delete form[k]);
  Object.assign(form, d);
  revisado.value = false;
  erro.value = "";
  editando.value = true;
}
function novo() {
  reset(inicial());
}
function editar(c) {
  reset({ ...c });
}
async function salvar(publicar) {
  if (salvando.value) return;
  salvando.value = true;
  erro.value = "";
  mensagem.value = "";
  try {
    await salvarConteudo(form, publicar);
    editando.value = false;
    mensagem.value = publicar
      ? "Publicação concluída. O conteúdo já está disponível no portal."
      : "Rascunho salvo. A versão pública anterior, se houver, foi preservada.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    salvando.value = false;
  }
}
async function retirar(c) {
  if (
    !window.confirm(
      "Retirar este conteúdo do portal público? O rascunho será preservado.",
    )
  )
    return;
  salvando.value = true;
  erro.value = "";
  try {
    await retirarPublicacao(c);
    mensagem.value = "Publicação retirada do portal.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>
<style scoped>
.editor-fields {
  border: 0;
  min-width: 0;
}
form {
  margin-block: 1.5rem;
}
.p-field textarea {
  min-height: 4rem;
}
details summary {
  cursor: pointer;
  margin-bottom: 1rem;
}
</style>
