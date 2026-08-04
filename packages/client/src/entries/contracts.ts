import type {
  JsonObject,
  JsonValue,
  SchemaLayoutProperties,
  SchemaRenderSlots,
} from '@holo-js/panels-core'

export type EntryClientValue =
  | boolean
  | null
  | number
  | string
  | readonly EntryClientValue[]
  | { readonly [key: string]: EntryClientValue }

export type EntryClientObject = { readonly [key: string]: EntryClientValue }

export interface EntryClientManifest {
  readonly actions: readonly string[]
  readonly copyable: boolean
  readonly defaultValue: JsonValue
  readonly formatters: readonly EntryClientObject[]
  readonly extraAttributes: JsonObject
  readonly inlineLabel: boolean
  readonly label: string | null
  readonly layout: SchemaLayoutProperties
  readonly path: string | null
  readonly placeholder: string | null
  readonly properties: EntryClientObject
  readonly slots: SchemaRenderSlots
  readonly type: string
  readonly visible: boolean
}

export interface EntrySnapshot {
  readonly actions: readonly string[]
  readonly copyable: boolean
  readonly error: string | null
  readonly formattedState: JsonValue
  readonly extraAttributes?: JsonObject
  readonly id: string
  readonly inlineLabel: boolean
  readonly label: string | null
  readonly layout?: SchemaLayoutProperties
  readonly pending: boolean
  readonly placeholder: string | null
  readonly properties: EntryClientObject
  readonly slots?: SchemaRenderSlots
  readonly state: JsonValue
  readonly tooltip: string | null
  readonly type: string
  readonly url: string | null
  readonly visible?: boolean
}

export interface EntryHydration {
  readonly state?: JsonValue
  readonly tooltip?: string | null
  readonly url?: string | null
  readonly visible?: boolean
}

export type EntrySafeContentSegment =
  | Readonly<{ kind: 'code' | 'emphasis' | 'strong' | 'text', value: string }>
  | Readonly<{ href: string, kind: 'link', value: string }>

export interface EntrySafeContentBlock {
  readonly segments: readonly EntrySafeContentSegment[]
}

export interface EntryRichTextMetadata {
  readonly sanitizer: string
  readonly structured: boolean
}

export type EntryStateListener = (snapshot: EntrySnapshot, previous: EntrySnapshot) => void
export type EntryActionHandler = (action: string, snapshot: EntrySnapshot) => void | Promise<void>

export interface EntryRendererContext {
  readonly snapshot: EntrySnapshot
  invokeAction(action: string): Promise<void>
}

export interface EntryRendererRegistration {
  readonly source: string
  readonly type: string
}
