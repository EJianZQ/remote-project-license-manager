<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Code2, Copy, Pencil } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { API_BASE_URL } from '@/api/http'
import { getProject } from '@/api/projects'
import { getProjectAccessLogs } from '@/api/logs'
import type { AccessLog, Project } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AccessCodeModal from '@/components/project/AccessCodeModal.vue'
import PopupPreview from '@/components/project/PopupPreview.vue'
import { copyText } from '@/utils/clipboard'
import { buildAgentAccessPrompt, buildFetchExample } from '@/utils/accessInfo'
import { formatDateTime, formatJson } from '@/utils/format'
import type { LocaleCode } from '@/i18n/messages'

const route = useRoute()
const message = useMessage()
const { t, locale } = useI18n()
const projectId = route.params.id as string

const project = ref<Project | null>(null)
const logs = ref<AccessLog[]>([])
const loading = ref(false)
const logsLoading = ref(false)
const errorText = ref('')
const accessModalOpen = ref(false)

const endpoint = computed(() => {
  if (!project.value) return ''
  return `${API_BASE_URL}/api/public/projects/${project.value.slug}/config?key=${project.value.publicKey}`
})

const fetchExample = computed(() => buildFetchExample(endpoint.value))
const agentAccessPrompt = computed(() => {
  if (!project.value) return ''

  return buildAgentAccessPrompt({
    endpoint: endpoint.value,
    projectName: project.value.name,
    slug: project.value.slug,
    locale: locale.value as LocaleCode,
  })
})

async function loadProject() {
  loading.value = true
  errorText.value = ''

  try {
    project.value = await getProject(projectId)
    await loadLogs()
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : t('projects.detailLoadFailed')
  } finally {
    loading.value = false
  }
}

async function loadLogs() {
  logsLoading.value = true

  try {
    const page = await getProjectAccessLogs(projectId, { page: 1, pageSize: 10 })
    logs.value = page.items
  } catch {
    logs.value = []
  } finally {
    logsLoading.value = false
  }
}

async function copy(value: string, label: string) {
  await copyText(value)
  message.success(t('common.copied', { label }))
}

onMounted(loadProject)
</script>

