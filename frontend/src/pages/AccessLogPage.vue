<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { RefreshCcw, Search } from 'lucide-vue-next'
import { NEllipsis, NTag, NTooltip, type DataTableColumns, type PaginationProps } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getAccessLogs } from '@/api/logs'
import type { AccessLog, AccessLogParams, ProjectStatus } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const errorText = ref('')
const logs = ref<AccessLog[]>([])
const total = ref(0)
const { t, locale } = useI18n()

type AccessLogFilterState = {
  projectId: string
  slug: string
  publicKey: string
  requestDomain: string
  ip: string
  origin: string
  referer: string
  userAgent: string
  message: string
  effectiveStatus: ProjectStatus | null
  allowed: boolean | null
  createdAtRange: [number, number] | null
  page: number
  pageSize: number
}

const filters = reactive({
  projectId: '',
  slug: '',
  publicKey: '',
  requestDomain: '',
  ip: '',
  origin: '',
  referer: '',
  userAgent: '',
  message: '',
  effectiveStatus: null as ProjectStatus | null,
  allowed: null as boolean | null,
  createdAtRange: null as [number, number] | null,
  page: 1,
  pageSize: 20,
} satisfies AccessLogFilterState)

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
    { label: t('logs.allowedAll'), value: 'all' },
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

const textFilterValues = computed(() => [
  filters.projectId,
  filters.slug,
  filters.publicKey,
  filters.requestDomain,
  filters.ip,
  filters.origin,
  filters.referer,
  filters.userAgent,
  filters.message,
])

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
  { title: 'ID', key: 'id', width: 80 },
  { title: 'slug', key: 'slug', width: 112 },
  { title: 'requestDomain', key: 'requestDomain', width: 178, render: (row) => row.requestDomain || '-' },
  { title: 'origin', key: 'origin', width: 132, render: (row) => h(NEllipsis, null, { default: () => row.origin || '-' }) },
  { title: 'referer', key: 'referer', width: 150, render: (row) => h(NEllipsis, null, { default: () => row.referer || '-' }) },
  { title: 'ip', key: 'ip', width: 150, render: (row) => row.ip || '-' },
  {
    title: 'userAgent',
    key: 'userAgent',
    width: 306,
    render: (row) =>
      h(NTooltip, null, {
        trigger: () => h('span', { class: 'truncate-cell' }, row.userAgent || '-'),
        default: () => row.userAgent || '-',
      }),
  },
  {
    title: t('common.status'),
    key: 'effectiveStatus',
    width: 108,
    render: (row) => h(StatusBadge, { status: row.effectiveStatus }),
  },
  {
    title: 'allowed',
    key: 'allowed',
    width: 118,
    render: (row) =>
      h(NTag, { type: row.allowed ? 'success' : 'error', bordered: false, round: true }, () =>
        row.allowed ? t('common.allowed') : t('common.denied'),
      ),
  },
  { title: 'message', key: 'message', width: 136, render: (row) => row.message || '-' },
  { title: 'createdAt', key: 'createdAt', width: 174, render: (row) => formatDateTime(row.createdAt) },
  ]
})

let filterTimer: number | null = null
let logRequestId = 0

function trimFilter(value: string) {
  const trimmed = value.trim()
  return trimmed || undefined
}

function formatDateTimeQuery(value: number) {
  return dayjs(value).format('YYYY-MM-DDTHH:mm:ssZ')
}

function buildParams(): AccessLogParams {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    projectId: trimFilter(filters.projectId),
    slug: trimFilter(filters.slug),
    publicKey: trimFilter(filters.publicKey),
    requestDomain: trimFilter(filters.requestDomain),
    ip: trimFilter(filters.ip),
    origin: trimFilter(filters.origin),
    referer: trimFilter(filters.referer),
    userAgent: trimFilter(filters.userAgent),
    message: trimFilter(filters.message),
    effectiveStatus: filters.effectiveStatus || undefined,
    allowed: filters.allowed === null ? undefined : String(filters.allowed) as 'true' | 'false',
    createdAtFrom: filters.createdAtRange?.[0] ? formatDateTimeQuery(filters.createdAtRange[0]) : undefined,
    createdAtTo: filters.createdAtRange?.[1] ? formatDateTimeQuery(filters.createdAtRange[1]) : undefined,
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
  if (filterTimer) {
    window.clearTimeout(filterTimer)
  }
})

