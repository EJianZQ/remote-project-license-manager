<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Copy, Eye, KeyRound, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NPopconfirm,
  NSpace,
  NTag,
  useMessage,
  type DataTableColumns,
  type PaginationProps,
} from 'naive-ui'
import { deleteProject, getProjects, regenerateProjectKey } from '@/api/projects'
import type { ProjectListItem, ProjectStatus } from '@/api/types'
import { useProjectStore } from '@/stores/project'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AccessCodeModal from '@/components/project/AccessCodeModal.vue'
import { formatDateTime } from '@/utils/format'

const router = useRouter()
const message = useMessage()
const projectStore = useProjectStore()
const filters = projectStore.filters
const { t, locale } = useI18n()

const loading = ref(false)
const errorText = ref('')
const projects = ref<ProjectListItem[]>([])
const total = ref(0)
const accessModalOpen = ref(false)
const selectedProject = ref<ProjectListItem | null>(null)
const isDesktopTable = ref(true)
const tableShellRef = ref<HTMLElement | null>(null)
const tableShellWidth = ref(0)

type ResizableProjectColumnKey =
  | 'id'
  | 'name'
  | 'slug'
  | 'effectiveStatus'
  | 'status'
  | 'enabled'
  | 'expiresAt'
  | 'popupEnabled'
  | 'updatedAt'

type ProjectTableColumnKey = ResizableProjectColumnKey | 'actions'

const TABLE_COLUMN_KEYS: ProjectTableColumnKey[] = [
  'id',
  'name',
  'slug',
  'effectiveStatus',
  'status',
  'enabled',
  'expiresAt',
  'popupEnabled',
  'updatedAt',
  'actions',
]

const RESIZABLE_COLUMN_KEYS: ResizableProjectColumnKey[] = [
  'id',
  'name',
  'slug',
  'effectiveStatus',
  'status',
  'enabled',
  'expiresAt',
  'popupEnabled',
  'updatedAt',
]

const FIXED_COLUMN_WIDTHS = {
  id: 56,
  effectiveStatus: 100,
  status: 110,
  enabled: 86,
  expiresAt: 126,
  popupEnabled: 82,
  updatedAt: 140,
  actions: 384,
} as const

const COLUMN_WIDTH_LIMITS: Record<ResizableProjectColumnKey, { minWidth: number; maxWidth: number }> = {
  id: { minWidth: 48, maxWidth: 100 },
  name: { minWidth: 104, maxWidth: 520 },
  slug: { minWidth: 88, maxWidth: 420 },
  effectiveStatus: { minWidth: 92, maxWidth: 220 },
  status: { minWidth: 100, maxWidth: 220 },
  enabled: { minWidth: 76, maxWidth: 170 },
  expiresAt: { minWidth: 110, maxWidth: 260 },
  popupEnabled: { minWidth: 74, maxWidth: 170 },
  updatedAt: { minWidth: 118, maxWidth: 280 },
}

const COLUMN_FILL_WEIGHTS: Record<ResizableProjectColumnKey, number> = {
  id: 0.25,
  name: 1.8,
  slug: 1.3,
  effectiveStatus: 1,
  status: 1,
  enabled: 0.7,
  expiresAt: 1.15,
  popupEnabled: 0.7,
  updatedAt: 1.2,
}

const TABLE_RIGHT_GAP = 28

const columnWidthOverrides = reactive<Partial<Record<ResizableProjectColumnKey, number>>>({})

const statusOptions = computed<Array<{ label: string; value: ProjectStatus }>>(() => {
  locale.value
  return [
    { label: t('status.optionActive'), value: 'active' },
    { label: t('status.optionGrace'), value: 'grace' },
    { label: t('status.optionExpired'), value: 'expired' },
    { label: t('status.optionSuspended'), value: 'suspended' },
  ]
})

const enabledOptions = computed(() => {
  locale.value
  return [
    { label: t('common.all'), value: 'all' },
    { label: t('common.enabled'), value: 'true' },
    { label: t('common.disabled'), value: 'false' },
  ]
})