<template>
  <div class="page-stack">
    <PageHeader
      :title="project?.name || t('projects.detailTitle')"
      :description="project ? `slug：${project.slug}` : t('projects.detailLoadingDescription')"
    >
      <template #actions>
        <RouterLink v-if="project" :to="`/projects/${project.id}/edit`">
          <n-button secondary>
            <span class="icon-button-content">
              <Pencil :size="16" />
              {{ t('common.edit') }}
            </span>
          </n-button>
        </RouterLink>
        <n-button v-if="project" type="primary" @click="accessModalOpen = true">
          <span class="icon-button-content">
            <Code2 :size="16" />
            {{ t('common.accessInfo') }}
          </span>
        </n-button>
      </template>
    </PageHeader>

    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>
    <n-spin v-if="loading" size="large" />

    <template v-else-if="project">
      <section class="section-card">
        <h2 class="section-title">{{ t('projects.baseInfo') }}</h2>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">ID</div><div class="detail-value">{{ project.id }}</div></div>
          <div class="detail-item"><div class="detail-label">{{ t('projects.projectName') }}</div><div class="detail-value">{{ project.name }}</div></div>
          <div class="detail-item"><div class="detail-label">slug</div><div class="detail-value">{{ project.slug }}</div></div>
          <div class="detail-item">
            <div class="detail-label">publicKey</div>
            <div class="detail-value copy-row">
              <span>{{ project.publicKey }}</span>
              <n-button size="tiny" secondary @click="copy(project.publicKey, 'publicKey')">{{ t('common.copy') }}</n-button>
            </div>
          </div>
          <div class="detail-item"><div class="detail-label">enabled</div><div class="detail-value">{{ project.enabled ? t('common.enabled') : t('common.disabled') }}</div></div>
          <div class="detail-item"><div class="detail-label">status</div><div class="detail-value"><StatusBadge :status="project.status" /></div></div>
          <div class="detail-item"><div class="detail-label">effectiveStatus</div><div class="detail-value"><StatusBadge :status="project.effectiveStatus" /></div></div>
          <div class="detail-item"><div class="detail-label">expiresAt</div><div class="detail-value">{{ formatDateTime(project.expiresAt) }}</div></div>
          <div class="detail-item"><div class="detail-label">createdAt</div><div class="detail-value">{{ formatDateTime(project.createdAt) }}</div></div>
          <div class="detail-item"><div class="detail-label">updatedAt</div><div class="detail-value">{{ formatDateTime(project.updatedAt) }}</div></div>
        </div>
      </section>

      <section class="section-card">
        <h2 class="section-title">{{ t('projects.popupConfig') }}</h2>
        <div class="field-grid">
          <div class="detail-grid single">
            <div class="detail-item"><div class="detail-label">popupEnabled</div><div class="detail-value">{{ project.popupEnabled ? t('common.enabled') : t('common.closed') }}</div></div>
            <div class="detail-item"><div class="detail-label">popupLevel</div><div class="detail-value">{{ project.popupLevel }}</div></div>
            <div class="detail-item"><div class="detail-label">popupTitle</div><div class="detail-value">{{ project.popupTitle || '-' }}</div></div>
            <div class="detail-item"><div class="detail-label">popupContent</div><div class="detail-value">{{ project.popupContent || '-' }}</div></div>
          </div>
          <PopupPreview
            :popup-enabled="project.popupEnabled"
            :popup-level="project.popupLevel"
            :popup-title="project.popupTitle"
            :popup-content="project.popupContent"
          />
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">{{ t('projects.customVariables') }}</h2>
          <n-button size="small" secondary @click="copy(formatJson(project.variables), 'variables JSON')">
            <span class="icon-button-content"><Copy :size="14" />{{ t('common.copy') }}</span>
          </n-button>
        </div>
        <pre class="code-block">{{ formatJson(project.variables) }}</pre>
      </section>

      <section class="section-card">
        <h2 class="section-title">{{ t('projects.allowedDomains') }}</h2>
        <div v-if="project.allowedDomains.length" class="tag-list">
          <n-tag v-for="domain in project.allowedDomains" :key="domain" round>{{ domain }}</n-tag>
        </div>
        <p v-else class="muted">{{ t('projects.noDomainLimit') }}</p>
      </section>

      <section class="section-card">
        <h2 class="section-title">{{ t('common.remark') }}</h2>
        <p class="remarks">{{ project.remarks || t('projects.noRemark') }}</p>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">{{ t('common.accessInfo') }}</h2>
          <n-button size="small" secondary @click="copy(fetchExample, t('access.fetchExample'))">
            <span class="icon-button-content"><Copy :size="14" />{{ t('projects.copyExample') }}</span>
          </n-button>
        </div>
        <div class="access-stack">
          <pre class="code-block">{{ endpoint }}</pre>
          <pre class="code-block">{{ fetchExample }}</pre>
          <div class="section-head agent-head">
            <h3>{{ t('access.agentPrompt') }}</h3>
            <n-button size="small" secondary @click="copy(agentAccessPrompt, t('access.agentPromptCopyLabel'))">
              <span class="icon-button-content"><Copy :size="14" />{{ t('projects.copyPrompt') }}</span>
            </n-button>
          </div>
          <pre class="code-block agent-prompt">{{ agentAccessPrompt }}</pre>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">{{ t('projects.recentAccessLogs') }}</h2>
          <RouterLink to="/access-logs">{{ t('common.viewAll') }}</RouterLink>
        </div>
        <EmptyState
          v-if="!logsLoading && !logs.length"
          :title="t('projects.accessLogEmptyTitle')"
          :description="t('projects.accessLogEmptyDescription')"
        />
        <div v-else class="table-scroll">
          <n-table :bordered="false" :single-line="false">
            <thead>
              <tr>
                <th>ID</th>
                <th>{{ t('common.domain') }}</th>
                <th>{{ t('common.status') }}</th>
                <th>allowed</th>
                <th>{{ t('common.time') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td>{{ log.id }}</td>
                <td>{{ log.requestDomain || '-' }}</td>
                <td><StatusBadge :status="log.effectiveStatus" /></td>
                <td>
                  <n-tag :type="log.allowed ? 'success' : 'error'" :bordered="false" round>
                    {{ log.allowed ? t('common.allowed') : t('common.denied') }}
                  </n-tag>
                </td>
                <td>{{ formatDateTime(log.createdAt) }}</td>
              </tr>
            </tbody>
          </n-table>
        </div>
      </section>
    </template>

    <AccessCodeModal
      v-model:show="accessModalOpen"
      :slug="project?.slug"
      :public-key="project?.publicKey"
      :project-name="project?.name"
    />
  </div>
</template>

<style scoped>
.copy-row,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.copy-row span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.single {
  grid-template-columns: 1fr;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.remarks {
  margin: 0;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.access-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-head {
  margin-top: 6px;
}

.agent-head h3 {
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
}

.agent-prompt {
  max-height: 360px;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.table-scroll :deep(.n-table) {
  min-width: 620px;
}

.section-head a {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 760px) {
  .copy-row,
  .section-head {
    align-items: flex-start;
  }

  .section-head {
    flex-wrap: wrap;
  }

  .copy-row {
    flex-direction: column;
  }

  .agent-prompt {
    max-height: 300px;
  }
}
</style>
