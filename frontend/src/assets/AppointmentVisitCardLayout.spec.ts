import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appointment = readFileSync(resolve(process.cwd(), 'src/views/AppointmentView.vue'), 'utf8')

describe('desktop appointment electronic museum pass layout (Heluo Editorial 2.0)', () => {
  it('renders a perforated electronic museum pass with live selection values', () => {
    expect(appointment).toContain('class="museum-pass"')
    expect(appointment).toContain('class="pass-perforation"')
    expect(appointment).toContain('class="pass-perforation__notch pass-perforation__notch--left"')
    expect(appointment).toContain('class="pass-seal"')
    expect(appointment).toMatch(/\.appointment-venue\s*\{[^}]*aspect-ratio:\s*16 \/ 9/s)
  })

  it('keeps icons compact and venue metadata cleanly aligned', () => {
    expect(appointment).toMatch(/\.appointment-workbench svg\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s)
    expect(appointment).toMatch(/\.appointment-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 380px/s)
  })
})