const enabledValue = computed({
  get: () => (filters.enabled === null ? 'all' : String(filters.enabled)),
  set: (value: string) => {
    filters.enabled = value === 'all' ? null : value === 'true'
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

const projectNameColumnWidth = computed(() =>
  getAdaptiveTextColumnWidth(projects.value, (project) => project.name, {
    min: 124,
    max: 300,
    base: 70,
    step: 7,
  }),
)

const slugColumnWidth = computed(() =>
  getAdaptiveTextColumnWidth(projects.value, (project) => project.slug, {
    min: 104,
    max: 240,
    base: 70,
    step: 7,
  }),
)

const actionsColumnWidth = computed(() => {
  locale.value
  if (locale.value === 'en-US') return 476

  return isDesktopTable.value ? FIXED_COLUMN_WIDTHS.actions : 320
})

const baseColumnWidths = computed<Record<ProjectTableColumnKey, number>>(() => ({
  id: columnWidthOverrides.id ?? FIXED_COLUMN_WIDTHS.id,
  name: columnWidthOverrides.name ?? projectNameColumnWidth.value,
  slug: columnWidthOverrides.slug ?? slugColumnWidth.value,
  effectiveStatus: columnWidthOverrides.effectiveStatus ?? FIXED_COLUMN_WIDTHS.effectiveStatus,
  status: columnWidthOverrides.status ?? FIXED_COLUMN_WIDTHS.status,
  enabled: columnWidthOverrides.enabled ?? FIXED_COLUMN_WIDTHS.enabled,
  expiresAt: columnWidthOverrides.expiresAt ?? FIXED_COLUMN_WIDTHS.expiresAt,
  popupEnabled: columnWidthOverrides.popupEnabled ?? FIXED_COLUMN_WIDTHS.popupEnabled,
  updatedAt: columnWidthOverrides.updatedAt ?? FIXED_COLUMN_WIDTHS.updatedAt,
  actions: actionsColumnWidth.value,
}))

const tableColumnWidths = computed<Record<ProjectTableColumnKey, number>>(() => {
  const widths = { ...baseColumnWidths.value }
  const baseWidth = getColumnsTotalWidth(widths)
  const preferredWidth = Math.max(
    0,
    Math.floor(tableShellWidth.value) - (isDesktopTable.value ? TABLE_RIGHT_GAP : 0),
  )
  const targetWidth = Math.max(baseWidth, preferredWidth)
  const remainingWidth = targetWidth - baseWidth

  if (remainingWidth <= 0) return widths

  const fillableKeys = RESIZABLE_COLUMN_KEYS.filter((key) => columnWidthOverrides[key] === undefined)
  const totalWeight = fillableKeys.reduce((total, key) => total + COLUMN_FILL_WEIGHTS[key], 0)

  if (!fillableKeys.length || totalWeight <= 0) {
    widths.actions += remainingWidth
    return widths
  }

  let allocatedWidth = 0
  fillableKeys.forEach((key, index) => {
    const addition =
      index === fillableKeys.length - 1
        ? remainingWidth - allocatedWidth
        : Math.floor((remainingWidth * COLUMN_FILL_WEIGHTS[key]) / totalWeight)
    widths[key] += addition
    allocatedWidth += addition
  })

  return widths
})

const tableScrollX = computed(() =>
  getColumnsTotalWidth(tableColumnWidths.value),
)

const effectiveTableScrollX = computed(() => {
  if (!tableShellWidth.value) return undefined

  return tableScrollX.value > tableShellWidth.value + 2 ? tableScrollX.value : undefined
})

const tableWidthStyle = computed(() => ({
  '--project-table-width': `${tableScrollX.value}px`,
}))

const columns = computed<DataTableColumns<ProjectListItem>>(() => {
  locale.value

  return [
  {
    title: 'ID',
    key: 'id',
    width: getColumnWidth('id'),
    ...getResizableColumnConfig('id'),
  },
  {
    title: t('projects.projectName'),
    key: 'name',
    width: getColumnWidth('name'),
    ...getResizableColumnConfig('name'),
    render: (row) => renderTextCell(row.name),
  },
  {
    title: 'slug',
    key: 'slug',
    width: getColumnWidth('slug'),
    ...getResizableColumnConfig('slug'),
    render: (row) => renderTextCell(row.slug),
  },
  {
    title: t('projects.actualStatus'),
    key: 'effectiveStatus',
    width: getColumnWidth('effectiveStatus'),
    ...getResizableColumnConfig('effectiveStatus'),
    render: (row) => h(StatusBadge, { status: row.effectiveStatus }),
  },
  {
    title: t('projects.rawStatus'),
    key: 'status',
    width: getColumnWidth('status'),
    ...getResizableColumnConfig('status'),
    render: (row) => h(StatusBadge, { status: row.status }),
  },
  {
    title: t('projects.enabledStatus'),
    key: 'enabled',
    width: getColumnWidth('enabled'),
    ...getResizableColumnConfig('enabled'),
    render: (row) =>
      h(NTag, { bordered: false, round: true, type: row.enabled ? 'success' : 'default' }, () =>
        row.enabled ? t('common.enabled') : t('common.disabled'),
      ),
  },
  {
    title: t('projects.expiresAt'),
    key: 'expiresAt',
    width: getColumnWidth('expiresAt'),
    ...getResizableColumnConfig('expiresAt'),
    render: (row) => formatDateTime(row.expiresAt),
  },
  {
    title: t('projects.popup'),
    key: 'popupEnabled',
    width: getColumnWidth('popupEnabled'),
    ...getResizableColumnConfig('popupEnabled'),
    render: (row) =>
      h(NTag, { bordered: false, round: true, type: row.popupEnabled ? 'warning' : 'default' }, () =>
        row.popupEnabled ? t('common.enabled') : t('common.closed'),
      ),
  },
  {
    title: t('projects.updatedAt'),
    key: 'updatedAt',
    width: getColumnWidth('updatedAt'),
    ...getResizableColumnConfig('updatedAt'),
    render: (row) => formatDateTime(row.updatedAt),
  },
  {
    title: t('common.actions'),
    key: 'actions',
    width: getColumnWidth('actions'),
    fixed: isDesktopTable.value ? 'right' : undefined,
    render: (row) =>
      h(NSpace, { class: 'action-button-group', size: 8, wrap: false }, () => [
        h(
          NButton,
          { size: 'small', secondary: true, onClick: () => router.push(`/projects/${row.id}`) },
          { default: () => h('span', { class: 'icon-button-content' }, [h(Eye, { size: 14 }), t('common.view')]) },
        ),
        h(
          NButton,
          { size: 'small', secondary: true, onClick: () => router.push(`/projects/${row.id}/edit`) },
          { default: () => h('span', { class: 'icon-button-content' }, [h(Pencil, { size: 14 }), t('common.edit')]) },
        ),
        h(
          NButton,
          { size: 'small', secondary: true, onClick: () => openAccessModal(row) },
          { default: () => h('span', { class: 'icon-button-content' }, [h(Copy, { size: 14 }), t('common.access')]) },
        ),
        h(
          NPopconfirm,
          {
            positiveText: t('common.regenerate'),
            negativeText: t('common.cancel'),
            onPositiveClick: () => handleRegenerate(row),
          },
          {
            trigger: () =>
              h(
                NButton,
                { size: 'small', secondary: true },
                { default: () => h('span', { class: 'icon-button-content' }, [h(KeyRound, { size: 14 }), 'Key']) },
              ),
            default: () => t('common.confirmRegenerateKey'),
          },
        ),
        h(
          NPopconfirm,
          {
            positiveText: t('common.delete'),
            negativeText: t('common.cancel'),
            onPositiveClick: () => handleDelete(row),
          },
          {
            trigger: () =>
              h(
                NButton,
                { size: 'small', type: 'error', secondary: true },
                { default: () => h('span', { class: 'icon-button-content' }, [h(Trash2, { size: 14 }), t('common.delete')]) },
              ),
            default: () => t('common.confirmDeleteProject', { name: row.name }),
          },
        ),
      ]),
  },
  ]
})

function getColumnWidth(key: ProjectTableColumnKey) {
  return tableColumnWidths.value[key]
}

function getColumnsTotalWidth(widths: Record<ProjectTableColumnKey, number>) {
  return TABLE_COLUMN_KEYS.reduce((total, key) => total + widths[key], 0)
}

function getResizableColumnConfig(key: ResizableProjectColumnKey) {
  return {
    resizable: isDesktopTable.value,
    ...COLUMN_WIDTH_LIMITS[key],
  }
}

function isResizableColumnKey(key: unknown): key is ResizableProjectColumnKey {
  return typeof key === 'string' && RESIZABLE_COLUMN_KEYS.includes(key as ResizableProjectColumnKey)
}

function handleTableColumnResize(
  _resizedWidth: number,
  limitedWidth: number,
  column: { key?: unknown },
) {
  if (!isResizableColumnKey(column.key)) return
  columnWidthOverrides[column.key] = Math.round(limitedWidth)
}

function getAdaptiveTextColumnWidth(
  items: ProjectListItem[],
  selector: (item: ProjectListItem) => string,
  options: { min: number; max: number; base: number; step: number },
) {
  const maxWeight = items.reduce((max, item) => Math.max(max, getTextWeight(selector(item))), 0)
  const width = options.base + maxWeight * options.step

  return Math.min(options.max, Math.max(options.min, Math.ceil(width)))
}

function getTextWeight(value: string) {
  return Array.from(value).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 2 : 1), 0)
}

function renderTextCell(value: string) {
  return h('span', { class: 'adaptive-text-cell', title: value }, value)
}

let keywordTimer: ReturnType<typeof window.setTimeout> | null = null
let projectRequestId = 0
let desktopMediaQuery: MediaQueryList | null = null
let tableShellResizeObserver: ResizeObserver | null = null

function buildParams() {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
    enabled: filters.enabled === null ? undefined : filters.enabled,
  }
}

