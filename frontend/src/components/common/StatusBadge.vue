<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectStatus } from '@/api/types'

const props = defineProps<{
  status?: ProjectStatus | null
}>()

const { t, locale } = useI18n()

const config = computed(() => {
  locale.value
  const map: Record<ProjectStatus, { label: string; className: string }> = {
    active: { label: t('status.active'), className: 'active' },
    grace: { label: t('status.grace'), className: 'grace' },
    expired: { label: t('status.expired'), className: 'expired' },
    suspended: { label: t('status.suspended'), className: 'suspended' },
  }

  return props.status ? map[props.status] : { label: t('common.noStatus'), className: 'unknown' }
})
</script>

<template>
  <span class="status-badge" :class="config.className">{{ config.label }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 28px;
  padding: 0 13px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.active {
  color: var(--success-text);
  background: var(--success-bg);
}

.grace {
  color: var(--warning-text);
  background: var(--warning-bg);
}

.expired {
  color: var(--danger-text);
  background: var(--danger-bg);
}

.suspended {
  color: var(--neutral-text);
  background: var(--neutral-bg);
}

.unknown {
  color: var(--neutral-text);
  background: var(--neutral-bg);
}
</style>
