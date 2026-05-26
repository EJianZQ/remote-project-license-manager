import { flushPromises, mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n, setLocale } from '@/i18n'

const logsApi = vi.hoisted(() => ({
  getAccessLogs: vi.fn(),
}))

vi.mock('@/api/logs', () => ({
  getAccessLogs: logsApi.getAccessLogs,
}))

import AccessLogPage from '@/pages/AccessLogPage.vue'

const dateRange = [
  new Date('2026-05-25T10:30:00+08:00').getTime(),
  new Date('2026-05-25T11:30:00+08:00').getTime(),
] as [number, number]

const naiveStubs = {
  NAlert: {
    template: '<div role="alert"><slot /></div>',
  },
  NButton: {
    emits: ['click'],
    template: '<button type="button" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  NDataTable: {
    template: '<div data-test="data-table" />',
  },
  NDatePicker: {
    props: ['value'],
    emits: ['update:value'],
    template: '<button type="button" data-test="date-range" @click="$emit(\'update:value\', dateRange)">date</button>',
    setup() {
      return { dateRange }
    },
  },
  NInput: {
    props: ['value', 'placeholder'],
    emits: ['update:value'],
    template:
      '<input :data-placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  NSelect: {
    props: ['value', 'options', 'placeholder'],
    emits: ['update:value'],
    template:
      '<select :data-placeholder="placeholder" :value="value ?? \'\'" @change="$emit(\'update:value\', $event.target.value || null)"><option value=""></option><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
  },
  NTag: {
    template: '<span><slot /></span>',
  },
}

function mountAccessLogPage() {
  return mount(AccessLogPage, {
    global: {
      plugins: [i18n],
      stubs: naiveStubs,
    },
  })
}

function inputByPlaceholder(wrapper: ReturnType<typeof mountAccessLogPage>, placeholder: string) {
  const input = wrapper.findAll('input').find((item) => item.attributes('data-placeholder') === placeholder)
  expect(input, `input ${placeholder} should exist`).toBeTruthy()

  return input!
}

beforeEach(() => {
  vi.useFakeTimers()
  setLocale('zh-CN')
  logsApi.getAccessLogs.mockReset()
  logsApi.getAccessLogs.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AccessLogPage', () => {
  it('builds the expanded access log filter query from the toolbar', async () => {
    const wrapper = mountAccessLogPage()
    await flushPromises()
    logsApi.getAccessLogs.mockClear()

    await inputByPlaceholder(wrapper, 'projectId').setValue(' 12 ')
    await inputByPlaceholder(wrapper, '按 slug 筛选').setValue(' jdyd ')
    await inputByPlaceholder(wrapper, 'publicKey').setValue(' public-key ')
    await inputByPlaceholder(wrapper, 'requestDomain: example.com').setValue(' example.com ')
    await inputByPlaceholder(wrapper, 'ip').setValue(' 127.0.0.1 ')
    await inputByPlaceholder(wrapper, 'origin').setValue(' https://example.com ')
    await inputByPlaceholder(wrapper, 'referer').setValue(' /checkout ')
    await inputByPlaceholder(wrapper, 'userAgent').setValue(' Chrome ')
    await inputByPlaceholder(wrapper, 'message').setValue(' 宽限期 ')

    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('grace')
    await selects[1]!.setValue('false')
    await wrapper.find('[data-test="date-range"]').trigger('click')

    vi.runOnlyPendingTimers()
    await flushPromises()

    expect(logsApi.getAccessLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: '12',
        slug: 'jdyd',
        publicKey: 'public-key',
        requestDomain: 'example.com',
        ip: '127.0.0.1',
        origin: 'https://example.com',
        referer: '/checkout',
        userAgent: 'Chrome',
        message: '宽限期',
        effectiveStatus: 'grace',
        allowed: 'false',
        createdAtFrom: dayjs(dateRange[0]).format('YYYY-MM-DDTHH:mm:ssZ'),
        createdAtTo: dayjs(dateRange[1]).format('YYYY-MM-DDTHH:mm:ssZ'),
        page: 1,
        pageSize: 20,
      }),
    )
  })
})
