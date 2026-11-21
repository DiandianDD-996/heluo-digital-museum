import raw from '../assets/guide/lexicon.zh-CN.json'
import type { GuideStop } from './luoshengPreview'
import type { SiteStop } from './luoshengSiteGuide'

/**
 * Language knowledge for the guide, loaded from a reviewable JSON file.
 * Facts never live here — only how visitors phrase things.
 *
 * Stop names stay bound to `GuideStop` because the visitor-facing labels and
 * the plate buttons are still fixed in the UI. Adding a new part means touching
 * the enum, the UI labels and the exhibit profile together. See ADR-008.
 */
export type LexiconPoint = {
  readonly stop: GuideStop
  readonly cardId: string
  readonly revision: number
  readonly labels: readonly string[]
  readonly reviewedAdditions: Readonly<Record<string, string>>
}

export type SuggestedQuestion = {
  readonly q: string
  readonly kind: 'answer' | 'action' | 'boundary'
  readonly supports: readonly string[]
  readonly why: string
}

export type LexiconExhibit = {
  readonly artifactSlug: string
  readonly points: readonly LexiconPoint[]
  readonly clarifyOptions: readonly GuideStop[]
  readonly suggestedQuestions: Readonly<Record<string, readonly SuggestedQuestion[]>>
  readonly nextGlance: Readonly<Record<string, string>>
}

export type Lexicon = {
  readonly version: number
  readonly locale: string
  readonly relativeDates: Readonly<Record<string, number>>
  readonly peopleWords: Readonly<Record<string, number>>
  readonly siteRoutes: Readonly<Record<SiteStop, readonly string[]>>
  readonly searchVocabulary: readonly string[]
  readonly searchAliases: Readonly<Record<string, string>>
  readonly discoveryTerms: readonly string[]
  readonly exhibits: Readonly<Record<string, LexiconExhibit>>
}

const GUIDE_STOPS: readonly GuideStop[] = ['ear', 'feet', 'motif']

function isGuideStop(value: unknown): value is GuideStop {
  return typeof value === 'string' && (GUIDE_STOPS as readonly string[]).includes(value)
}

