import { request } from './http'
import type {
  PageResponse,
  Project,
  ProjectListItem,
  ProjectListParams,
  ProjectPayload,
  RegenerateProjectKeyResult,
} from './types'

export function getProjects(params: ProjectListParams = {}) {
  return request<PageResponse<ProjectListItem>>({
    url: '/api/admin/projects',
    method: 'GET',
    params,
  })
}

export function getProject(id: number | string) {
  return request<Project>({
    url: `/api/admin/projects/${id}`,
    method: 'GET',
  })
}

export function createProject(payload: ProjectPayload) {
  return request<Project>({
    url: '/api/admin/projects',
    method: 'POST',
    data: payload,
  })
}

export function updateProject(id: number | string, payload: ProjectPayload) {
  return request<Project>({
    url: `/api/admin/projects/${id}`,
    method: 'PUT',
    data: payload,
  })
}

export function regenerateProjectKey(id: number | string) {
  return request<RegenerateProjectKeyResult>({
    url: `/api/admin/projects/${id}/regenerate-key`,
    method: 'POST',
  })
}

export function deleteProject(id: number | string) {
  return request<null>({
    url: `/api/admin/projects/${id}`,
    method: 'DELETE',
  })
}
