import type { EN_MESSAGES } from './catalogs/en'
import { createTranslationReference, type RegisteredTranslations, type TranslationArguments, type TranslationMessage, type TranslationReference } from './contracts'

export { TranslationCatalogRegistry, canonicalLocale } from './catalog-registry'
export { arCatalog, EN_MESSAGES, enCatalog } from './catalogs'
export {
  TRANSLATION_REFERENCE_KIND,
  assertUntranslatedStableKey,
  createTranslationReference,
  defineTranslationCatalog,
  isTranslationReference,
} from './contracts'
export type {
  LocaleDirection,
  PluralCategory,
  PluralTranslation,
  RegisteredTranslations,
  TranslationArguments,
  TranslationCatalog,
  TranslationMessage,
  TranslationReference,
  TranslationReplacementMap,
  TranslationReplacementNames,
  TranslationReplacements,
  TranslationReplacementValue,
} from './contracts'
export type { TranslationCatalogSet, TranslationCatalogSource, TranslationLookup } from './catalog-registry'

type KnownTranslations = typeof EN_MESSAGES & RegisteredTranslations
export type TranslationKey = Exclude<Extract<keyof KnownTranslations, string>, '__registeredTranslationsBrand'>
type KnownTranslationMessage<TKey extends TranslationKey>
  = KnownTranslations[TKey] extends TranslationMessage ? KnownTranslations[TKey] : never

export function trans<TKey extends TranslationKey>(
  key: TKey,
  ...args: TranslationArguments<KnownTranslationMessage<TKey>>
): TranslationReference<TKey> {
  return createTranslationReference<TKey, KnownTranslationMessage<TKey>>(key, ...args)
}
