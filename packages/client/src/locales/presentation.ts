import {
  arCatalog,
  enCatalog,
  type EN_MESSAGES,
  type LocaleDirection,
  TranslationCatalogRegistry,
  type TranslationReplacementValue,
} from '@holo-js/panels-core'
import { LocaleManager } from './locale-manager'

export type PanelTranslationKey = keyof typeof EN_MESSAGES
export type PanelTranslator = (
  key: PanelTranslationKey,
  replacements?: Readonly<Record<string, TranslationReplacementValue>>,
) => string

const registry = new TranslationCatalogRegistry({ defaults: [enCatalog, arCatalog] })

export function createPanelTranslator(locale: string): PanelTranslator {
  const manager = new LocaleManager(registry, {
    requestedLocale: locale,
    fallbackLocale: 'en',
  })
  return (key, replacements = {}) => manager.translate({ kind: 'translation', key, replacements })
}

export function syncDocumentLocale(
  state: { readonly direction: LocaleDirection, readonly locale: string },
  document: Pick<Document, 'documentElement'>,
): () => void {
  const previousLanguage = document.documentElement.lang
  const previousDirection = document.documentElement.dir
  document.documentElement.lang = state.locale
  document.documentElement.dir = state.direction
  return () => {
    document.documentElement.lang = previousLanguage
    document.documentElement.dir = previousDirection
  }
}