async function loadProjects() {
  const requestId = ++projectRequestId
  loading.value = true
  errorText.value = ''

  try {
    const page = await getProjects(buildParams())
    if (requestId !== projectRequestId) return

    projects.value = page.items
    total.value = page.total
  } catch (error) {
    if (requestId !== projectRequestId) return

    errorText.value = error instanceof Error ? error.message : t('projects.listLoadFailed')
  } finally {
    if (requestId === projectRequestId) {
      loading.value = false
    }
  }
}

function openAccessModal(project: ProjectListItem) {
  selectedProject.value = project
  accessModalOpen.value = true
}

async function handleRegenerate(project: ProjectListItem) {
  try {
    const result = await regenerateProjectKey(project.id)
    message.success(t('common.copiedPublicKey'))
    const index = projects.value.findIndex((item) => item.id === project.id)
    if (index >= 0) {
      projects.value[index] = result.project
    }
    if (selectedProject.value?.id === project.id) {
      selectedProject.value = result.project
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('projects.regenerateFailed'))
  }
}

async function handleDelete(project: ProjectListItem) {
  try {
    await deleteProject(project.id)
    message.success(t('common.projectDeleted'))
    await loadProjects()
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('projects.deleteFailed'))
  }
}

function resetFilters() {
  projectStore.resetFilters()
  void loadProjects()
}

