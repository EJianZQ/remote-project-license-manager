<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { NEllipsis, NTag, NTooltip, type DataTableColumns, type PaginationProps } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getAccessLogs } from '@/api/logs'
import type { AccessLog, ProjectStatus } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const errorText = ref('')
const logs = ref<AccessLog[]>([])
const total = ref(0)
const { t, locale } = useI18n()

const filters = reactive({
  slug: '',
  effectiveStatus: null as ProjectStatus | null,
  allowed: null as boolean | null,
  page: 1,
  pageSize: 20,
})

const statusOptions = computed<Array<{ label: string; value: ProjectStatus }>>(() => {
  locale.value
  return [
    { label: t('status.optionActive'), value: 'active' },
    { label: t('status.optionGrace'), value: 'grace' },
    { label: t('status.optionExpired'), value: 'expired' },
    { label: t('status.optionSuspended'), value: 'suspended' },
  ]
})

const allowedOptions = computed(() => {
  locale.value
  return [
    { label: t('common.all'), value: 'all' },
    { label: t('common.allowed'), value: 'true' },
    { label: t('common.denied'), value: 'false' },
  ]
})

const allowedValue = computed({
  get: () => (filters.allowed === null ? 'all' : String(filters.allowed)),
  set: (value: string) => {
    filters.allowed = value === 'all' ? null : value === 'true'
  },
})

const pagination = computed<PaginationProps>(() => ({
  page: filters.page,
  pageSize: filters.pageSize,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onUpdatePage: (page: number) => {
    filters.page = page
  },
  onUpdatePageSize: (pageSize: number) => {
    filters.pageSize = pageSize
    filters.page = 1
  },
}))

const columns = computed<DataTableColumns<AccessLog>>(() => {
  locale.value

  return [
  { title: 'ID', key: 'id', width: 56 },
  { title: 'slug', key: 'slug', width: 86 },
  { title: 'requestDomain', key: 'requestDomain', width: 140, render: (row) => row.requestDomain || '-' },
  { title: 'origin', key: 'origin', width: 92, render: (row) => h(NEllipsis, null, { default: () => row.origin || '-' }) },
  { title: 'referer', key: 'referer', width: 96, render: (row) => h(NEllipsis, null, { default: () => row.referer || '-' }) },
  { title: 'ip', key: 'ip', width: 126, render: (row) => row.ip || '-' },
  {
    title: 'userAgent',
    key: 'userAgent',
    width: 270,
    render: (row) =>
      h(NTooltip, null, {
        trigger: () => h('span', { class: 'truncate-cell' }, row.userAgent || '-'),
        default: () => row.userAgent || '-',
      }),
  },
  {
    title: t('common.status'),
    key: 'effectiveStatus',
    width: 86,
    render: (row) => h(StatusBadge, { status: row.effectiveStatus }),
  },
  {
    title: 'allowed',
    key: 'allowed',
    width: 92,
    render: (row) =>
      h(NTag, { type: row.allowed ? 'success' : 'error', bordered: false, round: true }, () =>
        row.allowed ? t('common.allowed') : t('common.denied'),
      ),
  },
  { title: 'message', key: 'message', width: 110, render: (row) => row.message || '-' },
  { title: 'createdAt', key: 'createdAt', width: 158, render: (row) => formatDateTime(row.createdAt) },
  ]
})

let slugTimer: ReturnType<typeof window.setTimeout> | null = null
let logRequestId = 0

function buildParams() {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    slug: filters.slug.trim() || undefined,
    effectiveStatus: filters.effectiveStatus || undefined,
    allowed: filters.allowed === null ? undefined : filters.allowed,
  }
}

async function loadLogs() {
  const requestId = ++logRequestId
  loading.value = true
  errorText.value = ''

  try {
    const page = await getAccessLogs(buildParams())
    if (requestId !== logRequestId) return

    logs.value = page.items
    total.value = page.total
  } catch (error) {
    if (requestId !== logRequestId) return

    errorText.value = error instanceof Error ? error.message : t('logs.accessLoadFailed')
  } finally {
    if (requestId === logRequestId) {
      loading.value = false
    }
  }
}

