<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronDown, FileClock, FolderKanban, LayoutDashboard, ShieldCheck } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import cnFlag from 'flag-icons/flags/4x3/cn.svg'
import twFlag from 'flag-icons/flags/4x3/tw.svg'
import auFlag from 'flag-icons/flags/4x3/au.svg'
import { localeOptions, setLocale } from '@/i18n'
import type { LocaleCode } from '@/i18n/messages'

defineEmits<{
  navigate: []
}>()

const route = useRoute()
const { locale, t } = useI18n()
const languageMenuOpen = ref(false)
const languageSwitcherRef = ref<HTMLElement | null>(null)

const items = [
  { labelKey: 'nav.dashboard', to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.projects', to: '/projects', key: 'projects', icon: FolderKanban },
  { labelKey: 'nav.accessLogs', to: '/access-logs', key: 'access-logs', icon: FileClock },
  { labelKey: 'nav.actionLogs', to: '/action-logs', key: 'action-logs', icon: ShieldCheck },
]

const flagMap = {
  cn: cnFlag,
  tw: twFlag,
  au: auFlag,
}
const defaultLocaleOption = localeOptions[0]!

const activeKey = computed(() => {
  if (route.path.startsWith('/projects')) return 'projects'
  if (route.path.startsWith('/access-logs')) return 'access-logs'
  if (route.path.startsWith('/action-logs')) return 'action-logs'
  return 'dashboard'
})

const currentLocaleOption = computed(
  () => localeOptions.find((option) => option.value === locale.value) ?? defaultLocaleOption,
)

function changeLocale(value: LocaleCode) {
  setLocale(value)
  languageMenuOpen.value = false
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!languageMenuOpen.value) return
  if (event.target instanceof Node && languageSwitcherRef.value?.contains(event.target)) return

  languageMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <aside class="side-nav">
    <div class="brand">
      <div class="brand-mark">L</div>
      <div>
        <div class="brand-title">{{ t('common.brandTitle') }}</div>
        <div class="brand-subtitle">{{ t('common.licenseConsole') }}</div>
      </div>
    </div>

    <nav class="nav-list" :aria-label="t('common.navAria')">
      <RouterLink
        v-for="item in items"
        :key="item.key"
        :to="item.to"
        class="nav-item"
        :class="{ active: activeKey === item.key }"
        @click="$emit('navigate')"
      >
        <component :is="item.icon" :size="18" :stroke-width="1.8" />
        <span>{{ t(item.labelKey) }}</span>
      </RouterLink>
    </nav>

    <div
      ref="languageSwitcherRef"
      class="language-switcher"
      :class="{ open: languageMenuOpen }"
      @keydown.esc.stop="languageMenuOpen = false"
    >
      <div class="language-title">{{ t('common.language') }}</div>
      <button
        class="language-trigger"
        type="button"
        aria-haspopup="listbox"
        :aria-expanded="languageMenuOpen"
        :aria-label="t('common.language')"
        @click="languageMenuOpen = !languageMenuOpen"
      >
        <span class="language-current">
          <img :src="flagMap[currentLocaleOption.flag]" :alt="t(currentLocaleOption.labelKey)" />
          <span>{{ t(currentLocaleOption.labelKey) }}</span>
        </span>
        <ChevronDown class="language-chevron" :size="15" :stroke-width="1.9" />
      </button>

      <div v-if="languageMenuOpen" class="language-menu" role="listbox" :aria-label="t('common.language')">
        <button
          v-for="option in localeOptions"
          :key="option.value"
          class="language-menu-option"
          :class="{ active: locale === option.value }"
          type="button"
          role="option"
          :aria-selected="locale === option.value"
          @click="changeLocale(option.value)"
        >
          <img :src="flagMap[option.flag]" :alt="t(option.labelKey)" />
          <span>{{ t(option.labelKey) }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 34px;
  padding: 30px 18px;
  background: rgba(255, 255, 255, 0.92);
  border-right: 1px solid var(--border-soft);
  backdrop-filter: blur(20px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 8px 18px;
}

.brand-mark {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #111113, #202024);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    0 10px 20px rgba(0, 0, 0, 0.12);
  font-size: 22px;
  font-weight: 800;
}

.brand-title {
  color: var(--text-main);
  font-family: var(--font-apple-display);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.25;
}

.brand-subtitle {
  color: var(--text-secondary);
  font-family: var(--font-apple-text);
  font-size: 13px;
  line-height: 1.5;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 52px;
  padding: 0 20px;
  color: var(--text-secondary);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  transition:
    color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.nav-item:hover {
  color: var(--text-main);
  background: rgba(29, 29, 31, 0.04);
}

.nav-item.active {
  color: var(--text-main);
  background: #f0f0f2;
  box-shadow: inset 0 0 0 1px rgba(29, 29, 31, 0.03);
}

.language-switcher {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding: 14px 8px 0;
  border-top: 1px solid var(--border-soft);
}

.language-title {
  padding: 0 12px 2px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.language-trigger,
.language-menu-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.language-trigger {
  justify-content: space-between;
}

.language-trigger:hover,
.language-switcher.open .language-trigger,
.language-menu-option:hover,
.language-menu-option.active {
  color: var(--text-main);
  background: rgba(29, 29, 31, 0.04);
  border-color: rgba(29, 29, 31, 0.06);
}

.language-current {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.language-current span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.language-chevron {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  transition: transform 160ms ease;
}

.language-switcher.open .language-chevron {
  transform: rotate(180deg);
}

.language-menu {
  position: absolute;
  right: 8px;
  bottom: calc(100% + 8px);
  left: 8px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
}

.language-trigger img,
.language-menu-option img {
  width: 24px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 3px;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(29, 29, 31, 0.1);
}

</style>
