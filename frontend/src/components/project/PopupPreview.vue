<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PopupLevel } from '@/api/types'

const props = defineProps<{
  popupEnabled: boolean
  popupLevel: PopupLevel
  popupTitle: string
  popupContent: string
}>()

const { t, locale } = useI18n()

const levelLabel = computed(() => {
  locale.value
  const map: Record<PopupLevel, string> = {
    info: t('popupLevel.info'),
    warning: t('popupLevel.warning'),
    danger: t('popupLevel.danger'),
  }

  return map[props.popupLevel]
})
</script>

<template>
  <div class="preview-shell">
    <div v-if="!popupEnabled" class="disabled-preview">{{ t('popupPreview.disabled') }}</div>
    <div v-else class="popup-preview" :class="popupLevel">
      <div class="preview-label">{{ levelLabel }}</div>
      <h4>{{ popupTitle || t('popupPreview.defaultTitle') }}</h4>
      <p>{{ popupContent || t('popupPreview.defaultContent') }}</p>
      <button type="button">{{ t('popupPreview.confirm') }}</button>
    </div>
  </div>
</template>

<style scoped>
.preview-shell {
  padding: 18px;
  background: #f7f7f8;
  border: 1px solid var(--border-soft);
  border-radius: 20px;
}

.disabled-preview {
  display: grid;
  min-height: 144px;
  place-items: center;
  color: var(--text-secondary);
  background: #fff;
  border: 1px dashed var(--border-soft);
  border-radius: 18px;
}

.popup-preview {
  max-width: 420px;
  margin: 0 auto;
  padding: 22px;
  background: #fff;
  border: 1px solid var(--border-soft);
  border-top: 4px solid #4b83f1;
  border-radius: 22px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.12);
}

.popup-preview.warning {
  border-top-color: #ff9f0a;
}

.popup-preview.danger {
  border-top-color: #ff453a;
}

.preview-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

h4 {
  margin: 8px 0 8px;
  color: var(--text-main);
  font-size: 18px;
}

p {
  margin: 0;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

button {
  margin-top: 18px;
  padding: 8px 16px;
  color: #fff;
  background: #1d1d1f;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
}

@media (max-width: 560px) {
  .preview-shell {
    padding: 12px;
    border-radius: 16px;
  }

  .disabled-preview {
    min-height: 112px;
    border-radius: 14px;
  }

  .popup-preview {
    padding: 18px;
    border-radius: 16px;
  }

  h4 {
    font-size: 16px;
  }
}
</style>
