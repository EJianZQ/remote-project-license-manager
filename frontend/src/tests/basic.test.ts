import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { i18n, setLocale } from '@/i18n'
import { buildAgentAccessPrompt, buildFetchExample } from '@/utils/accessInfo'
import { normalizeDomainList } from '@/utils/domain'
import { parseJsonObject } from '@/utils/json'

beforeEach(() => {
  setLocale('zh-CN')
})

describe('StatusBadge', () => {
  it('renders Chinese labels by status', () => {
    const global = { plugins: [i18n] }

    expect(mount(StatusBadge, { props: { status: 'active' }, global }).text()).toBe('正常')
    expect(mount(StatusBadge, { props: { status: 'grace' }, global }).text()).toBe('宽限期')
    expect(mount(StatusBadge, { props: { status: 'expired' }, global }).text()).toBe('已到期')
    expect(mount(StatusBadge, { props: { status: 'suspended' }, global }).text()).toBe('已暂停')
  })
})

describe('parseJsonObject', () => {
  it('accepts valid JSON objects and rejects invalid values', () => {
    expect(parseJsonObject('{"title":"酒店预定"}').ok).toBe(true)
    expect(parseJsonObject('[1,2,3]').ok).toBe(false)
    expect(parseJsonObject('"text"').ok).toBe(false)
    expect(parseJsonObject('{bad json}').ok).toBe(false)
  })

  it('reports syntax error location when runtime exposes it', () => {
    const result = parseJsonObject('{\n  "title":\n}')

    expect(result.ok).toBe(false)
    if (!result.ok && result.line) {
      expect(result.line).toBeGreaterThanOrEqual(1)
      expect(result.column).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('normalizeDomainList', () => {
  it('trims, deduplicates and rejects protocol domains', () => {
    const result = normalizeDomainList([' Example.com ', 'example.com', 'www.example.com', 'https://bad.com'])

    expect(result.domains).toEqual(['example.com', 'www.example.com'])
    expect(result.errors).toHaveLength(1)
  })
})

describe('accessInfo builders', () => {
  it('builds a fetch example with the public endpoint', () => {
    const endpoint = 'http://localhost:3001/api/public/projects/jdyd/config?key=public-key'

    expect(buildFetchExample(endpoint)).toContain(`fetch("${endpoint}")`)
  })

  it('builds an agent prompt with key integration requirements', () => {
    const endpoint = 'http://localhost:3001/api/public/projects/jdyd/config?key=public-key'
    const prompt = buildAgentAccessPrompt({
      endpoint,
      projectName: '酒店预定',
      slug: 'jdyd',
    })

    expect(prompt).toContain('酒店预定')
    expect(prompt).toContain('项目 slug：jdyd')
    expect(prompt).toContain(endpoint)
    expect(prompt).toContain("type LicenseStatus = 'active' | 'grace' | 'expired' | 'suspended' | 'unknown'")
    expect(prompt).toContain('随机 3 到 10 秒')
    expect(prompt).toContain('Pinia')
    expect(prompt).toContain('variables 只负责保存')
    expect(prompt).toContain('不要自动改业务页面')
    expect(prompt).toContain('只在 console 中输出 message')
    expect(prompt).toContain('LicenseStatus 明确是 suspended')
    expect(prompt).toContain('授权暂停页面')
    expect(prompt).toContain('不要给用户展示任何温和提示')
    expect(prompt).toContain('不要在多个页面里重复写 fetch')
    expect(prompt).toContain('randomDelay(3000, 10000)')
    expect(prompt).toContain('最终输出要求')
  })
})
