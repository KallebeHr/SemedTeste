<template>
  <section class="p-stack">
    <header>
      <h1>Calendários escolares</h1>
      <p>
        Importe o JSON completo, confira os dias e eventos e publique a versão
        revisada. Alterações no rascunho só chegam ao público após a publicação.
      </p>
    </header>
    <p v-if="erro" class="p-alert error" role="alert">{{ erro }}</p>
    <p v-if="mensagem" role="status" class="p-alert">{{ mensagem }}</p>
    <fieldset :disabled="ocupado" class="p-card p-stack">
      <legend>Selecionar ou importar</legend>
      <label class="p-field"
        >Ano<input v-model.number="ano" type="number" min="2000" max="2100"
      /></label>
      <div class="p-actions">
        <button class="p-button" @click="abrir">Abrir ano</button
        ><button class="p-button" @click="criar">Criar ano em branco</button
        ><button class="p-button" @click="importar2026">
          Prévia do arquivo 2026
        </button>
      </div>
      <label class="p-field"
        >Importar calendário completo (.json, até 300 KB)<input
          type="file"
          accept=".json,application/json"
          @change="importar"
      /></label>
      <p>
        O arquivo deve incluir categorias, todos os dias do ano e os eventos com
        intervalos. O JSON de 2026 anexado já está disponível no botão acima.
        Importe um ano por vez.
      </p>
    </fieldset>
    <template v-if="dados"
      ><section class="p-card p-stack">
        <h2>
          {{ dados.ano }} · {{ dados.dias.length }} dias ·
          {{ dados.eventos.length }} eventos
        </h2>
        <p>
          Versão salva: {{ versao }}.
          {{
            alterado
              ? "Há alterações locais não salvas."
              : "Rascunho salvo ou carregado."
          }}
        </p>
        <div class="p-actions">
          <button
            class="p-button primary"
            :disabled="ocupado || !alterado"
            @click="salvar"
          >
            Conferi a prévia — salvar rascunho</button
          ><button
            class="p-button"
            :disabled="ocupado || alterado || !versao"
            @click="publicar"
          >
            Publicar versão conferida</button
          ><button class="p-button" :disabled="ocupado" @click="exportar">
            Exportar JSON
          </button>
        </div>
        <p>
          Salvar usa o ano como identificador e verifica a versão para impedir
          duplicação e sobrescrita concorrente. Uma reimportação exige confirmar
          a substituição do rascunho.
        </p>
      </section>
      <fieldset class="p-card p-stack" :disabled="ocupado">
        <legend>Editar informações oficiais</legend>
        <label class="p-field"
          >Fonte<input
            v-model="dados.fonte"
            maxlength="1000"
            @input="alterado = true" /></label
        ><label class="p-field"
          >Total de dias letivos informado no documento<input
            v-model.number="dados.totalDiasLetivos"
            type="number"
            min="0"
            max="366"
            @input="alterado = true"
        /></label>
      </fieldset>
      <fieldset class="p-card p-stack" :disabled="ocupado">
        <legend>Eventos</legend>
        <label class="p-field"
          >Selecionar evento<select v-model="eventoId" @change="editarEvento">
            <option value="">Novo evento</option>
            <option v-for="e in dados.eventos" :key="e.id" :value="e.id">
              {{ e.dataInicio }} — {{ e.titulo }}
            </option>
          </select></label
        ><label class="p-field"
          >Título<input v-model="evento.titulo" maxlength="250"
        /></label>
        <div class="p-grid">
          <label class="p-field"
            >Início<input v-model="evento.dataInicio" type="date" /></label
          ><label class="p-field"
            >Fim<input v-model="evento.dataFim" type="date"
          /></label>
        </div>
        <label class="p-field"
          >Categoria<select v-model="evento.tipo">
            <option v-for="(c, k) in categorias" :key="k" :value="k">
              {{ c.rotulo }}
            </option>
          </select></label
        ><label class="p-field"
          >Observação<textarea v-model="evento.observacao" maxlength="5000" />
        </label>
        <div class="p-actions">
          <button class="p-button" @click="aplicarEvento">
            Aplicar evento à prévia</button
          ><button
            v-if="eventoId"
            class="p-button danger"
            @click="excluirEvento"
          >
            Remover evento da prévia
          </button>
        </div>
      </fieldset>
      <fieldset v-if="dia" class="p-card p-stack" :disabled="ocupado">
        <legend>Classificação de {{ dia }}</legend>
        <label class="p-field"
          >Tipo visual do dia<select
            :value="dados.dias.find((d) => d.data === dia)?.tipoVisual"
            @change="classificar"
          >
            <option v-for="(c, k) in categorias" :key="k" :value="k">
              {{ c.rotulo }}
            </option>
          </select></label
        >
        <p>
          Selecione outro dia na grade abaixo para editar sua classificação.
        </p>
      </fieldset>
      <GradeCalendario
        :key="dados.ano"
        :calendario="dados"
        @dia="dia = $event"
      />
    </template>
  </section>
