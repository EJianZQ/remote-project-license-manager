import axios, { type AxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '@/config/env'
import { translate } from '@/i18n'
import type { ApiResponse } from './types'

export { API_BASE_URL }

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      unauthorizedHandler?.()
    }

    return Promise.reject(error)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<ApiResponse<T>>(config)
    const body = response.data

    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success) {
        return body.data
      }

      throw new ApiError(body.message || translate('common.requestFailed'), response.status)
    }

    return response.data as unknown as T
  } catch (error) {
    throw normalizeApiError(error)
  }
}

function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (axios.isAxiosError<ApiResponse<unknown>>(error)) {
    if (!error.response) {
      return new ApiError(translate('common.cannotConnectBackend'))
    }

    const status = error.response.status
    const message =
      error.response.data?.message ||
      (status === 401 ? translate('common.loginExpired') : translate('common.requestFailedHttp', { status }))

    return new ApiError(message, status)
  }

  return new ApiError(error instanceof Error ? error.message : translate('common.unknownError'))
}
