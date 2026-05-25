<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getProject, updateProject } from '@/api/projects'
import type { Project, ProjectPayload } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import ProjectForm from '@/components/project/ProjectForm.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const project = ref<Project | null>(null)
const loading = ref(false)
const submitting = ref(false)
const errorText = ref('')
const { t } = useI18n()

const projectId = route.params.id as string

async function loadProject() {
  loading.value = true
  errorText.value = ''

  try {
    project.value = await getProject(projectId)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : t('projects.loadFailed')
  } finally {
    loading.value = false
  }
}

async function handleSubmit(payload: ProjectPayload) {
  submitting.value = true
  errorText.value = ''

  try {
    const updated = await updateProject(projectId, payload)
    message.success(t('projects.saveSuccess'))
    await router.push(`/projects/${updated.id}`)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : t('projects.saveFailed')
  } finally {
    submitting.value = false
  }
}

onMounted(loadProject)
</script>

<template>
  <div class="page-stack">
    <PageHeader
      :title="t('projects.editTitle')"
      :description="project ? t('projects.editDescription', { name: project.name }) : t('projects.editLoadingDescription')"
    />
    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>
    <n-spin v-if="loading" size="large" />
    <ProjectForm
      v-else-if="project"
      :initial-value="project"
      :submitting="submitting"
      @submit="handleSubmit"
      @cancel="router.push(`/projects/${projectId}`)"
    />
  </div>
</template>
