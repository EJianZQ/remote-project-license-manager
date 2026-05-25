import { defineStore } from 'pinia'
import { getMe, login as loginApi, logout as logoutApi } from '@/api/auth'
import { ApiError } from '@/api/http'
import type { AdminUser } from '@/api/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AdminUser | null,
    loading: false,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
  },
  actions: {
    async login(username: string, password: string) {
      this.loading = true

      try {
        this.user = await loginApi({ username, password })
        this.initialized = true
        return this.user
      } finally {
        this.loading = false
      }
    },
    async fetchMe() {
      this.loading = true

      try {
        this.user = await getMe()
        return this.user
      } catch {
        this.user = null
        return null
      } finally {
        this.loading = false
        this.initialized = true
      }
    },
    async logout() {
      this.loading = true

      try {
        await logoutApi()
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          throw error
        }
      } finally {
        this.user = null
        this.loading = false
        this.initialized = true
      }
    },
    clear() {
      this.user = null
      this.initialized = true
    },
  },
})
