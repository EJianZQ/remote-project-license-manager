import { request } from './http'
import type { AdminUser } from './types'

export interface LoginPayload {
  username: string
  password: string
}

export function login(payload: LoginPayload) {
  return request<AdminUser>({
    url: '/api/admin/auth/login',
    method: 'POST',
    data: payload,
  })
}

export function getMe() {
  return request<AdminUser>({
    url: '/api/admin/auth/me',
    method: 'GET',
  })
}

export function logout() {
  return request<null>({
    url: '/api/admin/auth/logout',
    method: 'POST',
  })
}
