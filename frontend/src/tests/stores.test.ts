import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/http'

const authApi = vi.hoisted(() => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  getMe: authApi.getMe,
  login: authApi.login,
  logout: authApi.logout,
}))

import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

beforeEach(() => {
  setActivePinia(createPinia())
  authApi.getMe.mockReset()
  authApi.login.mockReset()
  authApi.logout.mockReset()
})

describe('useAuthStore', () => {
  it('logs in through the admin auth API and stores the returned user', async () => {
    authApi.login.mockResolvedValueOnce({ username: 'admin' })
    const auth = useAuthStore()

    const promise = auth.login('admin', '123456')
    expect(auth.loading).toBe(true)

    await expect(promise).resolves.toEqual({ username: 'admin' })

    expect(authApi.login).toHaveBeenCalledWith({ username: 'admin', password: '123456' })
    expect(auth.user).toEqual({ username: 'admin' })
    expect(auth.initialized).toBe(true)
    expect(auth.loading).toBe(false)
    expect(auth.isAuthenticated).toBe(true)
  })

  it('clears stale user state when fetchMe fails', async () => {
    authApi.getMe.mockRejectedValueOnce(new ApiError('登录已过期', 401))
    const auth = useAuthStore()
    auth.user = { username: 'stale' }

    await expect(auth.fetchMe()).resolves.toBeNull()

    expect(auth.user).toBeNull()
    expect(auth.initialized).toBe(true)
    expect(auth.loading).toBe(false)
  })

  it('swallows 401 logout errors because the local session is already invalid', async () => {
    authApi.logout.mockRejectedValueOnce(new ApiError('登录已过期', 401))
    const auth = useAuthStore()
    auth.user = { username: 'admin' }

    await expect(auth.logout()).resolves.toBeUndefined()

    expect(auth.user).toBeNull()
    expect(auth.initialized).toBe(true)
    expect(auth.loading).toBe(false)
  })

  it('rethrows non-401 logout errors while still clearing local auth state', async () => {
    authApi.logout.mockRejectedValueOnce(new ApiError('服务错误', 500))
    const auth = useAuthStore()
    auth.user = { username: 'admin' }

    await expect(auth.logout()).rejects.toMatchObject({ message: '服务错误', status: 500 })

    expect(auth.user).toBeNull()
    expect(auth.initialized).toBe(true)
    expect(auth.loading).toBe(false)
  })
})

describe('useProjectStore', () => {
  it('resets persisted project filters to the default list query', () => {
    const projectStore = useProjectStore()
    Object.assign(projectStore.filters, {
      keyword: 'jdyd',
      status: 'expired',
      enabled: false,
      page: 4,
      pageSize: 100,
    })

    projectStore.resetFilters()

    expect(projectStore.filters).toEqual({
      keyword: '',
      status: null,
      enabled: null,
      page: 1,
      pageSize: 20,
    })
  })
})
