import { canonicalLocale } from '@holo-js/panels-core'

export type PanelLocalePreferences = {
  readonly actorLocale?: string
  readonly applicationLocale?: string
  readonly fallbackLocale: string
  readonly panelLocale?: string
  readonly requestedLocale?: string
}

export type ResolvedPanelLocale = {
  readonly fallbackLocales: readonly string[]
  readonly locale: string
}

function localeHierarchy(locale: string): readonly string[] {
  const canonical = canonicalLocale(locale)
  const segments = canonical.split('-')
  const locales: string[] = []
  for (let length = segments.length; length > 0; length -= 1) {
    locales.push(segments.slice(0, length).join('-'))
  }
  return locales
}

export function resolvePanelLocale(
  preferences: PanelLocalePreferences,
  availableLocales: readonly string[],
): ResolvedPanelLocale {
  const available = new Set(availableLocales.map(canonicalLocale))
  if (available.size === 0) throw new Error('[Holo Panels] Locale resolution requires at least one available locale.')
  const requested = [
    preferences.requestedLocale,
    preferences.actorLocale,
    preferences.panelLocale,
    preferences.applicationLocale,
    preferences.fallbackLocale,
  ].filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
  const ordered = [...new Set(requested.flatMap(localeHierarchy))].filter(locale => available.has(locale))
  if (ordered.length === 0) {
    throw new Error(`[Holo Panels] Fallback locale ${preferences.fallbackLocale} has no available catalog.`)
  }
  return Object.freeze({ locale: ordered[0]!, fallbackLocales: Object.freeze(ordered) })
}
