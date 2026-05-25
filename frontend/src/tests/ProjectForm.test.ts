import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { Project } from '@/api/types'
import ProjectForm from '@/components/project/ProjectForm.vue'
import { i18n, setLocale } from '@/i18n'

const naiveStubs = {
  NAlert: {
    template: '<div role="alert"><slot /></div>',
  },
  NButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  NDatePicker: {
    props: ['value', 'placeholder'],
    emits: ['update:value'],
    template:
      '<input data-component="date-picker" :data-placeholder="placeholder" :value="value ?? \'\'" @input="$emit(\'update:value\', $event.target.value ? Number($event.target.value) : null)" />',
  },
  NFormItem: {
    props: ['label'],
    template: '<label><span>{{ label }}</span><slot /></label>',
  },
  NInput: {
    props: ['value', 'type', 'placeholder'],
    emits: ['update:value'],
    template:
      '<textarea v-if="type === \'textarea\'" :data-placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)" /><input v-else :data-placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  NSelect: {
    props: ['value', 'options'],
    emits: ['update:value'],
    template:
      '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
  },
  NSwitch: {
    props: ['value'],
    emits: ['update:value'],
    template: '<input type="checkbox" :checked="value" @change="$emit(\'update:value\', $event.target.checked)" />',
  },
}

const childStubs = {
  DomainListEditor: {
    props: ['modelValue'],
    emits: ['update:modelValue', 'valid-change'],
    template:
      '<div data-test="domain-editor"><button type="button" data-test="domain-invalid" @click="$emit(\'valid-change\', false)">invalid domains</button><button type="button" data-test="domain-valid" @click="$emit(\'update:modelValue\', [\'example.com\', \'www.example.com\']); $emit(\'valid-change\', true)">valid domains</button></div>',
  },
  JsonEditor: {
    props: ['modelValue'],
    emits: ['update:modelValue', 'valid-change'],
    template:
      '<div data-test="json-editor"><button type="button" data-test="json-invalid" @click="$emit(\'valid-change\', false)">invalid json</button><button type="button" data-test="json-valid" @click="$emit(\'update:modelValue\', { title: \'远程标题\' }); $emit(\'valid-change\', true)">valid json</button></div>',
  },
  PopupPreview: {
    template: '<div data-test="popup-preview" />',
  },
}

const sampleProject: Project = {
  id: 12,
  name: '酒店预定',
  slug: 'jdyd',
  publicKey: 'public-key',
  enabled: true,
  status: 'grace',
  effectiveStatus: 'grace',
  expiresAt: '2026-06-01T00:00:00.000Z',
  popupEnabled: true,
  popupTitle: '',
  popupContent: '',
  popupLevel: 'danger',
  variables: { title: '酒店预定主页' },
  allowedDomains: ['example.com'],
  remarks: '内部备注',
  createdAt: '2026-05-23T10:00:00.000Z',
  updatedAt: '2026-05-23T11:00:00.000Z',
}

beforeEach(() => {
  setLocale('zh-CN')
})

function mountProjectForm(props: Record<string, unknown> = {}) {
  return mount(ProjectForm, {
    props,
    global: {
      plugins: [i18n],
      stubs: {
        ...naiveStubs,
        ...childStubs,
      },
    },
  })
}

function fieldByPlaceholder(wrapper: ReturnType<typeof mountProjectForm>, placeholder: string) {
  const field = wrapper.findAll('input, textarea').find((item) => item.attributes('data-placeholder') === placeholder)
  expect(field, `field with placeholder ${placeholder} should exist`).toBeTruthy()

  return field!
}

function buttonByText(wrapper: ReturnType<typeof mountProjectForm>, text: string) {
  const button = wrapper.findAll('button').find((item) => item.text() === text)
  expect(button, `button ${text} should exist`).toBeTruthy()

  return button!
}

function lastSubmit(wrapper: ReturnType<typeof mountProjectForm>) {
  const events = wrapper.emitted('submit') ?? []

  return events[events.length - 1]?.[0]
}

describe('ProjectForm', () => {
  it('shows validation errors and disables submit until required fields are valid', async () => {
    const wrapper = mountProjectForm()

    expect(wrapper.text()).toContain('项目名不能为空。')
    expect(wrapper.text()).toContain('slug 不能为空。')
    expect(buttonByText(wrapper, '保存').attributes('disabled')).toBeDefined()

    await fieldByPlaceholder(wrapper, '例如：酒店预定').setValue('酒店预定')
    await fieldByPlaceholder(wrapper, 'hotel-booking').setValue('Bad Slug')
    await nextTick()

    expect(wrapper.text()).toContain('slug 只能包含小写字母、数字、短横线和下划线。')
    expect(buttonByText(wrapper, '保存').attributes('disabled')).toBeDefined()
  })

  it('emits a normalized project payload with validated JSON variables and domains', async () => {
    const wrapper = mountProjectForm()

    await fieldByPlaceholder(wrapper, '例如：酒店预定').setValue('  酒店预定  ')
    await fieldByPlaceholder(wrapper, 'hotel-booking').setValue('jdyd')
    await fieldByPlaceholder(wrapper, '内部备注，不会下发到商业前端项目').setValue('  内部备注  ')
    await wrapper.find('[data-test="json-valid"]').trigger('click')
    await wrapper.find('[data-test="domain-valid"]').trigger('click')
    await nextTick()

    await buttonByText(wrapper, '保存').trigger('click')

    expect(lastSubmit(wrapper)).toMatchObject({
      name: '酒店预定',
      slug: 'jdyd',
      enabled: true,
      status: 'active',
      expiresAt: null,
      popupEnabled: false,
      popupTitle: '项目服务提醒',
      popupContent: '请及时完成尾款结算',
      popupLevel: 'warning',
      variables: { title: '远程标题' },
      allowedDomains: ['example.com', 'www.example.com'],
      remarks: '内部备注',
    })
  })

  it('blocks submit when child editors report invalid JSON or domains', async () => {
    const wrapper = mountProjectForm()

    await fieldByPlaceholder(wrapper, '例如：酒店预定').setValue('酒店预定')
    await fieldByPlaceholder(wrapper, 'hotel-booking').setValue('jdyd')
    await wrapper.find('[data-test="json-invalid"]').trigger('click')
    await wrapper.find('[data-test="domain-invalid"]').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('自定义变量 JSON 格式错误。')
    expect(wrapper.text()).toContain('允许域名格式错误。')
    expect(buttonByText(wrapper, '保存').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('maps existing project data to an editable payload and applies popup title fallback', async () => {
    const wrapper = mountProjectForm({ initialValue: sampleProject })

    await buttonByText(wrapper, '保存').trigger('click')

    expect(lastSubmit(wrapper)).toMatchObject({
      name: '酒店预定',
      slug: 'jdyd',
      enabled: true,
      status: 'grace',
      expiresAt: '2026-06-01T00:00:00.000Z',
      popupEnabled: true,
      popupTitle: '项目服务提醒',
      popupContent: '',
      popupLevel: 'danger',
      variables: { title: '酒店预定主页' },
      allowedDomains: ['example.com'],
      remarks: '内部备注',
    })
  })
})
