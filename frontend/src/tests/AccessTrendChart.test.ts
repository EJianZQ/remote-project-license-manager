import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyAccessLogStatsItem } from '@/api/types'

const echartsMock = vi.hoisted(() => {
  const chart = {
    dispatchAction: vi.fn(),
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }

  return {
    chart,
    init: vi.fn(() => chart),
    use: vi.fn(),
  }
})

vi.mock('echarts/core', () => ({
  init: echartsMock.init,
  use: echartsMock.use,
}))

vi.mock('echarts/charts', () => ({
  LineChart: {},
}))

vi.mock('echarts/components', () => ({
  DataZoomComponent: {},
  GridComponent: {},
  TooltipComponent: {},
}))

vi.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}))

import AccessTrendChart from '@/components/common/AccessTrendChart.vue'

type ChartOptionUnderTest = {
  animation: boolean
  animationDuration: number
  animationDurationUpdate: number
  animationEasing: string
  animationEasingUpdate: string
  grid: {
    top: number
    containLabel: boolean
  }
  xAxis: {
    type: string
    boundaryGap: boolean
    data: string[]
  }
  dataZoom: Array<{
    id: string
    type: string
    start: number
    end: number
    filterMode: string
    throttle: number
    zoomLock: boolean
    moveOnMouseMove: boolean
    preventDefaultMouseMove: boolean
  }>
  series: Array<{
    id: string
    name: string
    type: string
    data: Array<{
      name: string
      value: number
    }>
    clip: boolean
    label: {
      show: boolean
      position: string
    }
  }>
}

type DataZoomActionUnderTest = {
  type: string
  dataZoomId: string
  start: number
  end: number
  silent: boolean
}

function createStatsItem(date: string, total: number): DailyAccessLogStatsItem {
  return {
    date,
    total,
    allowed: total,
    denied: 0,
    statuses: {
      active: total,
      grace: 0,
      expired: 0,
      suspended: 0,
      unknown: 0,
    },
  }
}

function createStatsItems(count: number) {
  return Array.from({ length: count }, (_item, index) =>
    createStatsItem(`2026-05-${(index + 1).toString().padStart(2, '0')}`, index + 1),
  )
}

function latestOption() {
  const calls = echartsMock.chart.setOption.mock.calls
  return calls[calls.length - 1]?.[0] as ChartOptionUnderTest
}

function latestSetOptionOptions() {
  const calls = echartsMock.chart.setOption.mock.calls
  return calls[calls.length - 1]?.[1] as Record<string, unknown>
}

function latestDataZoomAction() {
  const calls = echartsMock.chart.dispatchAction.mock.calls
  return calls[calls.length - 1]?.[0] as DataZoomActionUnderTest
}

let originalRequestAnimationFrame: typeof window.requestAnimationFrame | undefined
let originalCancelAnimationFrame: typeof window.cancelAnimationFrame | undefined

beforeEach(() => {
  originalRequestAnimationFrame = window.requestAnimationFrame
  originalCancelAnimationFrame = window.cancelAnimationFrame
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(Date.now()), 16)) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = ((handle: number) => {
    window.clearTimeout(handle)
  }) as typeof window.cancelAnimationFrame

  echartsMock.chart.dispatchAction.mockClear()
  echartsMock.chart.setOption.mockClear()
  echartsMock.chart.resize.mockClear()
  echartsMock.chart.dispose.mockClear()
  echartsMock.init.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  window.requestAnimationFrame = originalRequestAnimationFrame as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = originalCancelAnimationFrame as typeof window.cancelAnimationFrame
})

