import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n, setLocale } from '@/i18n'
import type { DailyAccessLogStats, ProjectStatus, TodayAccessLogStats } from '@/api/types'

const projectApi = vi.hoisted(() => ({
  getProjects: vi.fn(),
}))

const logsApi = vi.hoisted(() => ({
  getTodayAccessLogStats: vi.fn(),
  getDailyAccessLogStats: vi.fn(),
}))

vi.mock('@/api/projects', () => ({
  getProjects: projectApi.getProjects,
}))

vi.mock('@/api/logs', () => ({
  getTodayAccessLogStats: logsApi.getTodayAccessLogStats,
  getDailyAccessLogStats: logsApi.getDailyAccessLogStats,
}))

import DashboardPage from '@/pages/DashboardPage.vue'

const statuses: ProjectStatus[] = ['active', 'grace', 'expired', 'suspended']
const timezoneStorageKey = 'license_console_access_stats_timezone'
type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf: (key: 'timeZone') => string[]
}

const naiveStubs = {
  NAlert: {
    template: '<div role="alert"><slot /></div>',
  },
  NButton: {
    props: ['loading'],
    emits: ['click'],
    template: '<button type="button" :disabled="loading" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  NSelect: {
    name: 'NSelect',
    props: [
      'value',
      'options',
      'renderLabel',
      'consistentMenuWidth',
      'resetMenuOnOptionsChange',
      'menuProps',
      'remote',
      'onSearch',
      'onScroll',
      'onUpdateShow',
    ],
    emits: ['update:value'],
    methods: {
      readValue(this: { options: Array<{ value: string | number }> }, value: string): string | number {
        const option = this.options.find((item: { value: string | number }) => String(item.value) === value)
        return typeof option?.value === 'number' ? Number(value) : (option?.value ?? value)
      },
    },
    template:
      '<select :value="value" :data-consistent-menu-width="String(consistentMenuWidth)" :data-reset-menu-on-options-change="String(resetMenuOnOptionsChange)" :data-menu-class="menuProps?.class" :data-remote="String(remote)" @change="$emit(\'update:value\', readValue($event.target.value))"><option v-for="option in options" :key="option.value" :value="option.value" :data-flag-code="option.flagCode" :data-has-flag-src="Boolean(option.flagSrc)">{{ option.label }}</option></select>',
  },
  NTable: {
    template: '<table><slot /></table>',
  },
}

function createStatusCounts(value = 0) {
  return {
    active: value,
    grace: value,
    expired: value,
    suspended: value,
    unknown: value,
  }
}

function createTodayStats(): TodayAccessLogStats {
  return {
    date: '2026-05-26',
    timezone: 'Asia/Shanghai',
    total: 23,
    allowed: 19,
    denied: 4,
    statuses: {
      active: 18,
      grace: 1,
      expired: 0,
      suspended: 0,
      unknown: 4,
    },
  }
}

function createDailyStats(days: number): DailyAccessLogStats {
  return {
    timezone: 'Asia/Shanghai',
    days,
    fromDate: '2026-05-01',
    toDate: `2026-05-${days.toString().padStart(2, '0')}`,
    items: Array.from({ length: days }, (_item, index) => ({
      date: `2026-05-${(index + 1).toString().padStart(2, '0')}`,
      total: index + 1,
      allowed: index,
      denied: 1,
      statuses: createStatusCounts(0),
    })),
  }
}

function mountDashboardPage() {
  return mount(DashboardPage, {
    global: {
      plugins: [i18n],
      stubs: {
        ...naiveStubs,
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>',
        },
        AccessTrendChart: {
          props: ['label', 'items', 'visibleDays'],
          template:
            '<div class="access-trend-chart-stub" role="img" :aria-label="label">{{ items.length }}:{{ visibleDays }}</div>',
        },
      },
    },
  })
}

function mockBrowserTimezone(timezone: string) {
  const resolvedOptions = new Intl.DateTimeFormat().resolvedOptions()
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...resolvedOptions,
    timeZone: timezone,
  })
}

function mockSupportedTimezones(timezones: string[]) {
  vi.spyOn(Intl as IntlWithSupportedValues, 'supportedValuesOf').mockReturnValue(timezones)
}

