<template>
  <section aria-label="Comprovantes da entrega">
    <p>
      Até 6 comprovantes. As imagens são reduzidas antes do envio; PDF até 2 MB.
    </p>
    <div class="foto-acoes">
      <label
        >Tirar foto<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          :disabled="disabled || preparando"
          @change="selecionar"
      /></label>
      <label
        >Adicionar fotos ou PDF<input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          :disabled="disabled || preparando"
          @change="selecionar"
      /></label>
    </div>
    <p v-if="erro" role="alert">{{ erro }}</p>
    <p v-if="preparando" role="status">Preparando imagem…</p>
    <ul class="fotos-lista">
      <li v-for="(f, n) in modelValue" :key="f.id">
        <a
          :href="f.preview"
          target="_blank"
          rel="noopener"
          :aria-label="`Visualizar comprovante ${n + 1}`"
          ><img
            v-if="f.mime.startsWith('image/')"
            :src="f.preview"
            :alt="`Prévia do comprovante ${n + 1}`"
          /><span v-else>Visualizar PDF</span></a
        >
        <p role="status">{{ f.estado }}</p>
        <button
          type="button"
          :disabled="disabled || preparando"
          @click="remover(n)"
        >
          Remover / substituir
        </button>
      </li>
    </ul>
  </section>
</template>
<script setup>
import { ref, onUnmounted } from "vue";
import { prepararFoto } from "../../services/fotosEntrega";
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue", "preparando"]);
const erro = ref(""),
  preparando = ref(false);
async function selecionar(e) {
  preparando.value = true;
  emit("preparando", true);
  erro.value = "";
  const lista = [...props.modelValue];
  try {
    if (lista.length + e.target.files.length > 6)
      throw new Error("Selecione no máximo seis comprovantes.");
    for (const file of e.target.files) {
      const f = await prepararFoto(file);
      f.preview = URL.createObjectURL(f.blob);
      lista.push(f);
    }
  } catch (e) {
    erro.value = e.message || "Não foi possível preparar a imagem.";
  } finally {
    emit("update:modelValue", lista);
    preparando.value = false;
    emit("preparando", false);
    e.target.value = "";
  }
}
function remover(n) {
  URL.revokeObjectURL(props.modelValue[n].preview);
  emit(
    "update:modelValue",
    props.modelValue.filter((_, i) => i !== n),
  );
}
onUnmounted(() =>
  props.modelValue.forEach((f) => URL.revokeObjectURL(f.preview)),
);
</script>
<style scoped>
.foto-acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.foto-acoes label {
  display: grid;
  gap: 8px;
  min-width: 0;
}
input {
  max-width: 100%;
}
.fotos-lista {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.fotos-lista li {
  max-width: 220px;
  padding: 12px;
  border: 1px solid #cbd5d1;
  border-radius: 8px;
}
.fotos-lista img {
  width: 180px;
  height: 130px;
  object-fit: contain;
}
button {
  min-height: 44px;
  padding: 8px;
}
</style>

<style scoped>
input::file-selector-button {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid #426d59;
  border-radius: 6px;
  background: #edf4ef;
  color: #183e2b;
  font: inherit;
  cursor: pointer;
}
</style>
