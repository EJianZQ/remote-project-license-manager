<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Eye, Search } from 'lucide-vue-next'
import { NButton, NEllipsis, NTooltip, type DataTableColumns, type PaginationProps } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getActionLogs } from '@/api/logs'
import type { AdminActionLog } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { copyText } from '@/utils/clipboard'
import { formatDateTime, formatJson } from '@/utils/format'
import { useMessage } from 'naive-ui'

const message = useMessage()
const { t, locale } = useI18n()
const loading = ref(false)
const errorText = ref('')
const logs = ref<AdminActionLog[]>([])
const total = ref(0)
const detailVisible = ref(false)
const selectedLog = ref<AdminActionLog | null>(null)

const detailModalStyle = {
  width: 'min(980px, calc(100vw - 96px))',
  maxHeight: 'calc(100vh - 96px)',
}

const detailModalContentStyle = {
  maxHeight: 'calc(100vh - 180px)',
  overflowY: 'auto',
}

const filters = reactive({
  action: '',
  targetType: '',
  targetId: '',
  page: 1,
  pageSize: 20,
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

const columns = computed<DataTableColumns<AdminActionLog>>(() => {
  locale.value

  return [
  { title: 'ID', key: 'id', width: 78 },
  { title: 'action', key: 'action', minWidth: 170 },
  { title: 'targetType', key: 'targetType', width: 150 },
  { title: 'targetId', key: 'targetId', width: 120, render: (row) => row.targetId ?? '-' },
  { title: 'ip', key: 'ip', width: 130, render: (row) => row.ip || '-' },
  {
    title: 'userAgent',
    key: 'userAgent',
    width: 360,
    render: (row) =>
      h(NTooltip, null, {
        trigger: () => h(NEllipsis, { style: { maxWidth: '220px' } }, { default: () => row.userAgent || '-' }),
        default: () => row.userAgent || '-',
      }),
  },
  { title: 'createdAt', key: 'createdAt', width: 200, render: (row) => formatDateTime(row.createdAt) },
  {
    title: t('common.actions'),
    key: 'actions',
    width: 110,
    render: (row) =>
      h(
        NButton,
        { size: 'small', secondary: true, onClick: () => openDetail(row) },
        { default: () => h('span', { class: 'icon-button-content' }, [h(Eye, { size: 14 }), t('common.details')]) },
      ),
  },
  ]
})

let filterTimer: ReturnType<typeof window.setTimeout> | null = null
let logRequestId = 0

function buildParams() {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    action: filters.action.trim() || undefined,
    targetType: filters.targetType.trim() || undefined,
    targetId: filters.targetId.trim() || undefined,
  }
}

async function loadLogs() {
  const requestId = ++logRequestId
  loading.value = true
  errorText.value = ''

  try {
    const page = await getActionLogs(buildParams())
    if (requestId !== logRequestId) return

    logs.value = page.items
    total.value = page.total
  } catch (error) {
    if (requestId !== logRequestId) return

    errorText.value = error instanceof Error ? error.message : t('logs.actionLoadFailed')
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

function openDetail(log: AdminActionLog) {
  selectedLog.value = log
  detailVisible.value = true
}

async function copy(value: unknown, label: string) {
  await copyText(formatJson(value))
  message.success(t('common.copied', { label }))
}

watch(
  () => [filters.action, filters.targetType, filters.targetId],
  () => {
    filters.page = 1
    if (filterTimer) window.clearTimeout(filterTimer)
    filterTimer = window.setTimeout(() => void loadLogs(), 320)
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
    <PageHeader :title="t('logs.actionTitle')" />

    <section class="section-card filters">
      <n-input v-model:value="filters.action" clearable placeholder="action">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-input v-model:value="filters.targetType" clearable placeholder="targetType" />
      <n-input v-model:value="filters.targetId" clearable placeholder="targetId" />
    </section>

    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>

    <section class="table-shell">
      <EmptyState
        v-if="!loading && !logs.length"
        :title="t('logs.actionEmptyTitle')"
        :description="t('logs.actionEmptyDescription')"
      />
      <template v-else>
        <div class="mobile-action-list">
          <article v-for="log in logs" :key="log.id" class="mobile-action-card">
            <div class="mobile-action-card__head">
              <div>
                <h3>{{ log.action }}</h3>
                <p>{{ formatDateTime(log.createdAt) }}</p>
              </div>
              <n-button size="small" secondary @click="openDetail(log)">
                <span class="icon-button-content">
                  <Eye :size="14" />
                  {{ t('common.details') }}
                </span>
              </n-button>
            </div>
            <div class="mobile-action-meta">
              <span>ID</span>
              <strong>{{ log.id }}</strong>
              <span>target</span>
              <strong>{{ log.targetType }} / {{ log.targetId ?? '-' }}</strong>
              <span>ip</span>
              <strong>{{ log.ip || '-' }}</strong>
              <span>userAgent</span>
              <strong>{{ log.userAgent || '-' }}</strong>
            </div>
          </article>
        </div>
        <n-data-table
          class="desktop-action-table"
          remote
          :columns="columns"
          :data="logs"
          :loading="loading"
          :pagination="pagination"
          :single-line="false"
          :scroll-x="1318"
        />
      </template>
    </section>

    <n-modal
      v-model:show="detailVisible"
      preset="card"
      :title="t('logs.operationDetail')"
      class="detail-modal"
      :style="detailModalStyle"
      :content-style="detailModalContentStyle"
    >
      <div v-if="selectedLog" class="modal-stack">
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">action</div><div class="detail-value">{{ selectedLog.action }}</div></div>
          <div class="detail-item"><div class="detail-label">target</div><div class="detail-value">{{ selectedLog.targetType }} / {{ selectedLog.targetId ?? '-' }}</div></div>
        </div>

        <section>
          <div class="section-head">
            <h3>beforeJson</h3>
            <n-button size="small" secondary @click="copy(selectedLog.before, 'beforeJson')">{{ t('common.copy') }}</n-button>
          </div>
          <pre class="code-block">{{ formatJson(selectedLog.before) }}</pre>
        </section>

        <section>
          <div class="section-head">
            <h3>afterJson</h3>
            <n-button size="small" secondary @click="copy(selectedLog.after, 'afterJson')">{{ t('common.copy') }}</n-button>
          </div>
          <pre class="code-block">{{ formatJson(selectedLog.after) }}</pre>
        </section>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(220px, 0.95fr) minmax(220px, 0.95fr);
  gap: 24px;
  align-items: center;
  padding: 26px 24px;
}

.table-shell {
  min-height: 560px;
}

.mobile-action-list {
  display: none;
}

:global(.detail-modal) {
  width: min(980px, calc(100vw - 96px)) !important;
  max-height: calc(100vh - 96px);
  border-radius: 24px;
}

:global(.detail-modal .n-card__content) {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}

.modal-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

h3 {
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
}

@media (max-width: 820px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .table-shell {
    min-height: 420px;
  }

  .desktop-action-table {
    display: none;
  }

  .mobile-action-list {
    display: grid;
    gap: 12px;
    padding: 12px;
  }

  .mobile-action-card {
    min-width: 0;
    padding: 16px;
    background: #fff;
    border: 1px solid var(--border-softer);
    border-radius: 14px;
  }

  .mobile-action-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-action-card__head h3 {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--text-main);
    font-size: 16px;
  }

  .mobile-action-card__head p {
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .mobile-action-meta {
    display: grid;
    grid-template-columns: minmax(80px, auto) minmax(0, 1fr);
    gap: 10px 12px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--border-softer);
  }

  .mobile-action-meta span {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .mobile-action-meta strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--text-main);
    font-size: 13px;
  }

  :global(.detail-modal) {
    width: calc(100vw - 32px) !important;
    max-height: calc(100vh - 32px);
    border-radius: 16px;
  }

  :global(.detail-modal .n-card__content) {
    max-height: calc(100vh - 126px);
  }
}

@media (max-width: 560px) {
  .section-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-head :deep(.n-button) {
    width: 100%;
  }
}

@media (max-width: 420px) {
  .table-shell {
    min-height: 360px;
  }
}
</style>