onBeforeUnmount(() => {
  logRequestId += 1
  if (slugTimer) {
    window.clearTimeout(slugTimer)
  }
})

watch(
  () => filters.slug,
  () => {
    filters.page = 1
    if (slugTimer) window.clearTimeout(slugTimer)
    slugTimer = window.setTimeout(() => void loadLogs(), 320)
  },
)

watch(
  () => [filters.effectiveStatus, filters.allowed],
  () => {
    filters.page = 1
    void loadLogs()
  },
)

watch(
  () => [filters.page, filters.pageSize],
  () => void loadLogs(),
)

onMounted(loadLogs)
</script>

<template>
  <div class="page-stack">
    <PageHeader :title="t('logs.accessTitle')" />

    <section class="section-card filters">
      <n-input v-model:value="filters.slug" clearable :placeholder="t('logs.slugFilter')">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-select v-model:value="filters.effectiveStatus" clearable placeholder="effectiveStatus" :options="statusOptions" />
      <n-select
        v-model:value="allowedValue"
        :options="allowedOptions"
      />
    </section>

    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>

    <section class="table-shell">
      <EmptyState
        v-if="!loading && !logs.length"
        :title="t('logs.accessEmptyTitle')"
        :description="t('logs.accessEmptyDescription')"
      />
      <template v-else>
        <div class="mobile-log-list">
          <article v-for="log in logs" :key="log.id" class="mobile-log-card">
            <div class="mobile-log-card__head">
              <div>
                <h3>{{ log.slug }}</h3>
                <p>{{ formatDateTime(log.createdAt) }}</p>
              </div>
              <n-tag :type="log.allowed ? 'success' : 'error'" :bordered="false" round>
                {{ log.allowed ? t('common.allowed') : t('common.denied') }}
              </n-tag>
            </div>
            <div class="mobile-log-meta">
              <span>ID</span>
              <strong>{{ log.id }}</strong>
              <span>requestDomain</span>
              <strong>{{ log.requestDomain || '-' }}</strong>
              <span>{{ t('common.status') }}</span>
              <StatusBadge :status="log.effectiveStatus" />
              <span>origin</span>
              <strong>{{ log.origin || '-' }}</strong>
              <span>referer</span>
              <strong>{{ log.referer || '-' }}</strong>
              <span>ip</span>
              <strong>{{ log.ip || '-' }}</strong>
              <span>message</span>
              <strong>{{ log.message || '-' }}</strong>
            </div>
          </article>
        </div>
        <n-data-table
          class="desktop-log-table"
          remote
          :columns="columns"
          :data="logs"
          :loading="loading"
          :pagination="pagination"
          :single-line="false"
          :scroll-x="1312"
        />
      </template>
    </section>
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 200px 140px;
  gap: 12px;
  align-items: center;
  padding: 26px 24px;
}

.table-shell {
  min-height: 404px;
}

.mobile-log-list {
  display: none;
}

@media (max-width: 820px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .table-shell {
    min-height: 420px;
  }

  .desktop-log-table {
    display: none;
  }

  .mobile-log-list {
    display: grid;
    gap: 12px;
    padding: 12px;
  }

  .mobile-log-card {
    min-width: 0;
    padding: 16px;
    background: #fff;
    border: 1px solid var(--border-softer);
    border-radius: 14px;
  }

  .mobile-log-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-log-card__head h3 {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--text-main);
    font-size: 16px;
  }

  .mobile-log-card__head p {
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .mobile-log-meta {
    display: grid;
    grid-template-columns: minmax(92px, auto) minmax(0, 1fr);
    gap: 10px 12px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--border-softer);
  }

  .mobile-log-meta span {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .mobile-log-meta strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--text-main);
    font-size: 13px;
  }

  .mobile-log-meta :deep(.status-badge) {
    justify-self: start;
  }
}

@media (max-width: 420px) {
  .table-shell {
    min-height: 360px;
  }
}
</style>
