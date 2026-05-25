import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import JsonEditor from '@/components/project/JsonEditor.vue'
import { i18n, setLocale } from '@/i18n'

const codeMirrorMock = vi.hoisted(() => ({
  lastView: null as null | {
    doc: string
    simulateChange: (value: string) => void
  },
}))

vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: () => ({ type: 'history' }),
  historyKeymap: [],
}))

vi.mock('@codemirror/lang-json', () => ({
  json: () => ({ type: 'json' }),
  jsonParseLinter: () => () => [],
}))

vi.mock('@codemirror/language', () => ({
  bracketMatching: () => ({ type: 'bracketMatching' }),
  defaultHighlightStyle: {},
  syntaxHighlighting: () => ({ type: 'syntaxHighlighting' }),
}))

vi.mock('@codemirror/lint', () => ({
  lintGutter: () => ({ type: 'lintGutter' }),
  linter: () => ({ type: 'linter' }),
}))

vi.mock('@codemirror/view', () => {
  class EditorView {
    static lineWrapping = { type: 'lineWrapping' }
    static updateListener = {
      of: (listener: unknown) => ({ type: 'updateListener', listener }),
    }
    static theme = () => ({ type: 'theme' })
    static contentAttributes = {
      of: (attrs: Record<string, string>) => ({ type: 'contentAttributes', attrs }),
    }

    doc: string
    private listener: ((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void) | null

    constructor(options: { doc: string; parent: HTMLElement; extensions: Array<Record<string, unknown>> }) {
      this.doc = options.doc
      this.listener =
        (options.extensions.find((extension) => extension.type === 'updateListener')?.listener as typeof this.listener) ??
        null

      const editor = document.createElement('div')
      editor.className = 'cm-editor'
      const content = document.createElement('div')
      content.className = 'cm-content'

      const contentAttributes = options.extensions.find((extension) => extension.type === 'contentAttributes')?.attrs as
        | Record<string, string>
        | undefined
      for (const [key, value] of Object.entries(contentAttributes ?? {})) {
        content.setAttribute(key, value)
      }

      editor.appendChild(content)
      options.parent.appendChild(editor)
      codeMirrorMock.lastView = this
    }

    get state() {
      const view = this

      return {
        doc: {
          get length() {
            return view.doc.length
          },
          toString: () => view.doc,
        },
      }
    }

    dispatch(update: { changes: { insert: string } }) {
      this.simulateChange(update.changes.insert)
    }

    focus() {}

    destroy() {
      codeMirrorMock.lastView = null
    }

    simulateChange(value: string) {
      this.doc = value
      this.listener?.({
        docChanged: true,
        state: {
          doc: {
            toString: () => this.doc,
          },
        },
      })
    }
  }

  return {
    drawSelection: () => ({ type: 'drawSelection' }),
    dropCursor: () => ({ type: 'dropCursor' }),
    EditorView,
    highlightActiveLine: () => ({ type: 'highlightActiveLine' }),
    highlightActiveLineGutter: () => ({ type: 'highlightActiveLineGutter' }),
    keymap: { of: () => ({ type: 'keymap' }) },
    lineNumbers: () => ({ type: 'lineNumbers' }),
  }
})

function mountJsonEditor(modelValue: Record<string, unknown> = { title: '酒店预定主页' }) {
  setLocale('zh-CN')

  return mount(JsonEditor, {
    props: {
      modelValue,
    },
    global: {
      plugins: [i18n],
      stubs: {
        NButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
        },
      },
    },
  })
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find((item) => item.text() === label)
  expect(button, `button ${label} should exist`).toBeTruthy()

  return button!
}

function lastEmission(wrapper: ReturnType<typeof mount>, eventName: string) {
  const events = wrapper.emitted(eventName) ?? []

  return events[events.length - 1]
}

describe('JsonEditor', () => {
  it('creates an accessible JSON editing surface', () => {
    const wrapper = mountJsonEditor()

    expect(wrapper.find('[aria-label="自定义变量 JSON 编辑器"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('JSON 对象有效')
  })

  it('emits parsed JSON objects after editor changes', async () => {
    const wrapper = mountJsonEditor()

    codeMirrorMock.lastView?.simulateChange('{"title":"新标题"}')
    await nextTick()

    expect(lastEmission(wrapper, 'update:modelValue')).toEqual([{ title: '新标题' }])
    expect(lastEmission(wrapper, 'valid-change')).toEqual([true])
  })

  it('rejects valid JSON values that are not objects', async () => {
    const wrapper = mountJsonEditor()

    codeMirrorMock.lastView?.simulateChange('[1, 2, 3]')
    await nextTick()

    expect(wrapper.text()).toContain('JSON 需要修正')
    expect(wrapper.text()).toContain('JSON 必须是对象')
    expect(lastEmission(wrapper, 'valid-change')).toEqual([false])
  })

  it('formats, compacts and clears the editor content', async () => {
    const wrapper = mountJsonEditor()

    codeMirrorMock.lastView?.simulateChange('{"title":"酒店","phone":"186"}')
    await findButton(wrapper, '格式化 JSON').trigger('click')
    expect(codeMirrorMock.lastView?.doc).toContain('\n  "title": "酒店"')

    await findButton(wrapper, '压缩').trigger('click')
    expect(codeMirrorMock.lastView?.doc).toBe('{"title":"酒店","phone":"186"}')

    await findButton(wrapper, '清空').trigger('click')
    expect(codeMirrorMock.lastView?.doc).toBe('{}')
    expect(lastEmission(wrapper, 'update:modelValue')).toEqual([{}])
  })
})
