<template>
  <section class="p-stack vida-admin">
    <header class="p-section-head">
      <div>
        <p class="p-eyebrow">SERVIÇOS PARA ALUNOS E FAMÍLIAS</p>
        <h1>Vida Escolar</h1>
        <p>
          Cadastre tópicos com imagens clicáveis e escolha o link de cada um.
        </p>
      </div>
      <button
        class="p-button primary"
        :disabled="ocupado || fotoOcupada"
        @click="novo"
      >
        + Adicionar tópico
      </button>
    </header>
    <EstadoConsulta :consulta="registros" />
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <p v-if="mensagem" role="status" class="p-alert success">{{ mensagem }}</p>
    <form v-if="form" class="p-card p-stack" @submit.prevent="salvar(false)">
      <div class="p-section-head">
        <h2>{{ form.versao ? "Editar tópico" : "Novo tópico" }}</h2>
        <button
          type="button"
          class="p-button"
          :disabled="ocupado || fotoOcupada"
          @click="fechar"
        >
          Fechar editor
        </button>
      </div>
      <fieldset class="p-stack" :disabled="ocupado">
        <label class="p-field"
          >Título do tópico<input
            v-model="form.titulo"
            required
            minlength="3"
            maxlength="200"
        /></label>
        <label class="p-field"
          >Descrição (opcional)<textarea
            v-model="form.resumo"
            maxlength="800"
            rows="3"
          />
        </label>
        <label class="p-field"
          >Link ao clicar na imagem<input
            v-model="form.url"
            maxlength="2000"
            placeholder="https://exemplo.com.br ou /caminho-do-site"
          /><small
            >Use um endereço HTTPS completo ou um caminho interno começando com
            /. Links externos abrem em outra aba.</small
          ></label
        >
        <label class="p-field"
          >Descrição da imagem para acessibilidade<input
            v-model="form.imagemAlt"
            maxlength="200"
            placeholder="Descreva o conteúdo da imagem"
        /></label>
        <FotoPublicacao
          :key="form.id"
          v-model="form.imagemUrl"
          :conteudo-id="form.id"
          tipo="servico"
          :alt="form.imagemAlt"
          :disabled="ocupado"
          @ocupado="fotoOcupada = $event"
          @pendente="fotoPendente = $event"
        />
        <label class="p-field"
          >Ou URL pública da imagem (HTTPS)<input
            v-model="form.imagemUrl"
            :disabled="fotoOcupada || fotoPendente"
            maxlength="2000"
            placeholder="https://…"
        /></label>
        <label class="p-field"
          >Ordem de exibição<input
            v-model.number="form.ordem"
            type="number"
            min="0"
            max="9999"
          /><small>Os números menores aparecem primeiro.</small></label
        >
        <details>
          <summary>Prévia do tópico</summary>
          <div class="p-stack previa">
            <img
              v-if="urlSegura(form.imagemUrl, false)"
              :src="urlSegura(form.imagemUrl, false)"
              :alt="form.imagemAlt || form.titulo"
            />
            <h3>{{ form.titulo }}</h3>
            <p>{{ form.resumo }}</p>
            <p class="p-small">
              Destino: {{ form.url || "Ainda não informado" }}
            </p>
          </div>
        </details>
        <label class="p-check"
          ><input v-model="revisado" type="checkbox" />Conferi a imagem, o link
          de destino e as informações para publicação.</label
        >
        <div class="p-actions">
          <button class="p-button" :disabled="fotoOcupada || fotoPendente">
            {{ ocupado ? "Salvando…" : "Salvar rascunho" }}</button
          ><button
            type="button"
            class="p-button primary"
            :disabled="!revisado || ocupado || fotoOcupada || fotoPendente"
            @click="salvar(true)"
          >
            Publicar tópico
          </button>
        </div>
      </fieldset>
    </form>
    <template v-else
      ><article v-for="t in topicos" :key="t.id" class="p-card p-section-head">
        <div>
          <span class="p-badge">{{
            t.publicado ? "Tem versão pública" : "Rascunho"
          }}</span>
          <h2>{{ t.titulo }}</h2>
          <p class="p-small">
            Ordem: {{ t.ordem }} · {{ t.url || "Link pendente" }}
          </p>
        </div>
        <div class="p-actions">
          <button class="p-button" :disabled="ocupado" @click="editar(t)">
            Editar tópico</button
          ><router-link v-if="t.publicado" class="p-button" to="/vida-escolar"
            >Ver no site</router-link
          ><button
            v-if="t.publicado"
            class="p-button danger"
            :disabled="ocupado"
            @click="retirar(t)"
          >
            Retirar do site
          </button>
        </div>
      </article>
      <p v-if="!topicos.length && !registros.carregando.value" class="p-empty">
        Nenhum tópico cadastrado. Clique em “Adicionar tópico” para começar.
      </p></template
    >
  </section>