function fail(message: string): never {
  throw new Error(`Invalid guide lexicon: ${message}`)
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${where} must be an object`)
  return value as Record<string, unknown>
}

function strings(value: unknown, where: string): readonly string[] {
  if (!Array.isArray(value) || !value.length) fail(`${where} must be a non-empty array`)
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item !== item.trim()) fail(`${where} has a blank or padded entry`)
  }
  if (new Set(value).size !== value.length) fail(`${where} has duplicates`)
  return value as readonly string[]
}

function stringRecord(value: unknown, where: string): Readonly<Record<string, string>> {
  const source = record(value, where)
  for (const [key, entry] of Object.entries(source)) {
    if (!key.trim() || key !== key.trim()) fail(`${where} has a blank or padded key`)
    if (typeof entry !== 'string' || !entry.trim() || entry !== entry.trim()) fail(`${where}.${key} must be a non-blank string`)
  }
  return source as Readonly<Record<string, string>>
}

function numbers(value: unknown, where: string): Readonly<Record<string, number>> {
  const source = record(value, where)
  for (const [key, entry] of Object.entries(source)) {
    if (!key.trim() || key !== key.trim()) fail(`${where} has a blank or padded key`)
    if (typeof entry !== 'number' || !Number.isFinite(entry)) fail(`${where}.${key} must be a number`)
  }
  return source as Readonly<Record<string, number>>
}

function parsePoint(value: unknown, index: number): LexiconPoint {
  const point = record(value, `points[${index}]`)
  if (!isGuideStop(point.stop)) fail(`points[${index}].stop is not a known guide stop`)
  if (typeof point.cardId !== 'string' || !point.cardId.trim()) fail(`points[${index}].cardId is blank`)
  if (typeof point.revision !== 'number' || !Number.isInteger(point.revision) || point.revision < 1) {
    fail(`points[${index}].revision must be a positive integer`)
  }
  const labels = strings(point.labels, `points[${index}].labels`)
  const reviewedAdditions = point.reviewedAdditions === undefined
    ? {}
    : record(point.reviewedAdditions, `points[${index}].reviewedAdditions`)
  for (const label of labels) {
    if (label in reviewedAdditions && typeof reviewedAdditions[label] !== 'string') {
      fail(`points[${index}].reviewedAdditions.${label} must be a reason string`)
    }
  }
  // Reviewed additions only annotate labels that actually exist, so stale reasons cannot pile up.
  for (const label of Object.keys(reviewedAdditions)) {
    if (!labels.includes(label)) fail(`points[${index}].reviewedAdditions.${label} is not one of the labels`)
  }
  return {
    stop: point.stop,
    cardId: point.cardId,
    revision: point.revision,
    labels,
    reviewedAdditions: reviewedAdditions as Readonly<Record<string, string>>,
  }
}

function parseQuestions(value: unknown, where: string): Readonly<Record<string, readonly SuggestedQuestion[]>> {
  const source = record(value, where)
  const result: Record<string, readonly SuggestedQuestion[]> = {}
  for (const [key, list] of Object.entries(source)) {
    if (!Array.isArray(list)) fail(`${where}.${key} must be an array`)
    result[key] = list.map((item, index) => {
      const entry = record(item, `${where}.${key}[${index}]`)
      if (typeof entry.q !== 'string' || !entry.q.trim()) fail(`${where}.${key}[${index}].q is blank`)
      if (entry.kind !== 'answer' && entry.kind !== 'action' && entry.kind !== 'boundary') {
        fail(`${where}.${key}[${index}].kind is not an allowed kind`)
      }
      if (typeof entry.why !== 'string' || !entry.why.trim()) fail(`${where}.${key}[${index}].why is blank`)
      return { q: entry.q, kind: entry.kind, supports: strings(entry.supports, `${where}.${key}[${index}].supports`), why: entry.why }
    })
  }
  return result
}

function parseExhibit(value: unknown, key: string): LexiconExhibit {
  const exhibit = record(value, `exhibits.${key}`)
  if (typeof exhibit.artifactSlug !== 'string' || !exhibit.artifactSlug.trim()) fail(`exhibits.${key}.artifactSlug is blank`)
  if (!Array.isArray(exhibit.points) || !exhibit.points.length) fail(`exhibits.${key}.points must be a non-empty array`)
  const points = exhibit.points.map((point, index) => parsePoint(point, index))
  if (new Set(points.map(point => point.stop)).size !== points.length) fail(`exhibits.${key}.points has duplicate stops`)
  const clarifyOptions = exhibit.clarifyOptions === undefined ? [] : exhibit.clarifyOptions
  if (!Array.isArray(clarifyOptions)) fail(`exhibits.${key}.clarifyOptions must be an array`)
  for (const stop of clarifyOptions) {
    if (!isGuideStop(stop)) fail(`exhibits.${key}.clarifyOptions has an unknown stop`)
    if (!points.some(point => point.stop === stop)) fail(`exhibits.${key}.clarifyOptions references a stop without a point`)
  }
  const nextGlance = stringRecord(exhibit.nextGlance ?? {}, `exhibits.${key}.nextGlance`)
  for (const [from, to] of Object.entries(nextGlance)) {
    if (!isGuideStop(from) || !isGuideStop(to)) fail(`exhibits.${key}.nextGlance must map known stops`)
    if (!points.some(point => point.stop === from) || !points.some(point => point.stop === to)) {
      fail(`exhibits.${key}.nextGlance references a stop without a point`)
    }
  }
  return {
    artifactSlug: exhibit.artifactSlug,
    points,
    clarifyOptions: clarifyOptions as readonly GuideStop[],
    suggestedQuestions: parseQuestions(exhibit.suggestedQuestions ?? {}, `exhibits.${key}.suggestedQuestions`),
    nextGlance,
  }
}

export function parseLexicon(value: unknown): Lexicon {
  const source = record(value, 'root')
  if (source.version !== 1) fail('version must be 1')
  if (typeof source.locale !== 'string' || !source.locale.trim()) fail('locale is blank')
  const exhibits = record(source.exhibits, 'exhibits')
  const parsed: Record<string, LexiconExhibit> = {}
  for (const [key, exhibit] of Object.entries(exhibits)) parsed[key] = parseExhibit(exhibit, key)
  if (!Object.keys(parsed).length) fail('exhibits must not be empty')
  const routes = record(source.siteRoutes, 'siteRoutes')
  const siteRoutes: Record<string, readonly string[]> = {}
  for (const [key, list] of Object.entries(routes)) siteRoutes[key] = strings(list, `siteRoutes.${key}`)
  return {
    version: 1,
    locale: source.locale,
    relativeDates: numbers(source.relativeDates, 'relativeDates'),
    peopleWords: numbers(source.peopleWords, 'peopleWords'),
    siteRoutes: siteRoutes as unknown as Readonly<Record<SiteStop, readonly string[]>>,
    searchVocabulary: strings(source.searchVocabulary, 'searchVocabulary'),
    searchAliases: stringRecord(source.searchAliases ?? {}, 'searchAliases'),
    discoveryTerms: strings(source.discoveryTerms, 'discoveryTerms'),
    exhibits: parsed,
  }
}

export const lexicon: Lexicon = parseLexicon(raw)

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const routeMatchers = new Map<SiteStop, RegExp>()
for (const [stop, patterns] of Object.entries(lexicon.siteRoutes)) {
  routeMatchers.set(stop as SiteStop, new RegExp(patterns.map(escape).join('|'), 'i'))
}

/** Which site destinations a question mentions, in a stable order. */
export function siteStopsMatching(text: string): SiteStop[] {
  return [...routeMatchers.entries()].filter(([, pattern]) => pattern.test(text)).map(([stop]) => stop)
}

const pointLabels = new Map<GuideStop, readonly string[]>()
for (const exhibit of Object.values(lexicon.exhibits)) {
  for (const point of exhibit.points) {
    if (!pointLabels.has(point.stop)) pointLabels.set(point.stop, point.labels)
  }
}

/** Anchored matcher built from any label list, so new aliases need no code change. */
export function anchoredPattern(labels: readonly string[]): RegExp {
  return new RegExp(`^(?:${labels.map(escape).join('|')})$`)
}

/** Union matcher, longest first so 「青铜鼎」 wins over 「鼎」. */
export function unionPattern(labels: readonly string[]): RegExp {
  const ordered = [...new Set(labels)].sort((left, right) => right.length - left.length)
  return new RegExp(ordered.map(escape).join('|'))
}

/** Anchored matcher for a visitor naming one part, e.g. 「脚」「三足」. */
export function pointPattern(stop: GuideStop): RegExp {
  const labels = pointLabels.get(stop)
  if (!labels) return fail(`no point labels for stop ${stop}`)
  return anchoredPattern(labels)
}

/** Any part label, longest first, unanchored. */
export function pointLabelPattern(): RegExp {
  return unionPattern([...pointLabels.values()].flat())
}

/** Longest-first matcher so 「青铜鼎」 wins over 「鼎」. */
export function vocabularyPattern(limit = lexicon.searchVocabulary.length): RegExp {
  const ordered = [...lexicon.searchVocabulary].sort((left, right) => right.length - left.length).slice(0, limit)
  return new RegExp(ordered.map(escape).join('|'))
}

export function discoveryTermPattern(): RegExp {
  const ordered = [...lexicon.discoveryTerms].sort((left, right) => right.length - left.length)
  return new RegExp(ordered.map(escape).join('|'))
}

export function relativeDatePattern(): RegExp {
  const ordered = Object.keys(lexicon.relativeDates).sort((left, right) => right.length - left.length)
  return new RegExp(ordered.map(escape).join('|'), 'g')
}

export function aliasFor(term: string): string {
  return lexicon.searchAliases[term] ?? term
}

export function peopleValue(word: string): number | undefined {
  return lexicon.peopleWords[word]
}
