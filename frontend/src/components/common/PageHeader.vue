<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="page-header">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 28px;
}

.page-header > div:first-child {
  min-width: 0;
}

h1 {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-main);
  font-family: var(--font-apple-display);
  font-size: 42px;
  font-weight: 720;
  line-height: 1.1;
  letter-spacing: 0;
}

p {
  max-width: 720px;
  margin: 14px 0 0;
  color: var(--text-secondary);
  font-family: var(--font-apple-text);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.55;
}

.page-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14px;
  padding-top: 28px;
}

@media (max-width: 760px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
  }

  h1 {
    font-size: 28px;
  }

  p {
    margin-top: 10px;
    font-size: 14px;
  }

  .page-actions {
    width: 100%;
    justify-content: flex-start;
    gap: 10px;
    padding-top: 0;
  }

  .page-actions :deep(a),
  .page-actions :deep(.n-button) {
    min-width: 0;
  }
}

@media (max-width: 420px) {
  h1 {
    font-size: 26px;
  }

  .page-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .page-actions :deep(.n-button) {
    width: 100%;
  }
}
</style>
