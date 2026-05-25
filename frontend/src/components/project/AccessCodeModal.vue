<script setup lang="ts">
import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { API_BASE_URL } from '@/api/http'
import { copyText } from '@/utils/clipboard'
import { buildAgentAccessPrompt, buildFetchExample } from '@/utils/accessInfo'
import type { LocaleCode } from '@/i18n/messages'

const props = defineProps<{
  show: boolean
  slug?: string
  publicKey?: string
  projectName?: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const message = useMessage()
const { t, locale } = useI18n()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

const modalStyle = {
  width: 'min(920px, calc(100vw - 96px))',
  maxHeight: 'calc(100vh - 96px)',
}

const modalContentStyle = {
  maxHeight: 'calc(100vh - 190px)',
  overflowY: 'auto',
}

const endpoint = computed(() => {
  if (!props.slug || !props.publicKey) return ''
  return `${API_BASE_URL}/api/public/projects/${props.slug}/config?key=${props.publicKey}`
})

const fetchExample = computed(() => buildFetchExample(endpoint.value))
const agentAccessPrompt = computed(() =>
  buildAgentAccessPrompt({
    endpoint: endpoint.value || t('access.chooseProjectFirst'),
    projectName: props.projectName,
    slug: props.slug,
    locale: locale.value as LocaleCode,
  }),
)

async function copy(value: string, label: string) {
  await copyText(value)
  message.success(t('common.copied', { label }))
}
</script>

<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('access.modalTitle')"
    class="access-modal"
    :style="modalStyle"
    :content-style="modalContentStyle"
  >
    <div class="modal-stack">
      <section>
        <div class="section-heading">
          <h3>{{ t('access.publicApi') }}</h3>
          <n-button size="small" secondary :disabled="!endpoint" @click="copy(endpoint, t('access.apiAddress'))">
            {{ t('common.copy') }}
          </n-button>
        </div>
        <pre class="code-block">{{ endpoint }}</pre>
      </section>

      <section>
        <div class="section-heading">
          <h3>{{ t('access.fetchExample') }}</h3>
          <n-button size="small" secondary :disabled="!endpoint" @click="copy(fetchExample, t('access.fetchExample'))">
            {{ t('common.copy') }}
          </n-button>
        </div>
        <pre class="code-block">{{ fetchExample }}</pre>
      </section>

      <section>
        <div class="section-heading">
          <h3>{{ t('access.agentPrompt') }}</h3>
          <n-button size="small" secondary :disabled="!endpoint" @click="copy(agentAccessPrompt, t('access.agentPromptCopyLabel'))">
            {{ t('common.copy') }}
          </n-button>
        </div>
        <pre class="code-block agent-prompt">{{ agentAccessPrompt }}</pre>
      </section>

      <n-alert type="default" :bordered="false">
        {{ t('access.responseNote') }}
      </n-alert>
    </div>
  </n-modal>
</template>

<style scoped>
:global(.access-modal) {
  width: min(920px, calc(100vw - 96px)) !important;
  max-height: calc(100vh - 96px);
  border-radius: 24px;
}

:global(.access-modal .n-card__content) {
  max-height: calc(100vh - 190px);
  overflow-y: auto;
}

.modal-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-heading {
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

.agent-prompt {
  max-height: 360px;
}

@media (max-width: 560px) {
  :global(.access-modal) {
    width: calc(100vw - 32px) !important;
    max-height: calc(100vh - 32px);
    border-radius: 16px;
  }

  :global(.access-modal .n-card__content) {
    max-height: calc(100vh - 126px);
  }

  .modal-stack {
    gap: 14px;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-heading :deep(.n-button) {
    width: 100%;
  }

  .agent-prompt {
    max-height: 300px;
  }
}
</style>
