import { request } from './http'
import type { AccessLog, AccessLogParams, ActionLogParams, AdminActionLog, PageResponse } from './types'

export function getProjectAccessLogs(
  projectId: number | string,
  params: Pick<AccessLogParams, 'page' | 'pageSize'> = {},
) {
  return request<PageResponse<AccessLog>>({
    url: `/api/admin/projects/${projectId}/access-logs`,
    method: 'GET',
    params,
  })
}

export function getAccessLogs(params: AccessLogParams = {}) {
  return request<PageResponse<AccessLog>>({
    url: '/api/admin/access-logs',
    method: 'GET',
    params,
  })
}

export function getActionLogs(params: ActionLogParams = {}) {
  return request<PageResponse<AdminActionLog>>({
    url: '/api/admin/action-logs',
    method: 'GET',
    params,
  })
}
