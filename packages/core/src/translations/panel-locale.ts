import type { PanelManifest } from '../panels/contracts'
import { TranslationCatalogRegistry } from './catalog-registry'
import { arCatalog, enCatalog } from './catalogs'
import type { LocaleDirection } from './contracts'

export interface ResolvedPanelLocale {
  readonly direction: LocaleDirection
  readonly locale: string
}

const defaultCatalogs = new TranslationCatalogRegistry({ defaults: [enCatalog, arCatalog] })

function localeHierarchy(locale: string): readonly string[] {
  const canonical = Intl.getCanonicalLocales(locale.replaceAll('_', '-'))[0]!
  const segments = canonical.split('-')
  return segments.map((_segment, index) => segments.slice(0, segments.length - index).join('-'))
}

function matchedLocale(candidate: string, allowed: ReadonlySet<string>): string | undefined {
  try {
    return localeHierarchy(candidate).find(locale => allowed.has(locale))
  } catch {
    return undefined
  }
}

export function normalizePanelLocaleConfiguration(
  allowedLocales: readonly string[],
  fallbackLocale: string,
): PanelManifest['locales'] {
  if (allowedLocales.length === 0) throw new Error('Panels require at least one allowed locale')
  const allowed = [...new Set(allowedLocales.map((locale) => {
    const canonical = Intl.getCanonicalLocales(locale.replaceAll('_', '-'))[0]
    if (!canonical || defaultCatalogs.direction(canonical) === undefined) throw new Error(`Panel locale "${locale}" does not have a built-in catalog`)
    return canonical
  }))]
  const fallback = matchedLocale(fallbackLocale, new Set(allowed))
  if (!fallback) throw new Error('The panel default locale must be included in its allowed locales')
  return Object.freeze({ allowed: Object.freeze(allowed), fallback })
}

export function resolvePanelLocale(
  configuration: PanelManifest['locales'],
  candidates: readonly (string | null | undefined)[],
): ResolvedPanelLocale {
  const normalized = normalizePanelLocaleConfiguration(configuration.allowed, configuration.fallback)
  const allowed = new Set(normalized.allowed)
  const locale = candidates.reduce<string | undefined>((resolved, candidate) => {
    if (resolved || !candidate?.trim()) return resolved
    return matchedLocale(candidate, allowed)
  }, undefined) ?? normalized.fallback
  const direction = defaultCatalogs.direction(locale)
  if (!direction) throw new Error(`Panel locale "${locale}" does not have direction metadata`)
  return Object.freeze({ direction, locale })
}

export function requestedLocales(header: string | null | undefined): readonly string[] {
  if (!header) return Object.freeze([])
  return Object.freeze(header.split(',').map(value => value.split(';', 1)[0]?.trim()).filter((value): value is string => Boolean(value) && value !== '*'))
}
