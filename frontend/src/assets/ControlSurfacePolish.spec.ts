import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsCss = readFileSync(resolve(process.cwd(), 'src/styles/04-components.css'), 'utf8')
const adminCss = readFileSync(resolve(process.cwd(), 'src/styles/07-admin.css'), 'utf8')
const explore = readFileSync(resolve(process.cwd(), 'src/views/ExploreView.vue'), 'utf8')
const appointment = readFileSync(resolve(process.cwd(), 'src/views/AppointmentView.vue'), 'utf8')
const adminContent = readFileSync(resolve(process.cwd(), 'src/views/AdminContentView.vue'), 'utf8')
const adminOperations = readFileSync(resolve(process.cwd(), 'src/views/AdminOperationsView.vue'), 'utf8')

describe('Heluo Editorial 2.0 control surface and accessibility contract', () => {
  it('keeps search focus on the outer control without nested input shadows or !important', () => {
    expect(componentsCss).toContain('.museum-search-field__control:focus-within')
    expect(componentsCss).toContain('.museum-search-field__control.has-clear')
    expect(componentsCss).not.toContain('!important')
  })

  it('renders the Explore themes as semantic links to published categories', () => {
    expect(explore).toContain('class="gallery-themes__links"')
    expect(explore).toContain('v-for="category in categories"')
    expect(explore).toContain('query: { category: category.code }')
    expect(explore).toContain("hash: '#collection-title'")
  })

  it('renders booking electronic pass semantics and keeps the venue image attributable', () => {
    expect(appointment).toContain('class="museum-pass"')
    expect(appointment).toContain('class="pass-perforation"')
    expect(appointment).toContain('class="appointment-summary"')
    expect(appointment).toContain('class="appointment-venue"')
    expect(appointment).toContain('<figcaption>{{ workbenchCopy.concept }}</figcaption>')
    expect(existsSync(resolve(process.cwd(), 'public/media/editorial/museum-exterior-watercolor.webp'))).toBe(true)
    expect(appointment).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it('keeps accessible visitor controls and the original booking boundaries', () => {
    expect(appointment).toContain('visitor-stepper__input')
    expect(appointment).toContain('const minimumVisitorCount = 1')
    expect(appointment).toContain('const maximumVisitorCount = 30')
    expect(appointment).toContain(':aria-label="pageCopy.decreaseVisitors"')
    expect(appointment).toContain(':aria-label="pageCopy.increaseVisitors"')
    expect(appointment).toContain('@blur="normalizeVisitorCount"')
  })

  it('separates admin navigation from labeled filter fields and harmonizes Element Plus', () => {
    expect(adminContent).toContain('class="admin-filter-field admin-filter-field--search"')
    expect(adminOperations).toContain('class="admin-toolbar admin-toolbar--operations"')
    expect(adminOperations).toContain('class="admin-filter-field__label"')
    expect(adminCss).toContain('--el-color-primary: var(--accent-jade);')
    expect(adminCss).toContain('.admin-filter-field :where(input, select)')
    expect(adminCss).not.toContain('!important')
  })
})
