<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SideNav from '@/components/layout/SideNav.vue'
import TopBar from '@/components/layout/TopBar.vue'

const mobileNavOpen = ref(false)
const route = useRoute()
const { t } = useI18n()
const wideContentRouteNames = new Set(['projects', 'access-logs', 'action-logs'])
const isWideContent = computed(() => wideContentRouteNames.has(String(route.name)))
</script>

<template>
  <div class="admin-shell">
    <SideNav class="desktop-nav" />
    <SideNav class="mobile-nav" :class="{ open: mobileNavOpen }" @navigate="mobileNavOpen = false" />
    <button
      v-if="mobileNavOpen"
      class="nav-backdrop"
      type="button"
      :aria-label="t('common.closeNav')"
      @click="mobileNavOpen = false"
    />

    <div class="admin-content">
      <TopBar @toggle-nav="mobileNavOpen = !mobileNavOpen" />
      <main class="admin-main" :class="{ 'admin-main--wide': isWideContent }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  overflow: hidden;
  min-width: 0;
  height: 100vh;
  min-height: 0;
  background:
    radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0) 320px),
    var(--app-bg);
}

.desktop-nav {
  flex: 0 0 260px;
  height: 100vh;
  overflow-y: auto;
}

.mobile-nav,
.nav-backdrop {
  display: none;
}

.admin-content {
  display: flex;
  min-width: 0;
  height: 100vh;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.admin-main {
  min-height: 0;
  flex: 1;
  width: 100%;
  margin: 0;
  overflow-y: auto;
  padding: 46px clamp(44px, 3.6vw, 74px) 36px;
  overscroll-behavior: contain;
}

.admin-main--wide {
  width: 100%;
  padding-right: clamp(32px, 3vw, 64px);
  padding-left: clamp(32px, 3vw, 64px);
}

@media (max-width: 900px) {
  .desktop-nav {
    display: none;
  }

  .mobile-nav {
    position: fixed;
    z-index: 30;
    top: 0;
    left: 0;
    display: flex;
    width: min(86vw, 312px);
    height: 100vh;
    transform: translateX(-105%);
    transition: transform 180ms ease;
  }

  .mobile-nav.open {
    transform: translateX(0);
  }

  .nav-backdrop {
    position: fixed;
    z-index: 20;
    inset: 0;
    display: block;
    padding: 0;
    background: rgba(0, 0, 0, 0.18);
    border: 0;
  }

  .admin-main {
    padding: 20px 14px 32px;
  }

  .admin-main--wide {
    padding-right: 14px;
    padding-left: 14px;
  }
}

@media (max-width: 420px) {
  .admin-main,
  .admin-main--wide {
    padding-right: 10px;
    padding-left: 10px;
  }
}
</style>
