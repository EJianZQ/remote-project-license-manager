<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECharts, EChartsOption, SetOptionOpts } from 'echarts'
import type { DailyAccessLogStatsItem } from '@/api/types'

const props = defineProps<{
  label: string
  items: DailyAccessLogStatsItem[]
  visibleDays: number
}>()

const chartRef = ref<HTMLElement | null>(null)
const layoutDays = ref(props.visibleDays)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let pendingAnimationFrame: number | null = null
let currentZoomStart = 0
let currentDataSignature = ''
let currentSourceDataSignature = ''
let currentVisibleDays = props.visibleDays
let renderedItems: DailyAccessLogStatsItem[] = []

const initialSetOptionOptions: SetOptionOpts = {
  notMerge: true,
  lazyUpdate: false,
}
const updateSetOptionOptions: SetOptionOpts = {
  notMerge: false,
  lazyUpdate: false,
}
const zoomAnimationDurationMs = 460
const zoomDispatchIntervalMs = 32
const dataZoomId = 'access-trend-window'

use([LineChart, DataZoomComponent, GridComponent, TooltipComponent, CanvasRenderer])

const chartMinWidth = computed(() => {
  if (layoutDays.value >= 30) return '640px'
  if (layoutDays.value >= 14) return '520px'

  return '100%'
})

function formatShortDate(value: string) {
  return value.slice(5).replace('-', '/')
}

function getItemsSignature(items: DailyAccessLogStatsItem[]) {
  return items.map((item) => `${item.date}:${item.total}:${item.allowed}:${item.denied}`).join('|')
}

function getVisibleItems(days = props.visibleDays) {
  return props.items.slice(-Math.min(days, props.items.length))
}

function getZoomStartPercent(items: DailyAccessLogStatsItem[], visibleDays: number) {
  if (items.length <= 1 || items.length <= visibleDays) return 0

  return ((items.length - visibleDays) / (items.length - 1)) * 100
}

function easeInOutCubic(progress: number) {
  return progress < 0.5 ? 4 * progress * progress * progress : 1 - (-2 * progress + 2) ** 3 / 2
}

function createChartOption(items: DailyAccessLogStatsItem[], zoomStart = 0): EChartsOption {
  return {
    animation: true,
    animationDuration: 360,
    animationDurationUpdate: 620,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicInOut',
    color: ['#1d1d1f'],
    grid: {
      top: 34,
      right: 18,
      bottom: 24,
      left: 36,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(29, 29, 31, 0.16)',
        },
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: items.map((item) => formatShortDate(item.date)),
      axisTick: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          color: '#d9d9de',
        },
      },
      axisLabel: {
        color: '#6e6e73',
        fontSize: 12,
        margin: 10,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      splitNumber: 2,
      axisLabel: {
        color: '#86868b',
        fontSize: 12,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(29, 29, 31, 0.08)',
        },
      },
    },
    dataZoom: [
      {
        id: dataZoomId,
        type: 'inside',
        xAxisIndex: 0,
        start: zoomStart,
        end: 100,
        filterMode: 'filter',
        throttle: zoomDispatchIntervalMs,
        zoomLock: true,
        zoomOnMouseWheel: false,
        moveOnMouseMove: false,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: false,
        cursorGrab: 'grab',
        cursorGrabbing: 'grabbing',
      },
    ],
    series: [
      {
        id: 'daily-access-total',
        name: props.label,
        type: 'line',
        data: items.map((item) => ({
          name: item.date,
          value: item.total,
        })),
        smooth: false,
        symbol: 'circle',
        symbolSize: 8,
        clip: false,
        lineStyle: {
          color: '#1d1d1f',
          width: 3,
        },
        itemStyle: {
          color: '#ffffff',
          borderColor: '#1d1d1f',
          borderWidth: 2,
        },
        areaStyle: {
          color: 'rgba(29, 29, 31, 0.06)',
        },
        label: {
          show: true,
          position: 'top',
          distance: 8,
          color: '#1d1d1f',
          fontSize: 12,
          fontWeight: 700,
        },
        emphasis: {
          focus: 'series',
        },
      },
    ],
  }
}

function renderChart(items = getVisibleItems(), zoomStart = 0) {
  if (!chartRef.value) return

  const isFirstRender = chart === null
  chart ??= init(chartRef.value)
  chart.setOption(createChartOption(items, zoomStart), isFirstRender ? initialSetOptionOptions : updateSetOptionOptions)
  chart.resize()
  renderedItems = items
  currentZoomStart = zoomStart
  currentDataSignature = getItemsSignature(items)
}

function syncSourceDataSignature() {
  currentSourceDataSignature = getItemsSignature(props.items)
}

function clearPendingAnimationFrame() {
  if (pendingAnimationFrame === null) return

  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(pendingAnimationFrame)
  }
  pendingAnimationFrame = null
}

function dispatchZoom(start: number) {
  chart?.dispatchAction({
    type: 'dataZoom',
    dataZoomId,
    start,
    end: 100,
    silent: true,
  })
}

