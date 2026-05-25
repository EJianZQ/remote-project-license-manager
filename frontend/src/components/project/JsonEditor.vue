<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, linter } from '@codemirror/lint'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { useI18n } from 'vue-i18n'
import { parseJsonObject, formatJsonObject, type JsonObject } from '@/utils/json'

const props = withDefaults(
  defineProps<{
    modelValue: JsonObject
    rows?: number
  }>(),
  {
    rows: 9,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: JsonObject]
  'valid-change': [value: boolean]
}>()

const { t, locale } = useI18n()
const editorHost = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)
const text = ref(formatJsonObject(props.modelValue || {}))
const error = ref('')
const errorDetail = ref('')

const isValid = computed(() => !error.value)
const lineCount = computed(() => Math.max(1, text.value.split(/\r\n|\r|\n/).length))
const characterCount = computed(() => text.value.length)
const editorStyle = computed(() => ({
  '--json-editor-min-height': `${Math.max(props.rows, 5) * 24 + 34}px`,
}))

watch(
  () => props.modelValue,
  (value) => {
    const formatted = formatJsonObject(value || {})
    const current = parseJsonObject(text.value)

    if (current.ok && formatJsonObject(current.value) === formatted) {
      return
    }

    setEditorText(formatted)
  },
  { deep: true },
)

watch(
  [text, () => locale.value],
  ([value]) => {
    const result = parseJsonObject(value)

    if (result.ok) {
      error.value = ''
      errorDetail.value = ''
      emit('update:modelValue', result.value)
      emit('valid-change', true)
      return
    }

    error.value = result.error
    errorDetail.value = result.detail || ''
    emit('valid-change', false)
  },
  { immediate: true },
)

onMounted(() => {
  if (!editorHost.value) return

  editorView.value = new EditorView({
    doc: text.value,
    parent: editorHost.value,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      dropCursor(),
      history(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      json(),
      lintGutter(),
      linter(jsonParseLinter(), { delay: 250 }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.contentAttributes.of({
        'aria-label': t('json.ariaLabel'),
      }),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          text.value = update.state.doc.toString()
        }
      }),
      EditorView.theme({
        '&': {
          minHeight: 'var(--json-editor-min-height)',
          color: '#1d1d1f',
          backgroundColor: '#ffffff',
          fontSize: '13px',
        },
        '.cm-scroller': {
          minHeight: 'var(--json-editor-min-height)',
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
          lineHeight: '1.65',
        },
        '.cm-content': {
          padding: '14px 0',
        },
        '.cm-gutters': {
          color: '#86868b',
          backgroundColor: '#fbfbfd',
          borderRight: '1px solid rgba(29, 29, 31, 0.08)',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(29, 29, 31, 0.035)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'rgba(29, 29, 31, 0.05)',
        },
        '&.cm-focused': {
          outline: 'none',
        },
      }),
    ],
  })
})

onBeforeUnmount(() => {
  editorView.value?.destroy()
})

function setEditorText(value: string) {
  text.value = value

  const view = editorView.value
  if (!view || view.state.doc.toString() === value) return

  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: value,
    },
  })
}

async function focusEditor() {
  await nextTick()
  editorView.value?.focus()
}

function formatCurrentJson() {
  const result = parseJsonObject(text.value)

  if (result.ok) {
    setEditorText(formatJsonObject(result.value))
    void focusEditor()
  }
}

function compactCurrentJson() {
  const result = parseJsonObject(text.value)

  if (result.ok) {
    setEditorText(JSON.stringify(result.value))
    void focusEditor()
  }
}

function clearJson() {
  setEditorText('{}')
  void focusEditor()
}

function fillExample() {
  setEditorText(
    formatJsonObject({
      title: t('json.exampleTitle'),
      phone: '18666666166',
      notice: t('json.exampleNotice'),
    }),
  )
  void focusEditor()
}
</script>

<template>
  <div class="json-editor">
    <div class="editor-toolbar">
      <div class="editor-title">
        <span class="status-dot" :class="{ valid: isValid, invalid: !isValid }" />
        <span>{{ isValid ? t('json.valid') : t('json.invalid') }}</span>
      </div>

      <div class="editor-actions">
        <n-button size="small" secondary :disabled="!isValid" @click="formatCurrentJson">{{ t('json.format') }}</n-button>
        <n-button size="small" secondary :disabled="!isValid" @click="compactCurrentJson">{{ t('json.compact') }}</n-button>
        <n-button size="small" quaternary @click="fillExample">{{ t('json.fillExample') }}</n-button>
        <n-button size="small" quaternary @click="clearJson">{{ t('json.clear') }}</n-button>
      </div>
    </div>

    <div class="editor-shell" :class="{ invalid: !isValid }" :style="editorStyle">
      <div ref="editorHost" class="codemirror-host" />
    </div>

    <div class="editor-footer">
      <p v-if="error" class="error-text">
        {{ error }}
        <span v-if="errorDetail">({{ errorDetail }})</span>
      </p>
      <p v-else class="helper-text">{{ t('json.helper') }}</p>
      <span class="editor-meta">{{ t('json.meta', { lines: lineCount, chars: characterCount }) }}</span>
    </div>
  </div>
</template>

<style scoped>
.json-editor {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.editor-toolbar,
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.editor-title,
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.editor-title {
  color: var(--text-main);
  font-size: 13px;
  font-weight: 700;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.valid {
  background: var(--success-text);
}

.status-dot.invalid {
  background: var(--danger-text);
}

.editor-shell {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--border-soft);
  border-radius: 16px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.editor-shell:focus-within {
  border-color: rgba(29, 29, 31, 0.32);
  box-shadow: 0 0 0 3px rgba(29, 29, 31, 0.05);
}

.editor-shell.invalid {
  border-color: rgba(209, 41, 61, 0.45);
  box-shadow: 0 0 0 3px rgba(209, 41, 61, 0.08);
}

.codemirror-host {
  min-width: 0;
}

.codemirror-host :deep(.cm-editor) {
  min-height: var(--json-editor-min-height);
}

.codemirror-host :deep(.cm-tooltip) {
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  box-shadow: var(--shadow-subtle);
  font-size: 12px;
}

.codemirror-host :deep(.cm-tooltip-lint) {
  padding: 8px 10px;
}

.error-text,
.helper-text,
.editor-meta {
  margin: 0;
  font-size: 12px;
}

.error-text {
  color: var(--danger-text);
}

.error-text span {
  color: var(--text-tertiary);
}

.helper-text,
.editor-meta {
  color: var(--text-secondary);
}

.editor-meta {
  flex: 0 0 auto;
}

@media (max-width: 760px) {
  .editor-toolbar,
  .editor-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .editor-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .editor-actions :deep(.n-button) {
    width: 100%;
  }
}

@media (max-width: 420px) {
  .editor-actions {
    grid-template-columns: 1fr;
  }
}
</style>