function resetFilters() {
  Object.assign(filters, {
    projectId: '',
    slug: '',
    publicKey: '',
    requestDomain: '',
    ip: '',
    origin: '',
    referer: '',
    userAgent: '',
    message: '',
    effectiveStatus: null,
    allowed: null,
    createdAtRange: null,
    page: 1,
  })
}

watch(
  textFilterValues,
  () => {
    filters.page = 1
    if (filterTimer) window.clearTimeout(filterTimer)
    filterTimer = window.setTimeout(() => void loadLogs(), 320)
  },
)

watch(
  () => [filters.effectiveStatus, filters.allowed, filters.createdAtRange?.[0] ?? null, filters.createdAtRange?.[1] ?? null],
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

    <section class="section-card filters access-log-filters">
      <n-input v-model:value="filters.projectId" class="filter-project-id" clearable placeholder="projectId">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-input v-model:value="filters.slug" class="filter-slug" clearable :placeholder="t('logs.slugFilter')">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-input v-model:value="filters.publicKey" class="filter-public-key" clearable placeholder="publicKey" />
      <n-input v-model:value="filters.requestDomain" class="filter-request-domain" clearable placeholder="requestDomain: example.com" />
      <n-input v-model:value="filters.ip" class="filter-ip" clearable placeholder="ip" />
      <n-input v-model:value="filters.origin" class="filter-origin" clearable placeholder="origin">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-input v-model:value="filters.referer" class="filter-referer" clearable placeholder="referer">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-input v-model:value="filters.userAgent" class="filter-user-agent" clearable placeholder="userAgent">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-input v-model:value="filters.message" class="filter-message" clearable placeholder="message">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-select v-model:value="filters.effectiveStatus" class="filter-status" clearable placeholder="effectiveStatus" :options="statusOptions" />
      <n-select
        v-model:value="allowedValue"
        class="filter-allowed"
        :options="allowedOptions"
      />
      <n-date-picker
        v-model:value="filters.createdAtRange"
        class="filter-date-range"
        type="datetimerange"
        clearable
        start-placeholder="createdAtFrom"
        end-placeholder="createdAtTo"
      />
      <n-button class="filter-reset" secondary @click="resetFilters">
        <span class="icon-button-content">
          <RefreshCcw :size="15" />
          {{ t('common.reset') }}
        </span>
      </n-button>
    </section>

    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>

    <section class="table-shell access-log-table-shell">
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
          :scroll-x="1644"
        />
      </template>
    </section>
  </div>
</template>

<style scoped>
.page-stack {
  gap: 30px;
}

.page-stack :deep(.page-header) {
  gap: 18px;
}

.page-stack :deep(.page-header h1) {
  font-size: 44px;
  font-weight: 780;
  line-height: 1.06;
}

.page-stack :deep(.page-header p) {
  margin-top: 14px;
  color: #69707d;
  font-size: 16px;
  line-height: 1.45;
}

.access-log-filters {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px 14px;
  align-items: center;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.82)),
    #ffffff;
  border: 1px solid rgba(29, 29, 31, 0.08);
  border-radius: 14px;
  box-shadow:
    0 22px 48px rgba(15, 23, 42, 0.055),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px);
}

.filter-project-id,
.filter-slug,
.filter-public-key {
  grid-column: span 2;
}

.filter-request-domain,
.filter-ip {
  grid-column: span 3;
}

.filter-origin,
.filter-referer,
.filter-user-agent,
.filter-message,
.filter-status,
.filter-allowed {
  grid-column: span 2;
}

.filter-date-range {
  grid-column: span 8;
}

.filter-reset {
  grid-column: span 4;
}

.access-log-filters :deep(.n-input),
.access-log-filters :deep(.n-base-selection),
.access-log-filters :deep(.n-button) {
  --n-height: 48px !important;
  min-height: 48px;
  font-size: 14px;
}

.access-log-filters :deep(.n-input-wrapper),
.access-log-filters :deep(.n-base-selection) {
  border-radius: 10px !important;
}

