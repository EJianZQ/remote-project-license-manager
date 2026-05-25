import { defineStore } from 'pinia'
import type { ProjectStatus } from '@/api/types'

export interface ProjectFilters {
  keyword: string
  status: ProjectStatus | null
  enabled: boolean | null
  page: number
  pageSize: number
}

export const useProjectStore = defineStore('project', {
  state: () => ({
    filters: {
      keyword: '',
      status: null,
      enabled: null,
      page: 1,
      pageSize: 20,
    } as ProjectFilters,
  }),
  actions: {
    resetFilters() {
      Object.assign(this.filters, {
        keyword: '',
        status: null,
        enabled: null,
        page: 1,
        pageSize: 20,
      })
    },
  },
})
