<script setup lang="ts">
import { computed } from 'vue'
import type { GlobalThemeOverrides } from 'naive-ui'
import { dateEnUS, dateZhCN, dateZhTW, enUS, zhCN, zhTW } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { LocaleCode } from '@/i18n/messages'

const { locale } = useI18n()

const naiveLocale = computed(() => {
  const map = {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'en-US': enUS,
  } satisfies Record<LocaleCode, typeof zhCN>

  return map[locale.value as LocaleCode]
})

const naiveDateLocale = computed(() => {
  const map = {
    'zh-CN': dateZhCN,
    'zh-TW': dateZhTW,
    'en-US': dateEnUS,
  } satisfies Record<LocaleCode, typeof dateZhCN>

  return map[locale.value as LocaleCode]
})

const themeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily:
      '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif',
    primaryColor: '#1d1d1f',
    primaryColorHover: '#303033',
    primaryColorPressed: '#000000',
    primaryColorSuppl: '#1d1d1f',
    borderRadius: '14px',
    textColorBase: '#1d1d1f',
    bodyColor: '#f5f5f7',
  },
  Button: {
    borderRadiusTiny: '12px',
    borderRadiusSmall: '12px',
    borderRadiusMedium: '14px',
    borderRadiusLarge: '16px',
    fontWeight: '600',
    colorPrimary: '#1d1d1f',
    colorHoverPrimary: '#303033',
    colorPressedPrimary: '#000000',
    colorFocusPrimary: '#1d1d1f',
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
  },
  Card: {
    borderRadius: '18px',
  },
  DataTable: {
    thColor: '#fbfbfd',
    tdColor: '#ffffff',
    borderColor: 'rgba(29, 29, 31, 0.08)',
    thTextColor: '#6e6e73',
    tdTextColor: '#1d1d1f',
    thFontWeight: '500',
    fontSizeMedium: '14px',
  },
  Input: {
    borderRadius: '14px',
    heightMedium: '44px',
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '14px',
        heightMedium: '44px',
      },
    },
  },
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides" :locale="naiveLocale" :date-locale="naiveDateLocale">
    <n-message-provider>
      <n-dialog-provider>
        <n-loading-bar-provider>
          <router-view />
        </n-loading-bar-provider>
      </n-dialog-provider>
    </n-message-provider>
    <n-global-style />
  </n-config-provider>
</template>

<style scoped></style>
