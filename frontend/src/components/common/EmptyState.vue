<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  title?: string
  description?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="empty-state">
    <div class="empty-dot" />
    <h3>{{ title || t('common.noData') }}</h3>
    <p v-if="description">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  padding: 36px;
  text-align: center;
}

.empty-dot {
  width: 46px;
  height: 46px;
  margin-bottom: 8px;
  background: linear-gradient(145deg, #f7f7f8, #e9e9ec);
  border: 1px solid var(--border-soft);
  border-radius: 16px;
}

h3 {
  margin: 0;
  color: var(--text-main);
  font-size: 18px;
}

p {
  max-width: 380px;
  margin: 8px 0 0;
  color: var(--text-secondary);
}

@media (max-width: 560px) {
  .empty-state {
    min-height: 168px;
    padding: 24px 16px;
  }

  .empty-dot {
    width: 38px;
    height: 38px;
    border-radius: 14px;
  }

  h3 {
    font-size: 16px;
  }

  p {
    font-size: 13px;
  }
}
</style>