onBeforeUnmount(() => {
  projectRequestId += 1
  if (keywordTimer) {
    window.clearTimeout(keywordTimer)
  }
  desktopMediaQuery?.removeEventListener('change', handleDesktopMediaChange)
  tableShellResizeObserver?.disconnect()
})

function handleDesktopMediaChange(event: MediaQueryListEvent) {
  isDesktopTable.value = event.matches
}

function updateTableShellWidth(width?: number) {
  tableShellWidth.value = Math.max(0, Math.floor(width ?? tableShellRef.value?.clientWidth ?? 0))
}

watch(
  () => filters.keyword,
  () => {
    filters.page = 1
    if (keywordTimer) window.clearTimeout(keywordTimer)
    keywordTimer = window.setTimeout(() => void loadProjects(), 320)
  },
)

watch(
  () => [filters.status, filters.enabled],
  () => {
    filters.page = 1
    void loadProjects()
  },
)

watch(
  () => [filters.page, filters.pageSize],
  () => void loadProjects(),
)

onMounted(() => {
  desktopMediaQuery = window.matchMedia('(min-width: 901px)')
  isDesktopTable.value = desktopMediaQuery.matches
  desktopMediaQuery.addEventListener('change', handleDesktopMediaChange)
  updateTableShellWidth()
  tableShellResizeObserver = new ResizeObserver((entries) => {
    updateTableShellWidth(entries[0]?.contentRect.width)
  })
  if (tableShellRef.value) {
    tableShellResizeObserver.observe(tableShellRef.value)
  }
  void loadProjects()
})
</script>