describe('AccessTrendChart', () => {
  it('creates a full-width ECharts line chart from daily access stats', async () => {
    const wrapper = mount(AccessTrendChart, {
      props: {
        label: '访问次数趋势',
        items: createStatsItems(30),
        visibleDays: 7,
      },
    })
    await flushPromises()
    expect(echartsMock.init).toHaveBeenCalledWith(wrapper.find('.access-trend-chart').element)
    expect(wrapper.find('.access-trend-chart').attributes('aria-label')).toBe('访问次数趋势')
    expect(wrapper.find('.access-trend-chart').attributes('style')).toContain('min-width: 100%;')
    expect(latestOption()).toMatchObject({
      animation: true,
      animationDuration: 360,
      animationDurationUpdate: 620,
      animationEasing: 'cubicOut',
      animationEasingUpdate: 'cubicInOut',
    })
    expect(latestSetOptionOptions()).toMatchObject({
      notMerge: true,
      lazyUpdate: false,
    })
    expect(latestOption().grid).toMatchObject({
      top: 34,
      containLabel: true,
    })
    expect(latestOption().xAxis).toMatchObject({
      type: 'category',
      boundaryGap: false,
    })
    expect(latestOption().xAxis.data).toEqual(['05/24', '05/25', '05/26', '05/27', '05/28', '05/29', '05/30'])
    expect(latestOption().dataZoom[0]).toMatchObject({
      id: 'access-trend-window',
      type: 'inside',
      start: 0,
      end: 100,
      filterMode: 'filter',
      throttle: 32,
      zoomLock: true,
      moveOnMouseMove: false,
      preventDefaultMouseMove: false,
    })
    expect(latestOption().series[0]!).toMatchObject({
      id: 'daily-access-total',
      name: '访问次数趋势',
      type: 'line',
      clip: false,
    })
    expect(latestOption().series[0]!.data).toHaveLength(7)
    expect(latestOption().series[0]!.data[0]).toEqual({ name: '2026-05-24', value: 24 })
    expect(latestOption().series[0]!.data[6]).toEqual({ name: '2026-05-30', value: 30 })
    expect(latestOption().series[0]!.label).toMatchObject({
      show: true,
      position: 'top',
    })
    expect(echartsMock.chart.resize).toHaveBeenCalled()

    wrapper.unmount()
    expect(echartsMock.chart.dispose).toHaveBeenCalled()
  })

  it('uses a wider scroll surface for longer mobile ranges', async () => {
    const wrapper = mount(AccessTrendChart, {
      props: {
        label: '访问次数趋势',
        items: createStatsItems(30),
        visibleDays: 30,
      },
    })
    await flushPromises()

    expect(wrapper.find('.access-trend-chart-viewport').exists()).toBe(true)
    expect(wrapper.find('.access-trend-chart').attributes('style')).toContain('min-width: 640px;')
    expect(latestOption().xAxis.data).toHaveLength(30)
  })

  it('uses a medium-width scroll surface for the 14-day range', async () => {
    const wrapper = mount(AccessTrendChart, {
      props: {
        label: '访问次数趋势',
        items: createStatsItems(30),
        visibleDays: 14,
      },
    })
    await flushPromises()

    expect(wrapper.find('.access-trend-chart').attributes('style')).toContain('min-width: 520px;')
    expect(latestOption().xAxis.data).toHaveLength(14)
  })

  it('expands from 7 days to 30 days with dataZoom animation', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AccessTrendChart, {
      props: {
        label: '访问次数趋势',
        items: createStatsItems(30),
        visibleDays: 7,
      },
    })
    await flushPromises()
    await wrapper.setProps({ visibleDays: 30 })
    await flushPromises()

    expect(wrapper.find('.access-trend-chart').attributes('style')).toContain('min-width: 640px;')
    expect(latestOption().xAxis.data).toHaveLength(30)
    expect(latestOption().dataZoom[0]!.start).toBeCloseTo((23 / 29) * 100, 4)

    vi.advanceTimersByTime(640)
    await flushPromises()

    expect(latestDataZoomAction().start).toBeCloseTo(0, 4)

    wrapper.unmount()
  })

  it('collapses to 7 days and removes older data after the range animation', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AccessTrendChart, {
      props: {
        label: '访问次数趋势',
        items: createStatsItems(30),
        visibleDays: 30,
      },
    })
    await flushPromises()

    await wrapper.setProps({
      visibleDays: 7,
    })
    await flushPromises()

    expect(wrapper.find('.access-trend-chart').classes()).not.toContain('is-transitioning')
    expect(latestOption().xAxis.data).toHaveLength(30)

    vi.advanceTimersByTime(640)
    await flushPromises()

    expect(echartsMock.chart.dispatchAction.mock.calls.length).toBeGreaterThan(1)
    expect(echartsMock.chart.dispatchAction.mock.calls.length).toBeLessThanOrEqual(18)
    expect(latestDataZoomAction()).toMatchObject({
      type: 'dataZoom',
      dataZoomId: 'access-trend-window',
      end: 100,
      silent: true,
    })
    expect(wrapper.find('.access-trend-chart').attributes('style')).toContain('min-width: 100%;')
    expect(latestOption().xAxis.data).toEqual(['05/24', '05/25', '05/26', '05/27', '05/28', '05/29', '05/30'])
    expect(latestOption().series[0]!.data).toHaveLength(7)
    expect(latestOption().series[0]!.data[0]).toEqual({ name: '2026-05-24', value: 24 })
    expect(latestOption().dataZoom[0]!.start).toBe(0)

    wrapper.unmount()
  })

  it('replaces an in-progress range animation when trend data changes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AccessTrendChart, {
      props: {
        label: '访问次数趋势',
        items: createStatsItems(30),
        visibleDays: 30,
      },
    })
    await flushPromises()

    await wrapper.setProps({
      visibleDays: 7,
    })
    await flushPromises()
    expect(latestOption().xAxis.data).toHaveLength(30)

    const nextItems = Array.from({ length: 10 }, (_item, index) =>
      createStatsItem(`2026-06-${(index + 1).toString().padStart(2, '0')}`, 100 + index),
    )

    await wrapper.setProps({
      items: nextItems,
    })
    await flushPromises()

    const expectedDates = ['06/04', '06/05', '06/06', '06/07', '06/08', '06/09', '06/10']
    expect(latestOption().xAxis.data).toEqual(expectedDates)
    expect(latestOption().series[0]!.data[0]).toEqual({ name: '2026-06-04', value: 103 })
    expect(latestOption().dataZoom[0]!.start).toBe(0)

    vi.advanceTimersByTime(640)
    await flushPromises()

    expect(latestOption().xAxis.data).toEqual(expectedDates)
    expect(latestOption().series[0]!.data).toHaveLength(7)

    wrapper.unmount()
  })

  it('updates the ECharts option when trend data changes', async () => {
    const wrapper = mount(AccessTrendChart, {
      props: {
        label: '访问次数趋势',
        items: [createStatsItem('2026-05-20', 1)],
        visibleDays: 7,
      },
    })
    await flushPromises()

    await wrapper.setProps({
      items: [createStatsItem('2026-05-20', 2), createStatsItem('2026-05-21', 3)],
    })
    await flushPromises()

    expect(latestOption().xAxis.data).toEqual(['05/20', '05/21'])
    expect(latestOption().series[0]!.data).toEqual([
      { name: '2026-05-20', value: 2 },
      { name: '2026-05-21', value: 3 },
    ])
    expect(latestSetOptionOptions()).toMatchObject({
      notMerge: false,
      lazyUpdate: false,
    })

    wrapper.unmount()
  })
})
