<template>
  <div class="p-stack">
    <p>
      Envie uma foto de capa JPEG, PNG ou WEBP. Ela será reduzida
      automaticamente e só ficará disponível ao público quando o conteúdo for
      publicado.
    </p>
    <label class="p-field"
      >Selecionar foto<input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="disabled || ocupado"
        @change="selecionar"
    /></label>
    <label class="p-field"
      >Tirar foto pelo celular<input
        type="file"
        accept="image/*"
        capture="environment"
        :disabled="disabled || ocupado"
        @change="selecionar"
    /></label>
    <p v-if="status" role="status">{{ status }}</p>
    <p v-if="erro" role="alert" class="p-alert error">{{ erro }}</p>
    <img
      v-if="previa"
      :src="previa"
      :alt="alt || 'Prévia da foto selecionada'"
      class="foto-previa"
    />
    <button
      v-if="foto && !enviada"
      type="button"
      class="p-button"
      :disabled="disabled || ocupado"
      @click="enviar"
    >
      Enviar foto selecionada
    </button>
    <button
      v-if="modelValue || foto"
      type="button"
      class="p-button"
      :disabled="disabled || ocupado"
      @click="remover"
    >
      Remover foto do conteúdo
    </button>
  </div>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from "vue";
import { auth } from "../../firebase";
import { prepararFoto } from "../../services/fotosEntrega";
const props = defineProps({
  modelValue: String,
  alt: String,
  conteudoId: String,
  tipo: String,
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue", "ocupado", "pendente"]);
const foto = ref(null),
  previa = ref(""),
  erro = ref(""),
  status = ref(""),
  ocupado = ref(false),
  enviada = ref(false);
let blobUrl = "",
  geracao = 0;
function limpar() {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = "";
  previa.value = "";
}
async function api(body, arquivo = false) {
  if (!auth.currentUser) throw new Error("Entre novamente para enviar a foto.");
  const token = await auth.currentUser.getIdToken();
  const r = await fetch("/api/publicacoes/imagem", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.erro || "Não foi possível enviar a foto.");
  }
  return arquivo ? r.blob() : r.json();
}
watch(
  () => props.modelValue,
  async (url) => {
    const atual = ++geracao;
    if (foto.value) return;
    limpar();
    if (!url) return;
    try {
      const u = new URL(url, location.origin);
      if (
        u.origin === location.origin &&
        u.pathname === "/api/publicacoes/imagem"
      ) {
        const blob = await api(
          { acao: "baixar", id: u.searchParams.get("id") },
          true,
        );
        if (atual !== geracao) return;
        blobUrl = URL.createObjectURL(blob);
        previa.value = blobUrl;
      } else previa.value = url;
    } catch {
      if (atual === geracao)
        erro.value = "Não foi possível carregar a prévia da foto.";
    }
  },
  { immediate: true },
);
function estado(v) {
  ocupado.value = v;
  emit("ocupado", v);
}
async function selecionar(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  geracao++;
  erro.value = "";
  status.value = "";
  estado(true);
  try {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Use uma foto JPEG, PNG ou WEBP.");
    const nova = await prepararFoto(file);
    limpar();
    foto.value = nova;
    enviada.value = false;
    blobUrl = URL.createObjectURL(nova.blob);
    previa.value = blobUrl;
    emit("pendente", true);
    status.value = "Confira a prévia e envie a foto antes de salvar.";
  } catch (err) {
    erro.value = err.message;
  } finally {
    estado(false);
    e.target.value = "";
  }
}
async function enviar() {
  if (!foto.value || ocupado.value) return;
  estado(true);
  erro.value = "";
  status.value = "Enviando foto…";
  try {
    const r = await api({
      acao: "enviar",
      id: foto.value.id,
      conteudoId: props.conteudoId,
      tipo: props.tipo,
      mime: foto.value.mime,
      base64: foto.value.base64,
    });
    enviada.value = true;
    emit("update:modelValue", r.url);
    emit("pendente", false);
    status.value = "Foto enviada. Informe a descrição e salve o conteúdo.";
  } catch (e) {
    erro.value = e.message;
    status.value = "";
  } finally {
    estado(false);
  }
}
function remover() {
  geracao++;
  limpar();
  foto.value = null;
  enviada.value = false;
  erro.value = "";
  status.value = "A remoção será aplicada ao salvar/publicar.";
  emit("update:modelValue", "");
  emit("pendente", false);
}
onBeforeUnmount(() => {
  geracao++;
  limpar();
});
</script>
<style scoped>
.foto-previa {
  display: block;
  max-width: 100%;
  max-height: 24rem;
  object-fit: contain;
  border-radius: 0.5rem;
}
</style>
