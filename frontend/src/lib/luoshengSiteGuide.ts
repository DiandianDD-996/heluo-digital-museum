export const siteStops = {
  explore: { label: '探索馆藏', path: '/explore', detail: '用关键词找文物与文化专题，点开条目就能读到展品故事。', pattern: /馆藏|藏品|文物|专题|搜索|检索/ },
  exhibits: { label: '数字展厅', path: '/exhibits', detail: '选择一个展项，进入互动 3D 后可以旋转和放大，看看正面以外的细节。', pattern: /3d|三维|数字展厅|模型|展厅|展馆/i },
  appointment: { label: '预约参观', path: '/appointment', detail: '先选日期和可用时段，再按页面提示填写人数和预约信息。进度可到个人中心查看。', pattern: /预约|订票|门票|到馆|线下|参观时间|开放时间|名额/ },
  shop: { label: '河洛文创', path: '/shop', detail: '逛馆累了，可以看看博物馆的文创商品。进入文创页就能浏览商品和详情。', pattern: /文创|商店|商城|商品|纪念品|购物/ },
  ding: { label: '河洛青铜鼎', path: '/artifacts/heluo-bronze-ding', detail: '这件数字展品可以先看鼎耳、三足和器腹纹样。打开藏品页，就能从图版开始观察。', pattern: /青铜鼎|鼎耳|鼎足|三足|这件鼎/ },
} as const

export type SiteStop = keyof typeof siteStops
type SiteAnswer = { text: string; stops: SiteStop[] }
const tour: SiteStop[] = ['explore', 'exhibits', 'appointment', 'shop']

export const firstVisit = ['explore', 'exhibits', 'ding'] as const satisfies readonly SiteStop[]

export function asksAboutCurrentArticle(question: string) {
  const text = question.normalize('NFKC').trim().replace(/[?。!]+$/, '')
    .replace(/^(?:请问|请|可以|能不能)\s*/, '')
  if (/^介绍(?:一下)?(?:这篇(?:文章|专题)?|本文|当前专题)$/.test(text)) return true
  return /^(?:这篇(?:文章|专题)?|本文|当前专题|这[个一]页|这里)(?:主要)?(?:(?:说|讲|写|介绍)(?:了|的)?(?:是)?什么(?:内容)?|是什么|内容是什么)$/.test(text)
}

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

export function answerSiteGuide(question: string, route: string): SiteAnswer {
  const normalized = question.normalize('NFKC').trim()
  if (/这(?:里|一页|个页面)|当前页|我在哪/.test(normalized)) return explainSitePage(route)
  const matches = (Object.keys(siteStops) as SiteStop[]).filter(stop => siteStops[stop].pattern.test(normalized))
  if (matches.includes('ding') && matches.includes('exhibits')) {
    return { text: '想看青铜鼎的 3D？打开青铜鼎藏品页，点「去 3D 看鼎耳」就能接着逛。', stops: ['ding'] }
  }
  if (matches.length) return { text: matches.map(stop => siteStops[stop].detail).join('\n'), stops: matches }
  if (/网站|博物馆|带我|逛|介绍|开始|你好|能做什么|路线/.test(normalized)) return explainSitePage('home')
  return { text: '我可以帮你找本站的馆藏、3D 展厅、参观预约和文创入口。你想去哪里？', stops: tour }
}