.access-log-filters :deep(.n-input) {
  --n-border: 1px solid rgba(29, 29, 31, 0.12) !important;
  --n-border-hover: 1px solid rgba(29, 29, 31, 0.2) !important;
  --n-border-focus: 1px solid rgba(29, 29, 31, 0.32) !important;
  --n-box-shadow-focus: 0 0 0 3px rgba(0, 113, 227, 0.08) !important;
  --n-color: rgba(255, 255, 255, 0.76) !important;
  --n-color-focus: #ffffff !important;
  --n-placeholder-color: #8a92a0 !important;
  --n-text-color: #1d1d1f !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.access-log-filters :deep(.n-base-selection) {
  --n-border: 1px solid rgba(29, 29, 31, 0.12) !important;
  --n-border-hover: 1px solid rgba(29, 29, 31, 0.2) !important;
  --n-border-active: 1px solid rgba(29, 29, 31, 0.32) !important;
  --n-border-focus: 1px solid rgba(29, 29, 31, 0.32) !important;
  --n-box-shadow-active: 0 0 0 3px rgba(0, 113, 227, 0.08) !important;
  --n-box-shadow-focus: 0 0 0 3px rgba(0, 113, 227, 0.08) !important;
  --n-color: rgba(255, 255, 255, 0.76) !important;
  --n-color-active: #ffffff !important;
  --n-placeholder-color: #8a92a0 !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.access-log-filters :deep(.n-date-picker) {
  width: 100%;
}

.filter-date-range :deep(.n-input__input) {
  text-align: center;
}

.filter-date-range :deep(.n-date-picker-icon) {
  color: #7c8490;
}

.filter-reset {
  --n-border: 1px solid transparent !important;
  --n-border-hover: 1px solid rgba(29, 29, 31, 0.1) !important;
  --n-border-pressed: 1px solid rgba(29, 29, 31, 0.12) !important;
  --n-color: rgba(245, 245, 247, 0.96) !important;
  --n-color-hover: #eeeeef !important;
  --n-color-pressed: #e8e8ea !important;
  --n-text-color: #1d1d1f !important;
  --n-text-color-hover: #1d1d1f !important;
  --n-text-color-pressed: #1d1d1f !important;
  border-radius: 10px !important;
  font-weight: 700;
}

.filter-reset :deep(.icon-button-content) {
  justify-content: center;
  width: 100%;
}

.access-log-table-shell {
  min-height: 468px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(29, 29, 31, 0.08);
  border-radius: 14px;
  box-shadow: 0 28px 58px rgba(15, 23, 42, 0.06);
}

.desktop-log-table :deep(.n-data-table-th) {
  height: 52px;
  color: #687081;
  background: rgba(251, 251, 253, 0.96);
  font-size: 13px;
  font-weight: 650;
}

.desktop-log-table :deep(.n-data-table-td) {
  height: 60px;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.96);
  font-size: 14px;
  font-weight: 500;
}

.desktop-log-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: #fbfbfd;
}

.desktop-log-table :deep(.n-data-table-th),
.desktop-log-table :deep(.n-data-table-td) {
  border-color: rgba(29, 29, 31, 0.07);
}

.desktop-log-table :deep(.n-data-table-td:first-child),
.desktop-log-table :deep(.n-data-table-th:first-child) {
  padding-left: 22px;
}

.desktop-log-table :deep(.n-tag) {
  min-width: 54px;
  justify-content: center;
  --n-height: 28px !important;
  --n-border-radius: 999px !important;
  font-weight: 700;
}

.desktop-log-table :deep(.status-badge) {
  min-width: 54px;
  height: 28px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 700;
}

.desktop-log-table :deep(.n-pagination) {
  padding: 18px 20px 18px;
}

.mobile-log-list {
  display: none;
}

@media (max-width: 820px) {
  .page-stack :deep(.page-header h1) {
    font-size: 32px;
  }

  .access-log-filters {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 14px;
  }

  .filter-project-id,
  .filter-slug,
  .filter-public-key,
  .filter-request-domain,
  .filter-ip,
  .filter-origin,
  .filter-referer,
  .filter-user-agent,
  .filter-message,
  .filter-status,
  .filter-allowed,
  .filter-date-range,
  .filter-reset {
    grid-column: auto;
  }

  .access-log-table-shell {
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
