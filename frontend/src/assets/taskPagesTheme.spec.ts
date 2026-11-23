/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const adminCss = read('src/styles/07-admin.css')
const entry = read('src/main.ts')
const login = read('src/views/LoginView.vue')
const profile = read('src/views/ProfileView.vue')
const appointment = read('src/views/AppointmentView.vue')

describe('task pages and admin workspace theme contract (Heluo Editorial 2.0)', () => {
  it('keeps admin styles route-scoped instead of bloating the public home bundle', () => {
    expect(entry).not.toContain('07-admin.css')
    expect(read('src/views/AdminContentView.vue')).toContain("import '../styles/07-admin.css'")
    expect(read('src/views/AdminOperationsView.vue')).toContain("import '../styles/07-admin.css'")
  })

  it('scopes login 55:45 split layout and visitor archive profile independently with tokens only', () => {
    expect(login).toContain('task-auth-page')
    expect(login).toContain('grid-template-columns: 55fr 45fr')
    expect(login).toContain('auth-story__scrim')
    expect(login).not.toMatch(/#[0-9a-f]{3,8}\b/i)

    expect(profile).toContain('profile-page')
    expect(profile).toContain('profile-account-panel')
    expect(profile).not.toMatch(/#[0-9a-f]{3,8}\b/i)

    expect(appointment).toContain('museum-pass')
    expect(appointment).not.toContain('task-pages.css')
  })

  it('keeps the admin workbench quiet, dense, flush and Element-Plus harmonized', () => {
    expect(adminCss).toContain('grid-template-columns: 240px minmax(0, 1fr)')
    expect(adminCss).toContain('height: 100dvh')
    expect(adminCss).toContain('font-variant-numeric: tabular-nums')
    expect(adminCss).toContain('--el-color-primary: var(--accent-jade)')
    expect(adminCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(adminCss).not.toContain('!important')
  })
})
