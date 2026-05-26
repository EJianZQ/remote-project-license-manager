import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectPayload } from '@/api/types'

const requestMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/http', () => ({
  request: requestMock,
}))

import { getMe, login, logout } from '@/api/auth'
import {
  createProject,
  deleteProject,
  getProject,
  getProjects,
  regenerateProjectKey,
  updateProject,
} from '@/api/projects'
import { getAccessLogs, getActionLogs, getProjectAccessLogs } from '@/api/logs'

const projectPayload: ProjectPayload = {
  name: '酒店预定',
  slug: 'jdyd',
  enabled: true,
  status: 'active',
  expiresAt: '2026-06-01T00:00:00.000Z',
  popupEnabled: true,
  popupTitle: '项目服务提醒',
  popupContent: '请及时完成尾款结算',
  popupLevel: 'warning',
  variables: { title: '酒店预定主页' },
  allowedDomains: ['example.com'],
  remarks: '内部备注',
}

beforeEach(() => {
  requestMock.mockReset()
  requestMock.mockResolvedValue(undefined)
})

describe('auth API contracts', () => {
  it('calls the documented admin auth endpoints', async () => {
    await login({ username: 'admin', password: '123456' })
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/auth/login',
      method: 'POST',
      data: { username: 'admin', password: '123456' },
    })

    await getMe()
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/auth/me',
      method: 'GET',
    })

    await logout()
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/auth/logout',
      method: 'POST',
    })
  })
})

describe('project API contracts', () => {
  it('passes list filters through to GET /api/admin/projects', async () => {
    const params = { keyword: 'jdyd', status: 'active' as const, enabled: false, page: 2, pageSize: 50 }

    await getProjects(params)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/admin/projects',
      method: 'GET',
      params,
    })
  })

  it('calls project detail, create, update, key regeneration and delete endpoints', async () => {
    await getProject(12)
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/projects/12',
      method: 'GET',
    })

    await createProject(projectPayload)
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/projects',
      method: 'POST',
      data: projectPayload,
    })

    await updateProject('12', projectPayload)
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/projects/12',
      method: 'PUT',
      data: projectPayload,
    })

    await regenerateProjectKey(12)
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/projects/12/regenerate-key',
      method: 'POST',
    })

    await deleteProject('12')
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/projects/12',
      method: 'DELETE',
    })
  })
})

describe('log API contracts', () => {
  it('calls project-scoped access log endpoint with filters but without projectId', async () => {
    const projectScopedParams = {
      projectId: 99,
      slug: ' jdyd ',
      publicKey: ' public-key ',
      requestDomain: ' example.com ',
      ip: ' 127.0.0.1 ',
      origin: '',
      referer: ' /checkout ',
      userAgent: ' Chrome ',
      message: ' 宽限期 ',
      effectiveStatus: 'grace' as const,
      allowed: false,
      createdAtFrom: ' 2026-05-25T10:30:00+08:00 ',
      createdAtTo: '2026-05-25T11:30:00+08:00',
      page: 1,
      pageSize: 10,
    }

    await getProjectAccessLogs(12, projectScopedParams)

    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/admin/projects/12/access-logs',
      method: 'GET',
      params: {
        slug: 'jdyd',
        publicKey: 'public-key',
        requestDomain: 'example.com',
        ip: '127.0.0.1',
        referer: '/checkout',
        userAgent: 'Chrome',
        message: '宽限期',
        effectiveStatus: 'grace',
        allowed: 'false',
        createdAtFrom: '2026-05-25T10:30:00+08:00',
        createdAtTo: '2026-05-25T11:30:00+08:00',
        page: 1,
        pageSize: 10,
      },
    })
  })

  it('calls global access and action log endpoints with filters', async () => {
    await getAccessLogs({
      projectId: ' 12 ',
      slug: 'jdyd',
      publicKey: '',
      requestDomain: ' example.com ',
      ip: '127.0.0.1',
      origin: 'https://example.com',
      referer: '',
      userAgent: 'Mozilla',
      message: '到期',
      effectiveStatus: 'expired',
      allowed: true,
      createdAtFrom: '2026-05-25T10:30:00+08:00',
      createdAtTo: '2026-05-25T11:30:00+08:00',
      page: 3,
      pageSize: 20,
    })
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/access-logs',
      method: 'GET',
      params: {
        projectId: '12',
        slug: 'jdyd',
        requestDomain: 'example.com',
        ip: '127.0.0.1',
        origin: 'https://example.com',
        userAgent: 'Mozilla',
        message: '到期',
        effectiveStatus: 'expired',
        allowed: 'true',
        createdAtFrom: '2026-05-25T10:30:00+08:00',
        createdAtTo: '2026-05-25T11:30:00+08:00',
        page: 3,
        pageSize: 20,
      },
    })

    await getActionLogs({ action: 'create_project', targetType: 'project', targetId: 12, page: 1, pageSize: 20 })
    expect(requestMock).toHaveBeenLastCalledWith({
      url: '/api/admin/action-logs',
      method: 'GET',
      params: { action: 'create_project', targetType: 'project', targetId: 12, page: 1, pageSize: 20 },
    })
  })
})
