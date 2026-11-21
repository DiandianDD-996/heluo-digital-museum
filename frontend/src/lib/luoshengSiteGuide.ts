import type { Intent } from './luoshengIntent'

export const siteStops = {
  explore: { label: '探索馆藏', path: '/explore', detail: '用关键词找文物与文化专题，点开条目就能读到展品故事。' },
  exhibits: { label: '数字展厅', path: '/exhibits', detail: '选择一个展项，进入互动 3D 后可以旋转和放大，看看正面以外的细节。' },
  appointment: { label: '预约参观', path: '/appointment', detail: '先选日期和可用时段，再按页面提示填写人数和预约信息。进度可到个人中心查看。' },
  shop: { label: '河洛文创', path: '/shop', detail: '逛馆累了，可以看看博物馆的文创商品。进入文创页就能浏览商品和详情。' },
  ding: { label: '河洛青铜鼎', path: '/artifacts/heluo-bronze-ding', detail: '这件数字展品可以先看鼎耳、三足和器腹纹样。打开藏品页，就能从图版开始观察。' },
} as const

export type SiteStop = keyof typeof siteStops
type SiteAnswer = { text: string; stops: SiteStop[] }
const tour: SiteStop[] = ['explore', 'exhibits', 'appointment', 'shop']

export const firstVisit = ['explore', 'exhibits', 'ding'] as const satisfies readonly SiteStop[]

export function explainSitePage(route: string): SiteAnswer {
  switch (route) {
    case 'explore': return { text: '这里可以用关键词找文物和文化专题。想先试试？从青铜鼎开始，读完藏品故事再去数字展厅。', stops: ['ding', 'exhibits'] }
    case 'exhibits':
    case 'exhibit-detail': return { text: '这里是数字展厅。打开一个展项后，你可以旋转、放大模型，换个角度找细节。看完也可以回馆藏查展品故事。', stops: ['explore', 'ding'] }
    case 'artifact-detail':
    case 'article-detail': return { text: '这里是馆藏阅读页。你可以读展品故事或文化专题，再去数字展厅对照模型。', stops: ['explore', 'exhibits'] }
    case 'appointment': return { text: siteStops.appointment.detail, stops: ['exhibits'] }
    case 'shop': return { text: siteStops.shop.detail, stops: ['explore', 'exhibits'] }
    default: return { text: '在河洛数字博物馆，你可以读文物故事、在数字展厅转动模型、预约到馆，也可以逛文创。第一次来，我建议先从馆藏或 3D 展厅逛起。', stops: tour }
  }
}

export function renderSiteIntent(intent: Intent): SiteAnswer {
  if (intent.kind === 'site-page' && intent.route === 'appointment') {
    return { text: siteStops.appointment.detail, stops: ['appointment'] }
  }
  if (intent.kind === 'site-page') return explainSitePage(intent.route)
  const matches = intent.kind === 'site-navigation' ? intent.stops : []
  if (matches.includes('ding') && matches.includes('exhibits')) {
    return { text: '想看青铜鼎的 3D？打开青铜鼎藏品页，点「去 3D 看鼎耳」就能接着逛。', stops: ['ding'] }
  }
  if (matches.length) return { text: matches.map(stop => siteStops[stop].detail).join('\n'), stops: matches }
  return { text: '我可以帮你找本站的馆藏、3D 展厅、参观预约和文创入口。你想去哪里？', stops: tour }
}
