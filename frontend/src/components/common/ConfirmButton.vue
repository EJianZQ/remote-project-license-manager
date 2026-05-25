<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    confirmText?: string
    positiveText?: string
    negativeText?: string
    type?: 'default' | 'primary' | 'error' | 'warning'
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    type: 'default',
    loading: false,
    disabled: false,
  },
)

const { t } = useI18n()

defineEmits<{
  confirm: []
}>()
</script>

<template>
  <n-popconfirm
    :positive-text="props.positiveText || t('common.confirm')"
    :negative-text="props.negativeText || t('common.cancel')"
    @positive-click="$emit('confirm')"
  >
    <template #trigger>
      <n-button :type="type" :loading="loading" :disabled="disabled">
        <slot />
      </n-button>
    </template>
    {{ props.confirmText || t('common.confirmAction') }}
  </n-popconfirm>
</template>
