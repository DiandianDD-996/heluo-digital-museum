import type { Intent } from './luoshengIntent'
import ui from '../assets/guide/ui.zh-CN.json'

const navigation = ui.navigation

export const siteStops = {
  explore: { ...navigation.stops.explore, path: '/explore' },
  exhibits: { ...navigation.stops.exhibits, path: '/exhibits' },
  appointment: { ...navigation.stops.appointment, path: '/appointment' },
  shop: { ...navigation.stops.shop, path: '/shop' },
  ding: { ...navigation.stops.ding, path: '/artifacts/heluo-bronze-ding' },
} as const

export type SiteStop = keyof typeof siteStops
type SiteAnswer = { text: string; stops: SiteStop[] }
const tour: SiteStop[] = ['explore', 'exhibits', 'appointment', 'shop']

export const firstVisit = ['explore', 'exhibits', 'ding'] as const satisfies readonly SiteStop[]

export function explainSitePage(route: string): SiteAnswer {
  switch (route) {
    case 'explore': return { text: navigation.explorePage, stops: ['ding', 'exhibits'] }
    case 'exhibits':
    case 'exhibit-detail': return { text: navigation.exhibitsPage, stops: ['explore', 'ding'] }
    case 'artifact-detail':
    case 'article-detail': return { text: navigation.readingPage, stops: ['explore', 'exhibits'] }
    case 'appointment': return { text: siteStops.appointment.detail, stops: ['exhibits'] }
    case 'shop': return { text: siteStops.shop.detail, stops: ['explore', 'exhibits'] }
    default: return { text: navigation.home, stops: tour }
  }
}

export function renderSiteIntent(intent: Intent): SiteAnswer {
  if (intent.kind === 'site-page' && intent.route === 'appointment') {
    return { text: siteStops.appointment.detail, stops: ['appointment'] }
  }
  if (intent.kind === 'site-page') return explainSitePage(intent.route)
  const matches = intent.kind === 'site-navigation' ? intent.stops : []
  if (matches.includes('ding') && matches.includes('exhibits')) {
    return { text: navigation.ding3d, stops: ['ding'] }
  }
  if (matches.length) return { text: matches.map(stop => siteStops[stop].detail).join('\n'), stops: matches }
  return { text: navigation.general, stops: tour }
}