<template>
  <div class="page-stack">
    <PageHeader :title="t('projects.title')">
      <template #actions>
        <RouterLink to="/projects/create">
          <n-button type="primary">
            <span class="icon-button-content">
              <Plus :size="16" />
              {{ t('common.createProject') }}
            </span>
          </n-button>
        </RouterLink>
      </template>
    </PageHeader>

    <section class="section-card filters">
      <n-input v-model:value="filters.keyword" clearable :placeholder="t('projects.searchPlaceholder')">
        <template #prefix>
          <Search :size="16" />
        </template>
      </n-input>
      <n-select v-model:value="filters.status" clearable :placeholder="t('common.status')" :options="statusOptions" />
      <n-select
        v-model:value="enabledValue"
        :options="enabledOptions"
      />
      <n-button secondary @click="resetFilters">
        <span class="icon-button-content">
          <RefreshCcw :size="15" />
          {{ t('common.reset') }}
        </span>
      </n-button>
    </section>

    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>

    <section ref="tableShellRef" class="table-shell" :style="tableWidthStyle">
      <EmptyState
        v-if="!loading && !projects.length"
        :title="t('projects.emptyTitle')"
        :description="t('projects.emptyDescription')"
      />
      <div v-else-if="!isDesktopTable" class="mobile-project-list">
        <article v-for="project in projects" :key="project.id" class="mobile-project-card">
          <div class="mobile-project-card__head">
            <div>
              <h3>{{ project.name }}</h3>
              <p>{{ project.slug }}</p>
            </div>
            <StatusBadge :status="project.effectiveStatus" />
          </div>

          <div class="mobile-project-meta">
            <span>ID</span>
            <strong>{{ project.id }}</strong>
            <span>{{ t('projects.rawStatus') }}</span>
            <StatusBadge :status="project.status" />
            <span>{{ t('projects.enabledStatus') }}</span>
            <n-tag :bordered="false" round :type="project.enabled ? 'success' : 'default'">
              {{ project.enabled ? t('common.enabled') : t('common.disabled') }}
            </n-tag>
            <span>{{ t('projects.expiresAt') }}</span>
            <strong>{{ formatDateTime(project.expiresAt) }}</strong>
            <span>{{ t('projects.popup') }}</span>
            <n-tag :bordered="false" round :type="project.popupEnabled ? 'warning' : 'default'">
              {{ project.popupEnabled ? t('common.enabled') : t('common.closed') }}
            </n-tag>
            <span>{{ t('projects.updatedAt') }}</span>
            <strong>{{ formatDateTime(project.updatedAt) }}</strong>
          </div>

          <div class="mobile-project-actions">
            <n-button secondary @click="router.push(`/projects/${project.id}`)">
              <span class="icon-button-content">
                <Eye :size="14" />
                {{ t('common.view') }}
              </span>
            </n-button>
            <n-button secondary @click="router.push(`/projects/${project.id}/edit`)">
              <span class="icon-button-content">
                <Pencil :size="14" />
                {{ t('common.edit') }}
              </span>
            </n-button>
            <n-button secondary @click="openAccessModal(project)">
              <span class="icon-button-content">
                <Copy :size="14" />
                {{ t('common.access') }}
              </span>
            </n-button>
            <n-popconfirm
              :positive-text="t('common.regenerate')"
              :negative-text="t('common.cancel')"
              @positive-click="handleRegenerate(project)"
            >
              <template #trigger>
                <n-button secondary>
                  <span class="icon-button-content">
                    <KeyRound :size="14" />
                    Key
                  </span>
                </n-button>
              </template>
              {{ t('common.confirmRegenerateKey') }}
            </n-popconfirm>
            <n-popconfirm
              :positive-text="t('common.delete')"
              :negative-text="t('common.cancel')"
              @positive-click="handleDelete(project)"
            >
              <template #trigger>
                <n-button type="error" secondary>
                  <span class="icon-button-content">
                    <Trash2 :size="14" />
                    {{ t('common.delete') }}
                  </span>
                </n-button>
              </template>
              {{ t('common.confirmDeleteProject', { name: project.name }) }}
            </n-popconfirm>
          </div>
        </article>
      </div>
      <n-data-table
        v-else
        class="project-table"
        remote
        :columns="columns"
        :data="projects"
        :loading="loading"
        :pagination="pagination"
        :single-line="false"
        :scroll-x="effectiveTableScrollX"
        table-layout="fixed"
        :on-unstable-column-resize="handleTableColumnResize"
      />
    </section>

    <AccessCodeModal
      v-model:show="accessModalOpen"
      :slug="selectedProject?.slug"
      :public-key="selectedProject?.publicKey"
      :project-name="selectedProject?.name"
    />
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 180px 140px auto;
  gap: 12px;
  align-items: center;
  padding: 22px 24px;
}

