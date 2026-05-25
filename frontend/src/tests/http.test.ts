import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '@/i18n'

const axiosMock = vi.hoisted(() => {
  const state = {
    responseRejected: null as null | ((error: unknown) => Promise<never>),
  }
  const request = vi.fn()
  const responseUse = vi.fn((_fulfilled: unknown, rejected: (error: unknown) => Promise<never>) => {
    state.responseRejected = rejected
    return 0
  })
  const create = vi.fn(() => ({
    request,
    interceptors: {
      response: {
        use: responseUse,
      },
    },
  }))
  const isAxiosError = vi.fn((error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError))

  return {
    create,
    isAxiosError,
    request,
    responseUse,
    state,
  }
})

vi.mock('axios', () => ({
  default: {
    create: axiosMock.create,
    isAxiosError: axiosMock.isAxiosError,
  },
}))

import { API_BASE_URL, ApiError, request, setUnauthorizedHandler } from '@/api/http'

beforeEach(() => {
  setLocale('zh-CN')
  axiosMock.request.mockReset()
  axiosMock.isAxiosError.mockClear()
})

describe('http client configuration', () => {
  it('uses the documented backend origin and includes admin cookies', () => {
    expect(API_BASE_URL).toBe('http://localhost:3001')
    expect(axiosMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:3001',
        timeout: 15000,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )
  })

  it('runs the unauthorized handler when a 401 response is intercepted', async () => {
    const handler = vi.fn()
    const error = { isAxiosError: true, response: { status: 401 } }

    setUnauthorizedHandler(handler)

    await expect(axiosMock.state.responseRejected?.(error)).rejects.toBe(error)
    expect(handler).toHaveBeenCalledOnce()
  })
})

describe('request', () => {
  it('unwraps successful API response data', async () => {
    axiosMock.request.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: { username: 'admin' },
      },
    })

    await expect(request({ url: '/api/admin/auth/me', method: 'GET' })).resolves.toEqual({ username: 'admin' })
    expect(axiosMock.request).toHaveBeenCalledWith({ url: '/api/admin/auth/me', method: 'GET' })
  })

  it('throws ApiError with backend message for success=false responses', async () => {
    axiosMock.request.mockResolvedValueOnce({
      status: 400,
      data: {
        success: false,
        message: 'slug 已存在',
      },
    })

    await expect(request({ url: '/api/admin/projects', method: 'POST' })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'slug 已存在',
      status: 400,
    })
  })

  it('normalizes disconnected backend errors', async () => {
    axiosMock.request.mockRejectedValueOnce({ isAxiosError: true })

    await expect(request({ url: '/api/admin/projects', method: 'GET' })).rejects.toMatchObject({
      message: '无法连接后端服务，请确认后端已启动并允许管理后台跨域访问。',
    })
  })

  it('normalizes HTTP errors without backend messages', async () => {
    axiosMock.request.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 500,
        data: {},
      },
    })

    await expect(request({ url: '/api/admin/projects', method: 'GET' })).rejects.toMatchObject({
      message: '请求失败（HTTP 500）。',
      status: 500,
    })
  })

  it('preserves existing ApiError instances', async () => {
    const error = new ApiError('自定义错误', 418)
    axiosMock.request.mockRejectedValueOnce(error)

    await expect(request({ url: '/api/admin/projects', method: 'GET' })).rejects.toBe(error)
  })
})
