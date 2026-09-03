import type {
  LocaleDirection,
  TranslationCatalogRegistry,
  TranslationReference,
} from '@holo-js/panels-core'
import { formatTranslation } from '@holo-js/panels-core'
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
      return ''
    }
    return formatTranslation(lookup, reference.replacements)
  }

  #resolve(requestedLocale?: string): LocaleState {
    const resolved = resolvePanelLocale({ ...this.#preferences, requestedLocale }, this.#registry.availableLocales)
    const direction = this.#registry.direction(resolved.locale)
    if (!direction) throw new Error(`[Holo Panels] Locale ${resolved.locale} has no direction metadata.`)
    return Object.freeze({ ...resolved, direction })
  }
}