.table-shell {
  min-height: 548px;
}

.project-table :deep(.n-scrollbar-content),
.project-table :deep(.n-data-table-table) {
  width: var(--project-table-width) !important;
  min-width: var(--project-table-width) !important;
}

.project-table :deep(.n-data-table-resize-button) {
  right: -9px !important;
  width: 18px !important;
  border-radius: 999px;
  cursor: col-resize;
}

.project-table :deep(.n-data-table-resize-button::after) {
  left: 8px !important;
  width: 2px !important;
  height: 18px !important;
  background-color: rgba(29, 29, 31, 0.18) !important;
  border-radius: 999px;
  opacity: 0;
  transform: translateY(-50%) scaleY(0.78) !important;
  transition:
    opacity 160ms ease,
    height 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.project-table :deep(.n-data-table-th:hover .n-data-table-resize-button::after),
.project-table :deep(.n-data-table-resize-button:hover::after) {
  height: 24px !important;
  background-color: rgba(29, 29, 31, 0.34) !important;
  box-shadow: 0 0 0 4px rgba(29, 29, 31, 0.05);
  opacity: 1;
  transform: translateY(-50%) scaleY(1) !important;
}

.project-table :deep(.n-data-table-resize-button--active::after) {
  height: 30px !important;
  background-color: #0071e3 !important;
  box-shadow: 0 0 0 5px rgba(0, 113, 227, 0.12);
  opacity: 1;
  transform: translateY(-50%) scaleY(1) !important;
}

.project-table :deep(.action-button-group) {
  justify-content: flex-end;
  min-width: max-content;
}

.mobile-project-list {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.mobile-project-card {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--border-softer);
  border-radius: 14px;
}

.mobile-project-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.mobile-project-card__head h3 {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-main);
  font-size: 16px;
}

.mobile-project-card__head p {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-size: 13px;
}

.mobile-project-meta {
  display: grid;
  grid-template-columns: minmax(88px, auto) minmax(0, 1fr);
  gap: 10px 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-softer);
}

.mobile-project-meta span {
  color: var(--text-secondary);
  font-size: 12px;
}

.mobile-project-meta strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-main);
  font-size: 13px;
}

.mobile-project-meta :deep(.status-badge),
.mobile-project-meta :deep(.n-tag) {
  justify-self: start;
}

.mobile-project-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.mobile-project-actions :deep(.n-button) {
  width: 100%;
}

.mobile-project-actions :deep(.icon-button-content) {
  justify-content: center;
  width: 100%;
}

:deep(.adaptive-text-cell) {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .table-shell {
    min-height: 420px;
  }

  .project-table :deep(.n-data-table-resize-button) {
    display: none;
  }

  .project-table :deep(.action-button-group) {
    justify-content: flex-start;
  }
}

@media (max-width: 420px) {
  .table-shell {
    min-height: 360px;
  }

  .mobile-project-actions {
    grid-template-columns: 1fr;
  }
}
</style>
