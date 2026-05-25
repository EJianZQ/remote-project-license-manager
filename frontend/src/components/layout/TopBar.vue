<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ChevronDown, LogOut, Menu } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

defineEmits<{
  toggleNav: []
}>()

const auth = useAuthStore()
const router = useRouter()
const message = useMessage()
const { t } = useI18n()

async function handleLogout() {
  try {
    await auth.logout()
    message.success(t('common.logoutSuccess'))
    await router.push({ name: 'login' })
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('common.logoutFailed'))
  }
}
</script>

<template>
  <header class="top-bar">
    <button class="menu-button" type="button" :aria-label="t('common.openNav')" @click="$emit('toggleNav')">
      <Menu :size="20" />
    </button>

    <div class="top-title">
      <strong>{{ t('common.adminConsole') }}</strong>
      <span>{{ t('common.adminDescription') }}</span>
    </div>

    <div class="top-actions">
      <div class="admin-chip">
        <span class="admin-dot" />
        {{ auth.user?.username || 'admin' }}
        <ChevronDown :size="14" :stroke-width="1.8" />
      </div>

      <n-popconfirm :positive-text="t('common.logout')" :negative-text="t('common.cancel')" @positive-click="handleLogout">
        <template #trigger>
          <n-button secondary class="logout-button">
            <span class="icon-button-content">
              <LogOut :size="16" />
              {{ t('common.logout') }}
            </span>
          </n-button>
        </template>
        {{ t('common.confirmLogout') }}
      </n-popconfirm>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 80px;
  padding: 0 30px 0 34px;
  background: rgba(255, 255, 255, 0.86);
  border-bottom: 1px solid var(--border-soft);
  backdrop-filter: blur(22px);
}

.menu-button {
  display: none;
  width: 40px;
  height: 40px;
  place-items: center;
  color: var(--text-main);
  background: #fff;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
}

.top-title {
  display: flex;
  align-items: baseline;
  min-width: 0;
  gap: 28px;
}

.top-title strong {
  min-width: 0;
  color: var(--text-main);
  font-family: var(--font-apple-display);
  font-size: 18px;
  font-weight: 700;
}

.top-title span {
  color: var(--text-secondary);
  font-family: var(--font-apple-text);
  font-size: 15px;
  font-weight: 400;
}

.top-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.admin-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.035);
  font-size: 15px;
  font-weight: 600;
}

.admin-dot {
  width: 8px;
  height: 8px;
  background: #17c964;
  border-radius: 50%;
}

.logout-button {
  min-height: 44px;
}

@media (max-width: 900px) {
  .top-bar {
    gap: 14px;
    min-height: 66px;
    padding: 0 16px;
  }

  .menu-button {
    display: grid;
    flex: 0 0 auto;
  }

  .top-title span {
    display: none;
  }

  .admin-chip {
    display: none;
  }
}

@media (max-width: 560px) {
  .top-bar {
    gap: 10px;
    padding: 0 12px;
  }

  .top-title {
    flex: 1 1 auto;
    overflow: hidden;
  }

  .top-title strong {
    display: block;
    max-width: 100%;
    overflow: hidden;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logout-button {
    width: 42px;
    min-width: 42px;
    padding: 0 !important;
  }

  .logout-button .icon-button-content {
    gap: 0;
    font-size: 0;
  }
}
</style>
