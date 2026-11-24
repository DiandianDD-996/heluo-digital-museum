export const GUIDE_ARTIFACT_SLUG = 'heluo-bronze-ding'
export const GUIDE_EXHIBIT_SLUG = 'heluo-bronze-ding-3d'

export type GuideLocale = 'zh-CN' | 'en-US'
export type GuideViewName = 'front' | 'left' | 'right' | 'back' | 'top'
export type GuidePartName = 'ear' | 'feet' | 'motif'
export type GuideDisplayMode = 'solid' | 'points'
export type GuideStreamStatusPhase = 'thinking' | 'reading_archive' | 'searching_slots'

export interface GuideViewerState {
  active: boolean
  mode: GuideDisplayMode
  view: GuideViewName
}

export interface GuidePageContext {
  route: string
  path: string
  title?: string
  artifactSlug: string | null
  exhibitSlug: string | null
  articleSlug: string | null
  viewerState?: GuideViewerState
}

export interface GuideHistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface GuideCitation {
  id: string
  title: string
  revision: string
  internalPath: string | null
  publicSourceUrl: string | null
  boundaryNote: string
}

export interface GuideAction {
  type: 'viewer_focus' | 'viewer_mode' | 'viewer_tour' | 'navigate' | 'open_plate' | 'open_source'
  label: string
  exhibitSlug?: string | null
  part?: GuidePartName | null
  view?: GuideViewName | null
  mode?: GuideDisplayMode | null
  path?: string | null
  query?: Record<string, string> | null
  stop?: GuidePartName | null
  compare?: boolean | null
  url?: string | null
}

export interface GuideChatRequestPayload {
  conversationId: string
  requestId: string
  message: string
  locale: GuideLocale
  context: {
    route: string
    artifactSlug: string | null
    exhibitSlug: string | null
    articleSlug: string | null
    viewerState?: GuideViewerState
  }
  history: GuideHistoryTurn[]
}

export interface GuideChatResponse {
  requestId: string
  text: string
  citations: GuideCitation[]
  actions: GuideAction[]
  followUps: string[]
  boundaryNote: string
  mode: 'ai' | 'deterministic'
  degraded: boolean
}

export interface GuideMessage {
  id: string
  role: 'user' | 'assistant' | 'divider'
  text: string
  streaming?: boolean
  statusPhase?: GuideStreamStatusPhase | null
  citations?: GuideCitation[]
  actions?: GuideAction[]
  followUps?: string[]
  boundaryNote?: string
  mode?: 'ai' | 'deterministic'
  degraded?: boolean
  createdAt: number
}

export interface PendingViewerAction {
  id: string
  exhibitSlug: string
  part?: GuidePartName | null
  view?: GuideViewName | null
  mode?: GuideDisplayMode | null
  tour?: boolean
  label: string
}

export interface PendingPlateAction {
  id: string
  stop: GuidePartName
  compare?: boolean
}
