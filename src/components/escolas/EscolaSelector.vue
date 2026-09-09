<template>
  <div class="escola-selector">
    <label>
      <span>Escola</span>
      <select
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value)"
      >
        <option value="" disabled>Selecione uma escola</option>
        <option v-for="e in escolas" :key="e.id" :value="e.id">
          {{ e.nome }}
        </option>
      </select>
    </label>
  </div>
</template>

<script setup>
defineProps({
  escolas: { type: Array, default: () => [] },
  modelValue: { type: String, default: "" },
});
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.escola-selector label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--cor-texto-suave, #52606d);
}
.escola-selector select {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--cor-borda, #d9dee3);
  border-radius: 8px;
  font-size: 0.9rem;
  min-width: 220px;
}
</style>
