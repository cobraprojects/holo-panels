import type { JsonObject } from '../protocol/json'
import type { ScopedRenderSlots } from '../panels/render-slots'

export const SCHEMA_BREAKPOINTS = ['default', 'sm', 'md', 'lg', 'xl', '2xl'] as const

export type SchemaBreakpoint = (typeof SCHEMA_BREAKPOINTS)[number]
export type ResponsiveValue<TValue> = TValue | Partial<Readonly<Record<SchemaBreakpoint, TValue>>>
export type SchemaColumnSpan = number | 'full'

export type SchemaPath<TValues> = TValues extends object
  ? {
      [TKey in keyof TValues & string]: TValues[TKey] extends object
        ? TKey | `${TKey}.${SchemaPath<TValues[TKey]>}`
        : TKey
    }[keyof TValues & string]
  : string

export type SchemaValueAtPath<TValues, TPath extends string> = TPath extends keyof TValues
  ? TValues[TPath]
  : TPath extends `${infer THead}.${infer TTail}`
    ? THead extends keyof TValues
      ? SchemaValueAtPath<TValues[THead], TTail>
      : never
    : never

export type SchemaVisibilityResolver<TContext> = (
  context: TContext,
) => boolean | Promise<boolean>

export type SchemaComponentKind =
  | 'callout'
  | 'custom'
  | 'empty-state'
  | 'entry'
  | 'fieldset'
  | 'filter'
  | 'grid'
  | 'group'
  | 'section'
  | 'split'
  | 'step'
  | 'tab'
  | 'tabs'
  | 'widget'
  | 'wizard'

export type { RenderSlotReference } from '../panels/render-slots'

export type SchemaRenderSlot = 'above' | 'after' | 'before' | 'below'
export type SchemaRenderSlots = ScopedRenderSlots<SchemaRenderSlot>

export interface SchemaLayoutProperties {
  readonly columns?: Readonly<Partial<Record<SchemaBreakpoint, number>>>
  readonly columnSpan?: Readonly<Partial<Record<SchemaBreakpoint, SchemaColumnSpan>>>
  readonly columnStart?: Readonly<Partial<Record<SchemaBreakpoint, number>>>
  readonly order?: Readonly<Partial<Record<SchemaBreakpoint, number>>>
}

export interface SchemaCollapseProperties {
  readonly collapsible: boolean
  readonly collapsed: boolean
  readonly persistenceKey?: string
}

export interface SchemaComponentProperties {
  readonly heading?: string | null
  readonly description?: string | null
  readonly icon?: string | null
  readonly color?: string | null
  readonly label?: string | null
  readonly customType?: string
  readonly customProperties?: JsonObject
  readonly collapse?: SchemaCollapseProperties
  readonly persistenceKey?: string
  readonly splitFrom?: SchemaBreakpoint
  readonly leaf?: SchemaLeafManifest
}

export type SchemaLeafKind = 'entry' | 'filter' | 'widget'

export interface SchemaLeafManifest extends JsonObject {
  readonly definition: JsonObject
  readonly kind: SchemaLeafKind
}

export interface CompiledSchemaComponent<TContext = unknown> {
  readonly kind: SchemaComponentKind
  readonly type: string
  readonly id: string
  readonly key: string
  readonly statePath?: string
  readonly visible: boolean
  readonly dynamicVisibility: boolean
  readonly layout: SchemaLayoutProperties
  readonly extraAttributes: JsonObject
  readonly slots: SchemaRenderSlots
  readonly properties: SchemaComponentProperties
  readonly children: readonly CompiledSchemaComponent<TContext>[]
  readonly server: {
    readonly visibility?: SchemaVisibilityResolver<TContext>
  }
}

export interface CompiledSchema<TValues = Readonly<Record<string, unknown>>, TContext = unknown> {
  readonly kind: 'schema'
  readonly id: string
  readonly statePath?: SchemaPath<TValues>
  readonly components: readonly CompiledSchemaComponent<TContext>[]
}

export interface SchemaComponentManifest {
  readonly children: readonly SchemaComponentManifest[]
  readonly dynamicVisibility: boolean
  readonly extraAttributes: JsonObject
  readonly id: string
  readonly key: string
  readonly kind: SchemaComponentKind
  readonly layout: SchemaLayoutProperties
  readonly properties: SchemaComponentProperties
  readonly slots: SchemaRenderSlots
  readonly statePath?: string
  readonly type: string
  readonly visible: boolean
}

export interface SchemaManifest<TValues = Readonly<Record<string, unknown>>> {
  readonly components: readonly SchemaComponentManifest[]
  readonly id: string
  readonly kind: 'schema'
  readonly statePath?: SchemaPath<TValues>
}

export interface SchemaComponentPatch {
  readonly visible?: boolean
  readonly layout?: SchemaLayoutProperties
  readonly extraAttributes?: JsonObject
  readonly slots?: SchemaRenderSlots
  readonly properties?: SchemaComponentProperties
}

export interface TargetedSchemaPatch {
  readonly id: string
  readonly changes: SchemaComponentPatch
}

export type SchemaJsonValue =
  | boolean
  | null
  | number
  | string
  | readonly SchemaJsonValue[]
  | { readonly [key: string]: SchemaJsonValue }

export type CustomComponentProperties = Readonly<Record<string, SchemaJsonValue>>