beforeEach(() => {
  setLocale('zh-CN')
  window.localStorage.removeItem(timezoneStorageKey)
  projectApi.getProjects.mockReset()
  logsApi.getTodayAccessLogStats.mockReset()
  logsApi.getDailyAccessLogStats.mockReset()

  projectApi.getProjects.mockResolvedValue({
    items: statuses.map((status, index) => ({
      id: index + 1,
      name: `项目 ${index + 1}`,
      slug: `project-${index + 1}`,
      publicKey: `key-${index + 1}`,
      enabled: status !== 'suspended',
      status,
      effectiveStatus: status,
      expiresAt: null,
      popupEnabled: false,
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
    })),
    total: statuses.length,
    page: 1,
    pageSize: 100,
  })
  logsApi.getTodayAccessLogStats.mockResolvedValue(createTodayStats())
  logsApi.getDailyAccessLogStats.mockImplementation(({ days = 7 }: { days?: number }) =>
    Promise.resolve(createDailyStats(days)),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DashboardPage access statistics', () => {
  it('loads and renders today access totals and the default 7-day trend', async () => {
    const wrapper = mountDashboardPage()
    await flushPromises()

    expect(projectApi.getProjects).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
    expect(logsApi.getTodayAccessLogStats).toHaveBeenCalledWith({ timezone: expect.any(String) })
    expect(logsApi.getDailyAccessLogStats).toHaveBeenCalledWith({
      timezone: expect.any(String),
      days: 30,
    })
    expect(wrapper.text()).toContain('今日访问日志')
    expect(wrapper.text()).toContain('23')
    expect(wrapper.text()).toContain('允许 19')
    expect(wrapper.text()).toContain('拒绝 4')
    expect(wrapper.text()).toContain('合计 189')
    expect(wrapper.find('.access-trend-chart-stub').exists()).toBe(true)
    expect(wrapper.find('.access-trend-chart-stub').text()).toBe('30:7')
    expect(wrapper.find('.access-trend-chart-stub').attributes('aria-label')).toBe('访问次数趋势')
  })

  it('updates the visible range without reloading daily access stats when the range changes', async () => {
    const wrapper = mountDashboardPage()
    await flushPromises()
    logsApi.getDailyAccessLogStats.mockClear()

    await wrapper.find('select.day-select').setValue('14')
    await flushPromises()

    expect(logsApi.getDailyAccessLogStats).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('近 14 天')
    expect(wrapper.text()).toContain('合计 329')
    expect(wrapper.find('.access-trend-chart-stub').text()).toBe('30:14')
  })

  it('uses the browser timezone on first entry when no saved preference exists', async () => {
    mockBrowserTimezone('Europe/London')

    const wrapper = mountDashboardPage()
    await flushPromises()

    expect(logsApi.getTodayAccessLogStats).toHaveBeenCalledWith({ timezone: 'Europe/London' })
    expect(logsApi.getDailyAccessLogStats).toHaveBeenCalledWith({
      timezone: 'Europe/London',
      days: 30,
    })
    expect(wrapper.find('.timezone-inline-row').text()).toContain('统计时区')
    expect(wrapper.find('select.timezone-select').text()).toContain('Europe/London')
  })

  it('keeps a saved timezone preference instead of replacing it with the browser timezone', async () => {
    window.localStorage.setItem(timezoneStorageKey, 'America/New_York')
    mockBrowserTimezone('Europe/London')

    const wrapper = mountDashboardPage()
    await flushPromises()

    expect(logsApi.getTodayAccessLogStats).toHaveBeenCalledWith({ timezone: 'America/New_York' })
    expect(logsApi.getDailyAccessLogStats).toHaveBeenCalledWith({
      timezone: 'America/New_York',
      days: 30,
    })
    expect(wrapper.find('.timezone-inline-row').text()).toContain('统计时区')
    expect(wrapper.find('select.timezone-select').text()).toContain('America/New_York')
  })

  it('persists timezone changes and reloads access stats with the selected timezone', async () => {
    const wrapper = mountDashboardPage()
    await flushPromises()
    logsApi.getTodayAccessLogStats.mockClear()
    logsApi.getDailyAccessLogStats.mockClear()

    await wrapper.find('select.timezone-select').setValue('America/Los_Angeles')
    await flushPromises()

    expect(window.localStorage.getItem(timezoneStorageKey)).toBe('America/Los_Angeles')
    expect(logsApi.getTodayAccessLogStats).toHaveBeenCalledWith({ timezone: 'America/Los_Angeles' })
    expect(logsApi.getDailyAccessLogStats).toHaveBeenCalledWith({
      timezone: 'America/Los_Angeles',
      days: 30,
    })
    expect(wrapper.find('.timezone-inline-row').text()).toContain('统计时区')
    expect((wrapper.find('select.timezone-select').element as HTMLSelectElement).value).toBe('America/Los_Angeles')
  })

  it('does not show stale access stats when loading the newly selected timezone fails', async () => {
    const wrapper = mountDashboardPage()
    await flushPromises()
    expect(wrapper.find('.access-total-card strong').text()).toBe('23')
    expect(wrapper.find('.access-trend-chart-stub').exists()).toBe(true)

    logsApi.getTodayAccessLogStats.mockRejectedValue(new Error('timezone failed'))
    logsApi.getDailyAccessLogStats.mockRejectedValue(new Error('timezone failed'))

    await wrapper.find('select.timezone-select').setValue('America/Los_Angeles')
    await flushPromises()

    expect(wrapper.find('.access-total-card strong').text()).toBe('0')
    expect(wrapper.text()).toContain('允许 0')
    expect(wrapper.text()).toContain('拒绝 0')
    expect(wrapper.find('.access-trend-chart-stub').exists()).toBe(false)
    expect(wrapper.text()).toContain('timezone failed')
  })

  it('starts with a lazy subset of the browser-supported IANA timezone list', async () => {
    const wrapper = mountDashboardPage()
    await flushPromises()

    const timezoneOptions = wrapper.find('select.timezone-select').findAll('option')

    expect(timezoneOptions.length).toBeLessThanOrEqual(40)
    expect(timezoneOptions.find((option) => option.attributes('value') === 'Asia/Shanghai')?.attributes('data-flag-code')).toBe(
      'cn',
    )
    expect(
      timezoneOptions.find((option) => option.attributes('value') === 'America/New_York')?.attributes('data-flag-code'),
    ).toBe('us')
    expect(timezoneOptions.find((option) => option.attributes('value') === 'Europe/London')?.attributes('data-flag-code')).toBe(
      'gb',
    )
  })

  it('keeps long timezone labels readable by using a wider select menu', async () => {
    const wrapper = mountDashboardPage()
    await flushPromises()

    const timezoneSelect = wrapper.find('select.timezone-select')

    expect(wrapper.find('.timezone-inline-row select.timezone-select').exists()).toBe(true)
    expect(wrapper.find('.access-stats-controls select.timezone-select').exists()).toBe(false)
    expect(timezoneSelect.attributes('data-consistent-menu-width')).toBe('false')
    expect(timezoneSelect.attributes('data-reset-menu-on-options-change')).toBe('false')
    expect(timezoneSelect.attributes('data-menu-class')).toBe('timezone-select-menu')
    expect(timezoneSelect.attributes()).toHaveProperty('data-remote')
  })

  it('searches browser-supported timezones that are not in the initial lazy subset', async () => {
    mockSupportedTimezones(['Asia/Shanghai', 'America/Buenos_Aires', 'Pacific/Chatham'])
    const menu = document.createElement('div')
    const menuScroller = document.createElement('div')
    menu.className = 'timezone-select-menu'
    menuScroller.className = 'n-scrollbar-container'
    menuScroller.scrollTop = 160
    menu.appendChild(menuScroller)
    document.body.appendChild(menu)

    try {
      const wrapper = mountDashboardPage()
      await flushPromises()

      const timezoneSelect = wrapper.findAllComponents({ name: 'NSelect' })[0]
      expect(timezoneSelect).toBeDefined()
      ;(timezoneSelect!.props('onSearch') as (value: string) => void)('Chatham')
      await flushPromises()

      const timezoneOptions = wrapper.find('select.timezone-select').findAll('option')
      const timezoneValues = timezoneOptions.map((option) => option.attributes('value'))

      expect(timezoneValues).toEqual(['Pacific/Chatham'])
      expect(timezoneOptions.find((option) => option.attributes('value') === 'Pacific/Chatham')?.attributes('data-flag-code')).toBe(
        'nz',
      )
      expect(timezoneValues).not.toContain('Asia/Shanghai')
      expect(timezoneValues).not.toContain('UTC')
      expect(menuScroller.scrollTop).toBe(0)
    } finally {
      menu.remove()
    }
  })

  it('searches timezone names when the user types spaces instead of underscores', async () => {
    mockSupportedTimezones(['Asia/Shanghai', 'America/Los_Angeles', 'America/New_York'])

    const wrapper = mountDashboardPage()
    await flushPromises()

    const timezoneSelect = wrapper.findAllComponents({ name: 'NSelect' })[0]
    expect(timezoneSelect).toBeDefined()
    ;(timezoneSelect!.props('onSearch') as (value: string) => void)('Los Angeles')
    await flushPromises()

    const timezoneValues = wrapper
      .find('select.timezone-select')
      .findAll('option')
      .map((option) => option.attributes('value'))

    expect(timezoneValues).toEqual(['America/Los_Angeles'])
  })

  it('loads more timezone options when the dropdown scrolls near the bottom', async () => {
    const wrapper = mountDashboardPage()
    await flushPromises()

    const timezoneSelect = wrapper.findAllComponents({ name: 'NSelect' })[0]
    expect(timezoneSelect).toBeDefined()
    const initialOptionCount = wrapper.find('select.timezone-select').findAll('option').length
    const scrollTarget = {
      clientHeight: 100,
      scrollHeight: 140,
      scrollTop: 40,
    }
    const onScroll = timezoneSelect!.props('onScroll') as (event: Event) => Promise<void>

    await onScroll({ currentTarget: scrollTarget } as unknown as Event)
    await flushPromises()

    const loadedOptionCount = wrapper.find('select.timezone-select').findAll('option').length
    expect(loadedOptionCount).toBeGreaterThan(initialOptionCount)
    expect(scrollTarget.scrollTop).toBe(40)

    await onScroll({ currentTarget: scrollTarget } as unknown as Event)
    await flushPromises()

    expect(wrapper.find('select.timezone-select').findAll('option')).toHaveLength(loadedOptionCount)
    wrapper.unmount()
  })
})
