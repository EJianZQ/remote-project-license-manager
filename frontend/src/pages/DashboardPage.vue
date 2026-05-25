<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, FileClock, FolderPlus, RefreshCcw, ShieldCheck } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { getProjects } from '@/api/projects'
import type { ProjectListItem, ProjectStatus } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const errorText = ref('')
const projects = ref<ProjectListItem[]>([])
const totalProjects = ref(0)
const dashboardPageSize = 100
let dashboardRequestId = 0
const { t } = useI18n()

const statusCards: ProjectStatus[] = ['active', 'grace', 'expired', 'suspended']

const stats = computed(() => {
  const result: Record<ProjectStatus, number> = {
    active: 0,
    grace: 0,
    expired: 0,
    suspended: 0,
  }

  for (const project of projects.value) {
    result[project.effectiveStatus] += 1
  }

  return result
})

const recentProjects = computed(() => projects.value.slice(0, 5))

async function loadDashboard() {
  const requestId = ++dashboardRequestId
  loading.value = true
  errorText.value = ''

  try {
    const firstPage = await getProjects({ page: 1, pageSize: dashboardPageSize })
    if (requestId !== dashboardRequestId) return

    const loadedProjects = [...firstPage.items]
    const pageCount = Math.ceil(firstPage.total / dashboardPageSize)

    for (let page = 2; page <= pageCount; page += 1) {
      const nextPage = await getProjects({ page, pageSize: dashboardPageSize })
      if (requestId !== dashboardRequestId) return

      loadedProjects.push(...nextPage.items)
    }

    projects.value = loadedProjects
    totalProjects.value = firstPage.total
  } catch (error) {
    if (requestId !== dashboardRequestId) return

    errorText.value = error instanceof Error ? error.message : t('dashboard.loadFailed')
  } finally {
    if (requestId === dashboardRequestId) {
      loading.value = false
    }
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="page-stack">
    <PageHeader :title="t('nav.dashboard')">
      <template #actions>
        <n-button secondary :loading="loading" @click="loadDashboard">
          <span class="icon-button-content">
            <RefreshCcw :size="16" />
            {{ t('common.refresh') }}
          </span>
        </n-button>
        <RouterLink to="/projects/create">
          <n-button type="primary">
            <span class="icon-button-content">
              <FolderPlus :size="16" />
              {{ t('common.createProject') }}
            </span>
          </n-button>
        </RouterLink>
      </template>
    </PageHeader>

    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>

    <div class="stats-grid">
      <section class="stat-card apple-card">
        <span>{{ t('dashboard.totalProjects') }}</span>
        <strong>{{ totalProjects }}</strong>
      </section>
      <section v-for="status in statusCards" :key="status" class="stat-card apple-card">
        <StatusBadge :status="status" />
        <strong>{{ stats[status] }}</strong>
      </section>
    </div>

    <div class="dashboard-grid">
      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">{{ t('dashboard.recentProjects') }}</h2>
          <RouterLink class="quiet-link" to="/projects">
            {{ t('common.viewAll') }}
            <ChevronRight :size="14" />
          </RouterLink>
        </div>

        <EmptyState
          v-if="!loading && !recentProjects.length"
          :title="t('dashboard.emptyTitle')"
          :description="t('dashboard.emptyDescription')"
        />
        <div v-else class="table-scroll">
          <n-table :bordered="false" :single-line="false">
            <thead>
              <tr>
                <th>{{ t('dashboard.projectName') }}</th>
                <th>slug</th>
                <th>{{ t('common.status') }}</th>
                <th>{{ t('dashboard.updatedAt') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="project in recentProjects" :key="project.id">
                <td>
                  <RouterLink class="project-link" :to="`/projects/${project.id}`">{{ project.name }}</RouterLink>
                </td>
                <td>{{ project.slug }}</td>
                <td><StatusBadge :status="project.effectiveStatus" /></td>
                <td>{{ formatDateTime(project.updatedAt) }}</td>
              </tr>
            </tbody>
          </n-table>
        </div>
      </section>

      <section class="section-card quick-section">
        <h2 class="section-title">{{ t('dashboard.quickActions') }}</h2>
        <RouterLink class="quick-link" to="/projects/create">
          <FolderPlus :size="20" />
          <span>{{ t('common.createProject') }}</span>
          <ChevronRight class="quick-arrow" :size="18" />
        </RouterLink>
        <RouterLink class="quick-link" to="/access-logs">
          <FileClock :size="20" />
          <span>{{ t('dashboard.viewAccessLogs') }}</span>
          <ChevronRight class="quick-arrow" :size="18" />
        </RouterLink>
        <RouterLink class="quick-link" to="/action-logs">
          <ShieldCheck :size="20" />
          <span>{{ t('dashboard.viewActionLogs') }}</span>
          <ChevronRight class="quick-arrow" :size="18" />
        </RouterLink>
      </section>
    </div>

    <p class="dashboard-footer">© 2026 License Console. All rights reserved.</p>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 22px;
}

.stat-card {
  display: flex;
  min-height: 164px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 28px 30px;
}

.stat-card span {
  color: var(--text-secondary);
  font-family: var(--font-apple-text);
  font-size: 15px;
  font-weight: 500;
}

.stat-card strong {
  color: var(--text-main);
  font-family: var(--font-apple-display);
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 28px;
}

.dashboard-grid .section-card {
  min-height: 414px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.project-link {
  color: var(--text-main);
  font-weight: 600;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.table-scroll :deep(.n-table) {
  min-width: 560px;
}

:deep(.n-table) {
  --n-td-padding: 18px 16px;
  --n-th-padding: 16px;
}

:deep(.n-table th) {
  color: var(--text-secondary);
  background: #fbfbfd;
  font-size: 13px;
  font-weight: 500;
}

:deep(.n-table td) {
  color: var(--text-main);
  font-size: 14px;
}

.quick-section {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 70px;
  padding: 0 18px;
  color: var(--text-main);
  background: #ffffff;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.quick-link:hover {
  border-color: rgba(29, 29, 31, 0.16);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.055);
  transform: translateY(-1px);
}

.quick-arrow {
  margin-left: auto;
  color: var(--text-tertiary);
}

.dashboard-footer {
  margin: 46px 0 0;
  color: #a1a1a6;
  font-size: 13px;
  text-align: center;
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    min-height: 118px;
    padding: 22px;
  }

  .stat-card strong {
    font-size: 38px;
  }

  .dashboard-grid .section-card {
    min-height: 0;
  }

  .quick-link {
    min-height: 58px;
    padding: 0 14px;
  }

  .dashboard-footer {
    margin-top: 22px;
  }
}
</style>
