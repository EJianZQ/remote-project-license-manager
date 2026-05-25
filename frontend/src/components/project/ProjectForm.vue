<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PopupLevel, Project, ProjectPayload, ProjectStatus } from '@/api/types'
import DomainListEditor from './DomainListEditor.vue'
import JsonEditor from './JsonEditor.vue'
import PopupPreview from './PopupPreview.vue'

const props = withDefaults(
  defineProps<{
    initialValue?: Project | null
    submitting?: boolean
  }>(),
  {
    initialValue: null,
    submitting: false,
  },
)

const emit = defineEmits<{
  submit: [payload: ProjectPayload]
  cancel: []
}>()

const { t, locale } = useI18n()

const statusOptions = computed<Array<{ label: string; value: ProjectStatus }>>(() => {
  locale.value
  return [
    { label: t('status.optionActive'), value: 'active' },
    { label: t('status.optionGrace'), value: 'grace' },
    { label: t('status.optionExpired'), value: 'expired' },
    { label: t('status.optionSuspended'), value: 'suspended' },
  ]
})

const popupLevelOptions = computed<Array<{ label: string; value: PopupLevel }>>(() => {
  locale.value
  return [
    { label: t('popupLevel.optionInfo'), value: 'info' },
    { label: t('popupLevel.optionWarning'), value: 'warning' },
    { label: t('popupLevel.optionDanger'), value: 'danger' },
  ]
})

const form = reactive<ProjectPayload>(createDefaultPayload())
const expiresAtValue = ref<number | null>(null)
const jsonValid = ref(true)
const domainValid = ref(true)

const validationErrors = computed(() => {
  locale.value
  const errors: string[] = []

  if (!form.name.trim()) errors.push(t('form.nameRequired'))
  if (!form.slug.trim()) errors.push(t('form.slugRequired'))
  if (form.slug && !/^[a-z0-9_-]+$/.test(form.slug)) {
    errors.push(t('form.slugInvalid'))
  }
  if (!jsonValid.value) errors.push(t('form.jsonInvalid'))
  if (!domainValid.value) errors.push(t('form.domainInvalid'))

  return errors
})

watch(
  () => props.initialValue,
  (value) => {
    const payload = value ? projectToPayload(value) : createDefaultPayload()
    Object.assign(form, payload)
    expiresAtValue.value = payload.expiresAt ? new Date(payload.expiresAt).getTime() : null
  },
  { immediate: true },
)

watch(expiresAtValue, (value) => {
  form.expiresAt = value ? new Date(value).toISOString() : null
})

function createDefaultPayload(): ProjectPayload {
  return {
    name: '',
    slug: '',
    enabled: true,
    status: 'active',
    expiresAt: null,
    popupEnabled: false,
    popupTitle: t('form.popupTitleDefault'),
    popupContent: t('form.popupContentDefault'),
    popupLevel: 'warning',
    variables: {},
    allowedDomains: [],
    remarks: '',
  }
}

function projectToPayload(project: Project): ProjectPayload {
  return {
    name: project.name,
    slug: project.slug,
    enabled: project.enabled,
    status: project.status,
    expiresAt: project.expiresAt,
    popupEnabled: project.popupEnabled,
    popupTitle: project.popupTitle || t('form.popupTitleDefault'),
    popupContent: project.popupContent || '',
    popupLevel: project.popupLevel || 'warning',
    variables: project.variables || {},
    allowedDomains: project.allowedDomains || [],
    remarks: project.remarks || '',
  }
}

function handleSubmit() {
  if (validationErrors.value.length) {
    return
  }

  emit('submit', {
    ...form,
    name: form.name.trim(),
    slug: form.slug.trim(),
    popupTitle: form.popupTitle.trim(),
    popupContent: form.popupContent.trim(),
    remarks: form.remarks.trim(),
    allowedDomains: [...form.allowedDomains],
    variables: { ...form.variables },
  })
}
</script>

<template>
  <div class="project-form page-stack">
    <section class="section-card">
      <h2 class="section-title">{{ t('projects.baseInfo') }}</h2>
      <div class="field-grid">
        <n-form-item :label="t('projects.projectName')" required>
          <n-input v-model:value="form.name" :placeholder="t('form.namePlaceholder')" />
        </n-form-item>
        <n-form-item label="slug" required>
          <n-input v-model:value="form.slug" placeholder="hotel-booking" />
        </n-form-item>
        <n-form-item :label="t('form.enabled')">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
        <n-form-item :label="t('common.status')">
          <n-select v-model:value="form.status" :options="statusOptions" />
        </n-form-item>
        <n-form-item :label="t('form.expiresAt')">
          <n-date-picker
            v-model:value="expiresAtValue"
            type="datetime"
            clearable
            style="width: 100%"
            :placeholder="t('form.expiresAtPlaceholder')"
          />
        </n-form-item>
      </div>
    </section>

    <section class="section-card">
      <h2 class="section-title">{{ t('projects.popupConfig') }}</h2>
      <div class="field-grid">
        <div class="form-column">
          <n-form-item :label="t('form.popupEnabled')">
            <n-switch v-model:value="form.popupEnabled" />
          </n-form-item>
          <n-form-item :label="t('form.popupLevel')">
            <n-select v-model:value="form.popupLevel" :options="popupLevelOptions" />
          </n-form-item>
          <n-form-item :label="t('form.popupTitle')">
            <n-input v-model:value="form.popupTitle" :placeholder="t('form.popupTitleDefault')" />
          </n-form-item>
          <n-form-item :label="t('form.popupContent')">
            <n-input v-model:value="form.popupContent" type="textarea" :rows="4" />
          </n-form-item>
        </div>
        <PopupPreview
          :popup-enabled="form.popupEnabled"
          :popup-level="form.popupLevel"
          :popup-title="form.popupTitle"
          :popup-content="form.popupContent"
        />
      </div>
    </section>

    <section class="section-card">
      <h2 class="section-title">{{ t('form.variables') }}</h2>
      <JsonEditor v-model="form.variables" @valid-change="jsonValid = $event" />
    </section>

    <section class="section-card">
      <h2 class="section-title">{{ t('form.domainLimit') }}</h2>
      <DomainListEditor v-model="form.allowedDomains" @valid-change="domainValid = $event" />
    </section>

    <section class="section-card">
      <h2 class="section-title">{{ t('common.remark') }}</h2>
      <n-input v-model:value="form.remarks" type="textarea" :rows="5" :placeholder="t('common.internalRemark')" />
    </section>

    <n-alert v-if="validationErrors.length" type="error" :bordered="false">
      <div v-for="error in validationErrors" :key="error">{{ error }}</div>
    </n-alert>

    <div class="form-actions">
      <n-button secondary @click="$emit('cancel')">{{ t('common.cancel') }}</n-button>
      <n-button type="primary" :loading="submitting" :disabled="validationErrors.length > 0" @click="handleSubmit">
        {{ t('common.save') }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.form-column {
  display: flex;
  flex-direction: column;
}

.form-actions {
  position: sticky;
  bottom: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  box-shadow: var(--shadow-subtle);
  backdrop-filter: blur(18px);
}

@media (max-width: 760px) {
  .form-actions {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 10px;
    border-radius: 16px;
  }

  .form-actions :deep(.n-button) {
    width: 100%;
  }
}

@media (max-width: 420px) {
  .form-actions {
    grid-template-columns: 1fr;
  }
}
</style>
