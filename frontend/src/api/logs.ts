import { request } from './http'
import type {
  AccessLog,
  AccessLogParams,
  AccessLogStatsParams,
  ActionLogParams,
  AdminActionLog,
  DailyAccessLogStatsParams,
  DailyAccessLogStats,
  PageResponse,
  ProjectAccessLogParams,
  TodayAccessLogStats,
} from './types'

type AccessLogQueryValue = number | string
type AccessLogQuery = Record<string, AccessLogQueryValue>

const textFilterKeys = [
  'slug',
  'publicKey',
  'requestDomain',
  'ip',
  'origin',
  'referer',
  'userAgent',
  'message',
  'createdAtFrom',
  'createdAtTo',
] as const

const statsTextFilterKeys = [
  'slug',
  'publicKey',
  'requestDomain',
  'ip',
  'origin',
  'referer',
  'userAgent',
  'message',
] as const

function addTrimmedParam(query: AccessLogQuery, key: string, value: number | string | undefined) {
  if (value === undefined) return

  if (typeof value === 'number') {
    query[key] = value
    return
  }

  const trimmed = value.trim()
  if (trimmed) {
    query[key] = trimmed
  }
}

function normalizeAccessLogParams(params: AccessLogParams, options: { omitProjectId?: boolean } = {}) {
  const query: AccessLogQuery = {}

  if (!options.omitProjectId) {
    addTrimmedParam(query, 'projectId', params.projectId)
  }

  for (const key of textFilterKeys) {
    addTrimmedParam(query, key, params[key])
  }

  if (params.effectiveStatus) {
    query.effectiveStatus = params.effectiveStatus
  }

  if (params.allowed !== undefined) {
    query.allowed = typeof params.allowed === 'boolean' ? String(params.allowed) : params.allowed
  }

  if (params.page !== undefined) {
    query.page = params.page
  }

  if (params.pageSize !== undefined) {
    query.pageSize = params.pageSize
  }

  return query
}

function normalizeAccessLogStatsParams(params: AccessLogStatsParams) {
  const query: AccessLogQuery = {}

  addTrimmedParam(query, 'timezone', params.timezone)
  addTrimmedParam(query, 'projectId', params.projectId)

  for (const key of statsTextFilterKeys) {
    addTrimmedParam(query, key, params[key])
  }

  if (params.effectiveStatus) {
    query.effectiveStatus = params.effectiveStatus
  }

  if (params.allowed !== undefined) {
    query.allowed = typeof params.allowed === 'boolean' ? String(params.allowed) : params.allowed
  }

  return query
}

export function getProjectAccessLogs(
  projectId: number | string,
  params: ProjectAccessLogParams = {},
) {
  return request<PageResponse<AccessLog>>({
    url: `/api/admin/projects/${projectId}/access-logs`,
    method: 'GET',
    params: normalizeAccessLogParams(params, { omitProjectId: true }),
  })
}

export function getAccessLogs(params: AccessLogParams = {}) {
  return request<PageResponse<AccessLog>>({
    url: '/api/admin/access-logs',
    method: 'GET',
    params: normalizeAccessLogParams(params),
  })
}

export function getTodayAccessLogStats(params: AccessLogStatsParams) {
  return request<TodayAccessLogStats>({
    url: '/api/admin/access-logs/stats/today',
    method: 'GET',
    params: normalizeAccessLogStatsParams(params),
  })
}

export function getDailyAccessLogStats(params: DailyAccessLogStatsParams) {
  const query = normalizeAccessLogStatsParams(params)
  if (params.days !== undefined) {
    query.days = params.days
  }

  return request<DailyAccessLogStats>({
    url: '/api/admin/access-logs/stats/daily',
    method: 'GET',
    params: query,
  })
}

export function getActionLogs(params: ActionLogParams = {}) {
  return request<PageResponse<AdminActionLog>>({
    url: '/api/admin/action-logs',
    method: 'GET',
    params,
  })
}
