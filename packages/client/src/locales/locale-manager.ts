import type {
  LocaleDirection,
  PluralCategory,
  TranslationCatalogRegistry,
  TranslationReference,
  TranslationReplacementValue,
} from '@holo-js/panels-core'
import { type PanelLocalePreferences, resolvePanelLocale, type ResolvedPanelLocale } from './resolution'

export type MissingTranslationDiagnostic = {
  readonly attemptedLocales: readonly string[]
  readonly code: 'missing-translation'
  readonly key: string
  readonly locale: string
}

export type LocaleManagerOptions = PanelLocalePreferences & {
  readonly development?: boolean
  readonly onDiagnostic?: (diagnostic: MissingTranslationDiagnostic) => void
}

export type LocaleState = ResolvedPanelLocale & {
  readonly direction: LocaleDirection
}

function interpolate(message: string, replacements: Readonly<Record<string, TranslationReplacementValue>>): string {
  return message.replace(/\{([A-Za-z_$][A-Za-z0-9_$]*)\}/g, (placeholder, name: string) => {
    if (!(name in replacements)) return placeholder
    const value = replacements[name]
    return value === null ? '' : String(value)
  })
}

function pluralCategory(locale: string, count: number): PluralCategory {
  return new Intl.PluralRules(locale).select(count) as PluralCategory
}

export class LocaleManager {
  readonly #development: boolean
  readonly #onDiagnostic?: (diagnostic: MissingTranslationDiagnostic) => void
  readonly #preferences: Omit<PanelLocalePreferences, 'requestedLocale'>
  readonly #registry: TranslationCatalogRegistry
  #state: LocaleState

  constructor(registry: TranslationCatalogRegistry, options: LocaleManagerOptions) {
    this.#registry = registry
    this.#development = options.development ?? false
    this.#onDiagnostic = options.onDiagnostic
    this.#preferences = Object.freeze({
      actorLocale: options.actorLocale,
      applicationLocale: options.applicationLocale,
      fallbackLocale: options.fallbackLocale,
      panelLocale: options.panelLocale,
    })
    this.#state = this.#resolve(options.requestedLocale)
  }

  get state(): LocaleState {
    return this.#state
  }

  setLocale(requestedLocale: string): LocaleState {
    this.#state = this.#resolve(requestedLocale)
    return this.#state
  }

  translate(reference: TranslationReference): string {
    const lookup = this.#registry.lookup(this.#state.fallbackLocales, reference.key)
    if (!lookup) {
      if (this.#development) {
        this.#onDiagnostic?.(Object.freeze({
          attemptedLocales: this.#state.fallbackLocales,
          code: 'missing-translation',
          key: reference.key,
          locale: this.#state.locale,
        }))
      }
      return reference.key
    }
    if (typeof lookup.message === 'string') return interpolate(lookup.message, reference.replacements)
    const count = reference.replacements.count
    const numericCount = typeof count === 'number' ? count : Number.NaN
    const category = Number.isFinite(numericCount) ? pluralCategory(lookup.locale, numericCount) : 'other'
    const message = lookup.message[category] ?? lookup.message.other
    return interpolate(message, reference.replacements)
  }

  #resolve(requestedLocale?: string): LocaleState {
    const resolved = resolvePanelLocale({ ...this.#preferences, requestedLocale }, this.#registry.availableLocales)
    const direction = this.#registry.direction(resolved.locale)
    if (!direction) throw new Error(`[Holo Panels] Locale ${resolved.locale} has no direction metadata.`)
    return Object.freeze({ ...resolved, direction })
  }
}
