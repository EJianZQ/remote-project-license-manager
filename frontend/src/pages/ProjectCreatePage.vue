<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { createProject } from '@/api/projects'
import type { ProjectPayload } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import ProjectForm from '@/components/project/ProjectForm.vue'

const router = useRouter()
const message = useMessage()
const submitting = ref(false)
const errorText = ref('')
const { t } = useI18n()

async function handleSubmit(payload: ProjectPayload) {
  submitting.value = true
  errorText.value = ''

  try {
    const project = await createProject(payload)
    message.success(t('projects.createSuccess'))
    await router.push(`/projects/${project.id}`)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : t('projects.createFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-stack">
    <PageHeader :title="t('projects.createTitle')" :description="t('projects.createDescription')" />
    <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>
    <ProjectForm :submitting="submitting" @submit="handleSubmit" @cancel="router.push('/projects')" />
  </div>
</template>
