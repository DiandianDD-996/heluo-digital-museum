import { lexicon, type SuggestedQuestion } from './luoshengLexicon'
import type { GuideStop } from './luoshengPreview'

export type SuggestionMode = 'empty' | 'after-answer'

export type SuggestionQuery = {
  readonly exhibit?: string | undefined
  readonly lookpoint?: GuideStop | null
  readonly route: string
  readonly mode: SuggestionMode
}

/** Questions are copied verbatim from the reviewed lexicon; nothing is generated. */
export function suggestionsFor(query: SuggestionQuery): { primary: string[]; more: string[] } {
  const exhibit = query.exhibit ? lexicon.exhibits[query.exhibit] : undefined
  const pool = exhibit ? reviewedPool(exhibit.suggestedQuestions, query.lookpoint) : []
  const limit = query.mode === 'empty' ? 3 : 2
  const primary = pool.slice(0, limit).map(entry => entry.q)
  const more = pool.slice(limit).map(entry => entry.q)
  return { primary, more }
}

function reviewedPool(
  groups: Readonly<Record<string, readonly SuggestedQuestion[]>>,
  lookpoint: GuideStop | null | undefined,
): readonly SuggestedQuestion[] {
  const seen = new Set<string>()
  const ordered: SuggestedQuestion[] = []
  const run = (group: readonly SuggestedQuestion[] | undefined) => {
    for (const entry of group ?? []) {
      if (seen.has(entry.q)) continue
      seen.add(entry.q)
      ordered.push(entry)
    }
  }
  // A confirmed lookpoint leads, then the exhibit-wide questions, then the other parts.
  // With no confirmed part we lead with exhibit-wide questions and never presume one.
  if (lookpoint) {
    run(groups[lookpoint])
    run(groups.global)
  } else {
    run(groups.global)
  }
  for (const [key, group] of Object.entries(groups)) {
    if (key !== lookpoint && key !== 'global') run(group)
  }
  return ordered
}

/** Buttons for an ambiguous question: only stops the exhibit actually declares. */
export function clarifyOptionsFor(exhibit: string | undefined): readonly GuideStop[] {
  if (!exhibit) return []
  return lexicon.exhibits[exhibit]?.clarifyOptions ?? []
}

/** The next look to offer after an answer, or null when none is declared. */
export function nextGlanceFor(exhibit: string | undefined, lookpoint: GuideStop | null | undefined): GuideStop | null {
  if (!exhibit || !lookpoint) return null
  const next = lexicon.exhibits[exhibit]?.nextGlance[lookpoint]
  if (next === 'ear' || next === 'feet' || next === 'motif') return next
  return null
}