</template>
<script setup>
import { computed, ref } from "vue";
import original from "../../data/calendario2026.json";
import GradeCalendario from "../../components/calendario/GradeCalendario.vue";
import {
  BASE,
  validarCalendario,
  novoCalendario,
  atualizarVinculos,
} from "../../../shared/calendario.mjs";
import {
  lerCalendario,
  salvarCalendario,
  publicarCalendario,
} from "../../services/calendarios";
import { useSaidaSegura } from "../../composables/useSaidaSegura";
const ano = ref(2026),
  dados = ref(null),
  versao = ref(0),
  alterado = ref(false),
  ocupado = ref(false),
  erro = ref(""),
  mensagem = ref(""),
  eventoId = ref(""),
  evento = ref({}),
  dia = ref("");
useSaidaSegura(alterado);
const categorias = computed(() => ({ ...BASE, ...dados.value?.categorias }));
async function executar(fn) {
  if (ocupado.value) return;
  erro.value = "";
  mensagem.value = "";
  ocupado.value = true;
  try {
    await fn();
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
function conferirTroca() {
  return !alterado.value || window.confirm("Descartar a prévia não salva?");
}
function definir(c, v, modificado) {
  dados.value = c;
  ano.value = c.ano;
  versao.value = v;
  alterado.value = modificado;
  eventoId.value = "";
  evento.value = {};
  dia.value = "";
}
function abrir() {
  if (!conferirTroca()) return;
  executar(async () => {
    const r = await lerCalendario(ano.value, true);
    if (!r)
      throw Error(
        "Ano sem rascunho. Importe um JSON ou crie um ano em branco.",
      );
    definir(r.dados, r.versao, false);
  });
}
function criar() {
  if (!conferirTroca()) return;
  executar(async () => {
    if (!Number.isInteger(ano.value) || ano.value < 2000 || ano.value > 2100)
      throw Error("Ano inválido.");
    const r = await lerCalendario(ano.value, true);
    if (r) throw Error("Este ano já existe. Use Abrir ano.");
    definir(validarCalendario(novoCalendario(ano.value)), 0, true);
  });
}
async function preparar(c) {
  c = validarCalendario(c);
  const r = await lerCalendario(c.ano, true);
  if (
    r &&
    !window.confirm(
      `O ano ${c.ano} já possui um rascunho. Substituir a prévia por este arquivo? O calendário público só muda ao publicar.`,
    )
  )
    return;
  definir(c, r?.versao || 0, true);
  mensagem.value = "Importação validada. Confira a grade antes de salvar.";
}
function importar2026() {
  if (conferirTroca()) executar(() => preparar(original));
}
function importar(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f || !conferirTroca()) return;
  executar(async () => {
    if (f.size > 300000) throw Error("Arquivo excede 300 KB.");
    await preparar(JSON.parse(await f.text()));
  });
}
function salvar() {
  executar(async () => {
    versao.value = await salvarCalendario(dados.value, versao.value);
    alterado.value = false;
    mensagem.value =
      "Rascunho salvo com auditoria. A publicação é uma ação separada.";
  });
}
function publicar() {
  if (
    !window.confirm(
      `Publicar a versão ${versao.value} de ${dados.value.ano}? Ela ficará disponível sem login.`,
    )
  )
    return;
  executar(async () => {
    await publicarCalendario(dados.value.ano, versao.value);
    mensagem.value = "Calendário publicado com auditoria.";
  });
}
function editarEvento() {
  evento.value = JSON.parse(
    JSON.stringify(
      dados.value.eventos.find((e) => e.id === eventoId.value) || {},
    ),
  );
}
function aplicarEvento() {
  executar(async () => {
    const e = {
      ...evento.value,
      id: eventoId.value || "evento-" + crypto.randomUUID(),
      fonte: dados.value.fonte || "",
    };
    const c = JSON.parse(JSON.stringify(dados.value));
    c.eventos = c.eventos.filter((x) => x.id !== e.id);
    c.eventos.push(e);
    dados.value = validarCalendario(atualizarVinculos(c));
    alterado.value = true;
    eventoId.value = e.id;
    mensagem.value = "Evento aplicado somente à prévia.";
  });
}
function excluirEvento() {
  if (!window.confirm("Remover este evento da prévia?")) return;
  const c = JSON.parse(JSON.stringify(dados.value));
  c.eventos = c.eventos.filter((e) => e.id !== eventoId.value);
  dados.value = validarCalendario(atualizarVinculos(c));
  alterado.value = true;
  eventoId.value = "";
  evento.value = {};
}
function classificar(e) {
  const d = dados.value.dias.find((d) => d.data === dia.value);
  d.tipoVisual = e.target.value;
  d.cor = categorias.value[d.tipoVisual].cor;
  alterado.value = true;
}
function exportar() {
  const blob = new Blob([JSON.stringify(dados.value, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `calendario-${dados.value.ano}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
</script>