function animateZoomTo(targetZoomStart: number, onComplete?: () => void) {
  if (!chart || Math.abs(currentZoomStart - targetZoomStart) < 0.01) {
    currentZoomStart = targetZoomStart
    dispatchZoom(targetZoomStart)
    onComplete?.()
    return
  }

  clearPendingAnimationFrame()
  const fromZoomStart = currentZoomStart
  let startTime: number | null = null
  let lastDispatchTime = 0

  const tick = (timestamp: number) => {
    startTime ??= timestamp
    const progress = Math.min((timestamp - startTime) / zoomAnimationDurationMs, 1)
    const nextZoomStart = fromZoomStart + (targetZoomStart - fromZoomStart) * easeInOutCubic(progress)
    const shouldDispatch = progress >= 1 || timestamp - lastDispatchTime >= zoomDispatchIntervalMs

    if (shouldDispatch) {
      currentZoomStart = nextZoomStart
      dispatchZoom(nextZoomStart)
      lastDispatchTime = timestamp
    }

    if (progress < 1 && typeof window.requestAnimationFrame === 'function') {
      pendingAnimationFrame = window.requestAnimationFrame(tick)
    } else {
      currentZoomStart = targetZoomStart
      dispatchZoom(targetZoomStart)
      pendingAnimationFrame = null
      onComplete?.()
    }
  }

  if (typeof window.requestAnimationFrame === 'function') {
    pendingAnimationFrame = window.requestAnimationFrame(tick)
  } else {
    currentZoomStart = targetZoomStart
    dispatchZoom(targetZoomStart)
    onComplete?.()
  }
}

function finishRangeAnimation(targetDays: number) {
  const targetItems = getVisibleItems(targetDays)
  renderChart(targetItems, 0)
  currentVisibleDays = targetDays
  layoutDays.value = targetDays
}

function animateVisibleDaysChange(targetDays: number) {
  const previousDays = Math.min(currentVisibleDays, props.items.length)
  const nextDays = Math.min(targetDays, props.items.length)
  if (previousDays === nextDays) {
    renderChart(getVisibleItems(targetDays), 0)
    currentVisibleDays = targetDays
    layoutDays.value = targetDays
    return
  }

  clearPendingAnimationFrame()

  if (nextDays > previousDays) {
    const animationItems = getVisibleItems(targetDays)
    const startZoom = getZoomStartPercent(animationItems, previousDays)
    layoutDays.value = targetDays
    renderChart(animationItems, startZoom)
    currentVisibleDays = targetDays
    animateZoomTo(0)
    return
  }

  const animationItems = renderedItems.length ? renderedItems : getVisibleItems(previousDays)
  const targetZoom = getZoomStartPercent(animationItems, nextDays)
  layoutDays.value = previousDays
  renderChart(animationItems, currentZoomStart)
  animateZoomTo(targetZoom, () => {
    finishRangeAnimation(targetDays)
  })
}

function updateChartForProps() {
  if (!chart) {
    renderChart()
    syncSourceDataSignature()
    currentVisibleDays = props.visibleDays
    layoutDays.value = props.visibleDays
    return
  }

  const visibleItems = getVisibleItems()
  const nextSourceDataSignature = getItemsSignature(props.items)
  const nextDataSignature = getItemsSignature(visibleItems)
  if (nextSourceDataSignature !== currentSourceDataSignature) {
    clearPendingAnimationFrame()
    renderChart(visibleItems, 0)
    syncSourceDataSignature()
    currentVisibleDays = props.visibleDays
    layoutDays.value = props.visibleDays
    return
  }

  if (props.visibleDays === currentVisibleDays && nextDataSignature !== currentDataSignature) {
    clearPendingAnimationFrame()
    renderChart(visibleItems, 0)
    return
  }

  animateVisibleDaysChange(props.visibleDays)
}

function handleResize() {
  chart?.resize()
  if (chart) dispatchZoom(currentZoomStart)
}

onMounted(async () => {
  await nextTick()
  renderChart()
  syncSourceDataSignature()

  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(chartRef.value)
  }
})

watch(
  () => [props.items, props.label, props.visibleDays],
  () => {
    updateChartForProps()
  },
  { deep: true, flush: 'post' },
)

onBeforeUnmount(() => {
  clearPendingAnimationFrame()
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="access-trend-chart-viewport">
    <div ref="chartRef" class="access-trend-chart" :style="{ minWidth: chartMinWidth }" role="img" :aria-label="label" />
  </div>
</template>

<style scoped>
.access-trend-chart-viewport {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.access-trend-chart {
  width: 100%;
  min-width: 0;
  height: 172px;
  cursor: grab;
  touch-action: pan-x pan-y;
}

.access-trend-chart:active {
  cursor: grabbing;
}

@media (max-width: 640px) {
  .access-trend-chart-viewport {
    padding-bottom: 2px;
  }

  .access-trend-chart {
    height: 176px;
  }
}
</style>
