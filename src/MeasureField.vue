<script setup lang="ts">
defineProps<{ id: string; label: string; modelValue: string; unit?: string; hint?: string; error?: string; soft?: boolean; unknown?: boolean; integer?: boolean; required?: boolean; disabled?: boolean; list?: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>
<template>
  <div class="field" :class="{ 'has-error': error && !soft, 'has-warning': error && soft }">
    <label :for="id">{{ label }} <span v-if="required" class="required" aria-hidden="true">*</span></label>
    <div class="input-wrap">
      <input :id="id" :value="modelValue" :disabled="disabled" :list="list" type="text" :inputmode="integer ? 'numeric' : 'decimal'" maxlength="30" autocomplete="off" spellcheck="false"
        :aria-required="required || undefined" :aria-invalid="!!error" :aria-describedby="`${id}-hint${error ? ` ${id}-error` : ''}`"
        :placeholder="unknown ? '可留空或填未知' : '请输入'" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)">
      <span v-if="unit" class="unit">{{ unit }}</span>
    </div>
    <div :id="`${id}-hint`" class="field-hint">{{ hint || (unknown ? '未知不会阻止基本评估' : '\u00a0') }}</div>
    <div v-if="error" :id="`${id}-error`" class="field-hint" :class="soft ? 'warning-text' : 'error-text'">{{ error }}</div>
  </div>
</template>
