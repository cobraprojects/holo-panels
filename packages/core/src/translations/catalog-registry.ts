import { defineTranslationCatalog, type TranslationCatalog, type TranslationMessage } from './contracts'

export type TranslationCatalogSource = {
  readonly catalogs: readonly TranslationCatalog[]
  readonly id: string
}

export type TranslationCatalogSet = {
  readonly application?: readonly TranslationCatalog[]
  readonly defaults: readonly TranslationCatalog[]
  readonly plugins?: readonly TranslationCatalogSource[]
}

export type TranslationLookup = {
  readonly direction: TranslationCatalog['direction']
  readonly locale: string
  readonly message: TranslationMessage
  readonly source: string
}

function canonicalLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale.replaceAll('_', '-'))[0]!
  } catch {
    throw new Error(`[Holo Panels] Invalid locale: ${locale}.`)
  }
}

function catalogMap(catalogs: readonly TranslationCatalog[], source: string): ReadonlyMap<string, TranslationCatalog> {
  const mapped = new Map<string, TranslationCatalog>()
  for (const catalog of catalogs) {
    const locale = canonicalLocale(catalog.locale)
    if (mapped.has(locale)) throw new Error(`[Holo Panels] Duplicate ${source} translation catalog for ${locale}.`)
    mapped.set(locale, defineTranslationCatalog(locale, catalog.direction, catalog.messages))
  }
  return mapped
}

export class TranslationCatalogRegistry {
  readonly #application: ReadonlyMap<string, TranslationCatalog>
  readonly #defaults: ReadonlyMap<string, TranslationCatalog>
  readonly #plugins: readonly Readonly<{ id: string, catalogs: ReadonlyMap<string, TranslationCatalog> }>[]

  constructor(set: TranslationCatalogSet) {
    if (set.defaults.length === 0) throw new Error('[Holo Panels] At least one default translation catalog is required.')
    const pluginIds = new Set<string>()
    this.#defaults = catalogMap(set.defaults, 'default')
    this.#application = catalogMap(set.application ?? [], 'application')
    this.#plugins = Object.freeze((set.plugins ?? []).map((plugin) => {
      if (!plugin.id.trim() || pluginIds.has(plugin.id)) throw new Error(`[Holo Panels] Invalid or duplicate translation plugin ID: ${plugin.id}.`)
      pluginIds.add(plugin.id)
      return Object.freeze({ id: plugin.id, catalogs: catalogMap(plugin.catalogs, `plugin ${plugin.id}`) })
    }))
    for (const locale of this.availableLocales) {
      const directions = new Set([
        this.#defaults.get(locale)?.direction,
        ...this.#plugins.map(plugin => plugin.catalogs.get(locale)?.direction),
        this.#application.get(locale)?.direction,
      ].filter(direction => typeof direction !== 'undefined'))
      if (directions.size > 1) throw new Error(`[Holo Panels] Conflicting translation directions for ${locale}.`)
    }
  }

  get availableLocales(): readonly string[] {
    return Object.freeze([...new Set([
      ...this.#defaults.keys(),
      ...this.#plugins.flatMap(plugin => [...plugin.catalogs.keys()]),
      ...this.#application.keys(),
    ])].sort())
  }

  direction(locale: string): TranslationCatalog['direction'] | undefined {
    const canonical = canonicalLocale(locale)
    return this.#application.get(canonical)?.direction
      ?? [...this.#plugins].reverse().find(plugin => plugin.catalogs.has(canonical))?.catalogs.get(canonical)?.direction
      ?? this.#defaults.get(canonical)?.direction
  }

  lookup(locales: readonly string[], key: string): TranslationLookup | undefined {
    for (const candidate of locales) {
      const locale = canonicalLocale(candidate)
      const application = this.#application.get(locale)
      if (application && Object.hasOwn(application.messages, key)) {
        return Object.freeze({ direction: application.direction, locale, message: application.messages[key]!, source: 'application' })
      }
      for (let index = this.#plugins.length - 1; index >= 0; index -= 1) {
        const plugin = this.#plugins[index]!
        const catalog = plugin.catalogs.get(locale)
        if (catalog && Object.hasOwn(catalog.messages, key)) {
          return Object.freeze({ direction: catalog.direction, locale, message: catalog.messages[key]!, source: `plugin:${plugin.id}` })
        }
      }
      const fallback = this.#defaults.get(locale)
      if (fallback && Object.hasOwn(fallback.messages, key)) {
        return Object.freeze({ direction: fallback.direction, locale, message: fallback.messages[key]!, source: 'default' })
      }
    }
    return undefined
  }
}

export { canonicalLocale }
