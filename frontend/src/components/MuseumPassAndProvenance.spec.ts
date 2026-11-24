import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.hoisted(() => vi.fn())
vi.mock('../lib/api', () => ({ apiGet }))

import { buildMuseumPassIcs, buildVerificationMatrix, defaultKeepsakePlateIndex, KEEPSAKE_PLATES } from '../lib/museumPass'
import { useCuratorialBookmarks } from '../stores/curatorialBookmarks'
import CuratorialBookmarkSheet from './CuratorialBookmarkSheet.vue'
import MuseumPassCard from './MuseumPassCard.vue'
import ProductProvenanceDrawer from './ProductProvenanceDrawer.vue'

describe('MuseumPass, CuratorialBookmarks, and ProductProvenanceDrawer', () => {
  beforeEach(() => {
    localStorage.clear()
    useCuratorialBookmarks().reloadFromStorage()
    apiGet.mockReset()
  })

  it('builds a deterministic 9x9 verification matrix and valid RFC 5545 .ics calendar payload', () => {
    const matrixA = buildVerificationMatrix('AP123456:8FA20C9B11')
    const matrixB = buildVerificationMatrix('AP123456:8FA20C9B11')
    const matrixC = buildVerificationMatrix('AP999999:1122334455')
    expect(matrixA).toHaveLength(9)
    expect(matrixA[0]).toHaveLength(9)
    expect(matrixA).toEqual(matrixB)
    expect(matrixA).not.toEqual(matrixC)

    const ics = buildMuseumPassIcs({
      appointmentNo: 'AP20261124ABCDEF',
      verificationCode: '8FA20C9B11',
      visitDate: '2026-11-28',
      startTime: '10:00:00',
      endTime: '11:30:00',
      visitorCount: 2,
      contactName: '林观澜',
      status: 'CONFIRMED',
    })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('UID:AP20261124ABCDEF@heluo-museum.local')
    expect(ics).toContain('8FA20C9B11')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('renders MuseumPassCard with Ex-Libris plate switcher, vermilion seal, PNG export and verification hex code', async () => {
    const initialIdx = defaultKeepsakePlateIndex('AP20261124ABCDEF')
    expect(KEEPSAKE_PLATES.length).toBeGreaterThanOrEqual(4)
    expect(initialIdx).toBeGreaterThanOrEqual(0)
    expect(initialIdx).toBeLessThan(KEEPSAKE_PLATES.length)

    const wrapper = mount(MuseumPassCard, {
      props: {
        pass: {
          appointmentNo: 'AP20261124ABCDEF',
          verificationCode: '8FA20C9B11',
          visitDate: '2026-11-28',
          startTime: '10:00:00',
          endTime: '11:30:00',
          visitorCount: 3,
          contactName: '林观澜',
          status: 'CONFIRMED',
        },
      },
    })
    expect(wrapper.get('[data-testid="pass-verification-code"]').text()).toBe('8FA20C9B11')
    expect(wrapper.find('[data-testid="pass-download-png"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pass-download-ics"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pass-print"]').exists()).toBe(true)

    const firstTitle = KEEPSAKE_PLATES[initialIdx]!.titleZh
    const nextTitle = KEEPSAKE_PLATES[(initialIdx + 1) % KEEPSAKE_PLATES.length]!.titleZh
    expect(wrapper.text()).toContain(firstTitle)
    await wrapper.get('[data-testid="pass-switch-plate"]').trigger('click')
    expect(wrapper.text()).toContain(nextTitle)
    wrapper.unmount()
  })

  it('persists personal viewing reflection notes inside CuratorialBookmarkSheet', async () => {
    const store = useCuratorialBookmarks()
    store.toggleBookmark({
      kind: 'exhibit',
      slug: 'river-map-stone-raking',
      title: '河洛图纹石板',
      subtitle: '暗房斜射光与乌金拓',
      path: '/exhibits/river-map-stone-raking',
    })
    store.openSheet()

    const wrapper = mount(CuratorialBookmarkSheet, {
      attachTo: document.body,
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    const noteInput = document.body.querySelector<HTMLInputElement>('[data-testid="bookmark-note-input"]')
    expect(noteInput).not.toBeNull()
    expect(document.body.querySelector('[data-testid="notebook-export-png"]')).not.toBeNull()
    noteInput!.value = '乌金拓纹饰极其清晰，值得细看车马队列'
    noteInput!.dispatchEvent(new Event('input'))
    await flushPromises()

    store.reloadFromStorage()
    expect(store.items.value[0]?.note).toBe('乌金拓纹饰极其清晰，值得细看车马队列')

    store.closeSheet()
    wrapper.unmount()
  })

  it('loads product provenance diptych and saves/removes bookmark locally without sign-in', async () => {
    apiGet.mockImplementation((path: string) => {
      if (path === '/products/river-map-notebook') {
        return Promise.resolve({
          id: 3,
          slug: 'river-map-notebook',
          name: '河图纹笔记本',
          nameEn: 'River-Map Pattern Notebook',
          summary: '把河洛图纹带进每天的记录与灵感。',
          description: '设计灵感源自馆内概念展品《河洛图纹石板》。',
          price: '39.00',
          availableStock: 20,
          coverImageUrl: '/media/products/river-map-notebook.webp',
          inspirationArtifactSlug: 'river-map-pattern-stone',
        })
      }
      if (path === '/artifacts/river-map-pattern-stone') {
        return Promise.resolve({
          slug: 'river-map-pattern-stone',
          title: '河洛图纹石板（概念展品）',
          summary: '以石材纹理承载河洛图纹想象。',
          period: '当代概念设计',
          material: '石材（概念材质）',
          imageUrl: '/media/editorial/explore-river-map-stone-user-v2.webp',
        })
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })

    const wrapper = mount(ProductProvenanceDrawer, {
      attachTo: document.body,
      props: {
        open: true,
        product: {
          id: 3,
          slug: 'river-map-notebook',
          name: '河图纹笔记本',
          summary: '把河洛图纹带进每天的记录与灵感。',
          price: '39.00',
          availableStock: 20,
          coverImageUrl: '/media/products/river-map-notebook.webp',
          inspirationArtifactSlug: 'river-map-pattern-stone',
        },
      },
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(document.body.textContent).toContain('河洛图纹石板（概念展品）')
    expect(document.body.textContent).toContain('设计灵感源自馆内概念展品《河洛图纹石板》。')

    const bookmarkBtn = document.body.querySelector<HTMLButtonElement>('[data-testid="provenance-bookmark-btn"]')
    expect(bookmarkBtn).not.toBeNull()
    bookmarkBtn!.click()
    await flushPromises()
    expect(useCuratorialBookmarks().count.value).toBe(1)
    expect(useCuratorialBookmarks().isBookmarked('product', 'river-map-notebook')).toBe(true)

    bookmarkBtn!.click()
    await flushPromises()
    expect(useCuratorialBookmarks().count.value).toBe(0)

    wrapper.unmount()
  })
})