</template>
<script setup>
import { ref, computed, watch } from "vue";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useColecao } from "../../composables/useColecao";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
import { salvarConteudo, retirarPublicacao } from "../../portal/editorial";
import { urlSegura, mensagemErro, dataHoje } from "../../portal/validacao";
import FotoPublicacao from "../../components/admin/FotoPublicacao.vue";
import EstadoConsulta from "../../components/portal/EstadoConsulta.vue";
const registros = useColecao(() =>
  query(collection(db, "conteudos"), where("tipo", "==", "servico")),
);
const topicos = computed(() =>
  registros.dados.value
    .filter((c) => c.categoria === "vida-escolar")
    .slice()
    .sort(
      (a, b) =>
        (a.ordem || 0) - (b.ordem || 0) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    ),
);
const form = ref(null),
  ocupado = ref(false),
  fotoOcupada = ref(false),
  fotoPendente = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  revisado = ref(false);
watch(form, () => (revisado.value = false), { deep: true });
useSaidaSegura(() => !!form.value);
function novo() {
  if (form.value && !window.confirm("Descartar as alterações não salvas?"))
    return;
  const slug = "vida-escolar-" + crypto.randomUUID();
  form.value = {
    id: "servico-" + slug,
    tipo: "servico",
    categoria: "vida-escolar",
    slug,
    titulo: "",
    resumo: "",
    texto: "",
    url: "",
    imagemUrl: "",
    imagemAlt: "",
    ordem: 0,
    destaque: false,
    escolaId: "",
    dataInicio: dataHoje(),
    dataFim: "",
    local: "",
    numero: "",
  };
  fotoPendente.value = false;
  erro.value = "";
  mensagem.value = "";
}
function editar(t) {
  form.value = { ...t };
  fotoPendente.value = false;
  erro.value = "";
  mensagem.value = "";
}
function fechar() {
  if (window.confirm("Fechar e descartar as alterações não salvas?")) {
    form.value = null;
    fotoPendente.value = false;
  }
}
async function salvar(publicar) {
  if (ocupado.value || fotoOcupada.value || fotoPendente.value) return;
  erro.value = "";
  mensagem.value = "";
  if (
    publicar &&
    (!revisado.value ||
      !urlSegura(form.value.url) ||
      !urlSegura(form.value.imagemUrl, false) ||
      !form.value.imagemAlt?.trim())
  ) {
    erro.value =
      "Confira o link, envie a imagem e informe sua descrição antes de publicar.";
    return;
  }
  if (
    !Number.isInteger(form.value.ordem) ||
    form.value.ordem < 0 ||
    form.value.ordem > 9999
  ) {
    erro.value = "Informe uma ordem entre 0 e 9999.";
    return;
  }
  ocupado.value = true;
  try {
    await salvarConteudo(form.value, publicar);
    form.value = null;
    mensagem.value = publicar
      ? "Tópico publicado em Vida Escolar."
      : "Rascunho salvo. A versão pública anterior foi preservada.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
async function retirar(t) {
  if (
    !window.confirm(
      "Retirar este tópico da página Vida Escolar? O rascunho e a imagem serão preservados.",
    )
  )
    return;
  ocupado.value = true;
  erro.value = "";
  try {
    await retirarPublicacao(t);
    mensagem.value =
      "Tópico retirado do site. Você pode editá-lo e publicar novamente.";
  } catch (e) {
    erro.value = mensagemErro(e);
  } finally {
    ocupado.value = false;
  }
}
</script>
<style scoped>
.vida-admin {
  min-width: 0;
}
.vida-admin h1 {
  font-size: clamp(1.6rem, 3vw, 2.1rem);
}
.vida-admin h2 {
  font-size: 1.2rem;
}
.vida-admin fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
.vida-admin .p-card {
  min-width: 0;
  overflow-wrap: anywhere;
}
.vida-admin .p-actions {
  flex-wrap: wrap;
}
.vida-admin .p-button {
  min-height: 44px;
  white-space: normal;
}
.previa {
  margin-top: 1rem;
  max-width: 440px;
  overflow-wrap: anywhere;
}
.previa img {
  display: block;
  max-width: 100%;
  max-height: 250px;
  object-fit: contain;
}
.vida-admin summary {
  cursor: pointer;
  font-weight: 700;
}
@media (max-width: 600px) {
  .vida-admin .p-actions {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
  }
}
</style>
