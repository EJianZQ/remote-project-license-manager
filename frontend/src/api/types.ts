export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminUser {
  username: string
}

export type ProjectStatus = 'active' | 'grace' | 'expired' | 'suspended'

export type PopupLevel = 'info' | 'warning' | 'danger'

export interface ProjectListItem {
  id: number
  name: string
  slug: string
  publicKey: string
  enabled: boolean
  status: ProjectStatus
  effectiveStatus: ProjectStatus
  expiresAt: string | null
  popupEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Project extends ProjectListItem {
  popupTitle: string
  popupContent: string
  popupLevel: PopupLevel
  variables: Record<string, unknown>
  allowedDomains: string[]
  remarks: string
}

export interface ProjectPayload {
  name: string
  slug: string
  enabled: boolean
  status: ProjectStatus
  expiresAt: string | null
  popupEnabled: boolean
  popupTitle: string
  popupContent: string
  popupLevel: PopupLevel
  variables: Record<string, unknown>
  allowedDomains: string[]
  remarks: string
}

export interface ProjectListParams {
  keyword?: string
  status?: ProjectStatus
  enabled?: boolean
  page?: number
  pageSize?: number
}

export interface RegenerateProjectKeyResult {
  publicKey: string
  project: Project
}

export interface AccessLog {
  id: number
  projectId: number | null
  slug: string
  publicKey: string | null
  requestDomain: string | null
  origin: string | null
  referer: string | null
  ip: string | null
  userAgent: string | null
  effectiveStatus: ProjectStatus | null
  allowed: boolean
  message: string | null
  createdAt: string
}

export interface AccessLogParams {
  slug?: string
  effectiveStatus?: ProjectStatus
  allowed?: boolean
  page?: number
  pageSize?: number
}

export interface AdminActionLog {
  id: number
  action: string
  targetType: string
  targetId: number | null
  before: unknown | null
  after: unknown | null
  ip: string
  userAgent: string
  createdAt: string
}

export interface ActionLogParams {
  action?: string
  targetType?: string
  targetId?: number | string
  page?: number
  pageSize?: number
}
