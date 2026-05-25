<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeDomainList } from '@/utils/domain'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'valid-change': [value: boolean]
}>()

const { t, locale } = useI18n()
const text = ref('')
const errors = ref<string[]>([])

watch(
  () => props.modelValue,
  (value) => {
    text.value = (value || []).join('\n')
  },
  { immediate: true },
)

watch(
  [text, () => locale.value],
  ([value]) => {
    const result = normalizeDomainList(value)
    errors.value = result.errors
    emit('valid-change', result.errors.length === 0)

    if (result.errors.length === 0) {
      emit('update:modelValue', result.domains)
    }
  },
  { immediate: true },
)

function fillExample() {
  text.value = 'example.com\nwww.example.com'
}
</script>

<template>
  <div class="domain-editor">
    <div class="editor-actions">
      <n-button size="small" secondary @click="fillExample">{{ t('domain.fillExample') }}</n-button>
      <span class="hint">{{ t('domain.hint') }}</span>
    </div>

    <n-input
      v-model:value="text"
      type="textarea"
      :rows="5"
      placeholder="example.com&#10;www.example.com"
      :status="errors.length ? 'error' : undefined"
    />

    <div v-if="modelValue.length && !errors.length" class="domain-tags">
      <n-tag v-for="domain in modelValue" :key="domain" round>{{ domain }}</n-tag>
    </div>

    <div v-if="errors.length" class="errors">
      <p v-for="item in errors" :key="item">{{ item }}</p>
    </div>
  </div>
</template>

<style scoped>
.domain-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.editor-actions,
.domain-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.hint {
  color: var(--text-secondary);
  font-size: 12px;
}

.errors p {
  margin: 4px 0 0;
  color: var(--danger-text);
  font-size: 12px;
}
</style>
