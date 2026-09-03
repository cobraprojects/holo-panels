import { canonicalLocale, TranslationCatalogRegistry, type TranslationLookup } from './catalog-registry'
import { arCatalog, enCatalog, type EN_MESSAGES } from './catalogs'
import type { PluralCategory, TranslationReplacementValue } from './contracts'

export type PanelTranslationKey = keyof typeof EN_MESSAGES
export type PanelTranslator = (
  key: PanelTranslationKey,
  replacements?: Readonly<Record<string, TranslationReplacementValue>>,
) => string

const defaults = new TranslationCatalogRegistry({ defaults: [enCatalog, arCatalog] })

export function formatTranslation(lookup: TranslationLookup, replacements: Readonly<Record<string, TranslationReplacementValue>>): string {
  const count = replacements.count
  const category = typeof count === 'number' && Number.isFinite(count)
    ? new Intl.PluralRules(lookup.locale).select(count) as PluralCategory
    : 'other'
  const message = typeof lookup.message === 'string' ? lookup.message : lookup.message[category] ?? lookup.message.other
  return message.replace(/\{([A-Za-z_$][A-Za-z0-9_$]*)\}/gu, (placeholder, name: string) => {
    if (!Object.hasOwn(replacements, name)) return placeholder
    return replacements[name] === null ? '' : String(replacements[name])
  })
}

export function createPanelTranslator(locale: string): PanelTranslator {
  const segments = canonicalLocale(locale).split('-')
  const locales = [...new Set([...segments.map((_segment, index) => segments.slice(0, segments.length - index).join('-')), 'en'])]
  return (key, replacements = {}) => {
    const lookup = defaults.lookup(locales, key)
    return lookup ? formatTranslation(lookup, replacements) : ''
  }
}
