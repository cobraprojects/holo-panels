import type { JsonPrimitive } from '../protocol/json'

export const TRANSLATION_REFERENCE_KIND = 'translation' as const

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
export type LocaleDirection = 'ltr' | 'rtl'
export type TranslationReplacementValue = JsonPrimitive
export type TranslationReplacements = Readonly<Record<string, TranslationReplacementValue>>
export type PluralTranslation = Readonly<Partial<Record<PluralCategory, string>> & { readonly other: string }>
export type TranslationMessage = string | PluralTranslation

export interface RegisteredTranslations {
  readonly __registeredTranslationsBrand?: never
}

export interface TranslationReference<
  TKey extends string = string,
  TReplacements extends TranslationReplacements = TranslationReplacements,
> {
  readonly kind: typeof TRANSLATION_REFERENCE_KIND
  readonly key: TKey
  readonly replacements: TReplacements
}

export interface TranslationCatalog<TMessages extends Readonly<Record<string, TranslationMessage>> = Readonly<Record<string, TranslationMessage>>> {
  readonly direction: LocaleDirection
  readonly locale: string
  readonly messages: TMessages
}

type PlaceholderNames<TMessage extends string>
  = TMessage extends `${string}{${infer TPlaceholder}}${infer TRest}`
    ? TPlaceholder | PlaceholderNames<TRest>
    : never

type MessageText<TMessage extends TranslationMessage>
  = TMessage extends string
    ? TMessage
    : Exclude<TMessage[keyof TMessage], undefined> & string

type IsPlural<TMessage extends TranslationMessage> = TMessage extends string ? false : true

export type TranslationReplacementNames<TMessage extends TranslationMessage>
  = PlaceholderNames<MessageText<TMessage>> | (IsPlural<TMessage> extends true ? 'count' : never)

export type TranslationReplacementMap<TMessage extends TranslationMessage>
  = Readonly<Record<TranslationReplacementNames<TMessage>, TranslationReplacementValue>>

export type TranslationArguments<TMessage extends TranslationMessage>
  = [TranslationReplacementNames<TMessage>] extends [never]
    ? readonly []
    : readonly [replacements: TranslationReplacementMap<TMessage>]

export function defineTranslationCatalog<const TMessages extends Readonly<Record<string, TranslationMessage>>>(
  locale: string,
  direction: LocaleDirection,
  messages: TMessages,
): TranslationCatalog<TMessages> {
  if (!locale.trim()) throw new Error('[Holo Panels] Translation catalog locale cannot be empty.')
  if (direction !== 'ltr' && direction !== 'rtl') throw new Error(`[Holo Panels] Invalid translation direction: ${direction}.`)
  if (Object.keys(messages).some(key => !key.trim())) throw new Error('[Holo Panels] Translation keys cannot be empty.')
  const frozenMessages = Object.fromEntries(Object.entries(messages).map(([key, message]) => [
    key,
    typeof message === 'string' ? message : Object.freeze({ ...message }),
  ])) as TMessages
  return Object.freeze({
    direction,
    locale,
    messages: Object.freeze(frozenMessages),
  })
}

export function createTranslationReference<
  TKey extends string,
  TMessage extends TranslationMessage,
>(
  key: TKey,
  ...args: TranslationArguments<TMessage>
): TranslationReference<TKey, TranslationReplacementMap<TMessage>> {
  if (!key.trim()) throw new Error('[Holo Panels] Translation key cannot be empty.')
  const replacements = (args[0] ?? {}) as TranslationReplacementMap<TMessage>
  return Object.freeze({
    kind: TRANSLATION_REFERENCE_KIND,
    key,
    replacements: Object.freeze({ ...replacements }),
  })
}

export function isTranslationReference(value: unknown): value is TranslationReference {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && 'kind' in value
    && value.kind === TRANSLATION_REFERENCE_KIND
    && 'key' in value
    && typeof value.key === 'string'
    && value.key.length > 0
    && 'replacements' in value
    && typeof value.replacements === 'object'
    && value.replacements !== null
    && !Array.isArray(value.replacements)
    && Object.values(value.replacements).every(replacement => replacement === null
      || typeof replacement === 'boolean'
      || typeof replacement === 'number'
      || typeof replacement === 'string')
}

export function assertUntranslatedStableKey(value: unknown, label: 'stable ID' | 'permission key'): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[Holo Panels] ${label} must be a non-translated, non-empty string.`)
  }
}
