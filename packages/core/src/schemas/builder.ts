import { assignStableKey } from '../builders/stable-id'
import { ComponentDefaultsApplicator } from '../defaults/apply-defaults'
import { appendScopedRenderSlot } from '../panels/render-slots'
import { toJsonValue } from '../protocol/serialization'
import type { JsonObject } from '../protocol/json'
import type { RecordTypeSource, RecordTypeValue, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import {
  SCHEMA_BREAKPOINTS,
  type CompiledSchema,
  type CompiledSchemaComponent,
  type CustomComponentProperties,
  type RenderSlotReference,
  type ResponsiveValue,
  type SchemaBreakpoint,
  type SchemaCollapseProperties,
  type SchemaColumnSpan,
  type SchemaComponentKind,
  type SchemaComponentProperties,
  type SchemaLayoutProperties,
  type SchemaPath,
  type SchemaRenderSlots,
  type SchemaVisibilityResolver,
} from './contracts'

const customComponentTypePattern = /^[a-z][a-z0-9.-]*:[a-z][a-z0-9.-]*$/
const statePathSegmentPattern = /^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+)$/
const unsafeStatePathSegments = new Set(['__proto__', 'constructor', 'prototype'])

interface ComponentCompileContext {
  readonly schemaId: string
  readonly parentId: string
  readonly parentPath?: string
  readonly position: readonly number[]
}

interface ComponentState<TContext> {
  key?: string
  statePath?: string
  visibility: boolean | SchemaVisibilityResolver<TContext>
  columnSpan?: ResponsiveValue<SchemaColumnSpan>
  columnStart?: ResponsiveValue<number>
  order?: ResponsiveValue<number>
  extraAttributes: JsonObject
  slots: SchemaRenderSlots
}

function assertNonEmpty(value: string, name: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${name} cannot be empty`)
  return normalized
}

function normalizeStatePath(value: string): string {
  const path = assertNonEmpty(value, 'State path')
  const segments = path.split('.')
  if (segments.some(segment => !statePathSegmentPattern.test(segment) || unsafeStatePathSegments.has(segment))) {
    throw new Error(`Invalid state path: ${value}`)
  }
  return segments.join('.')
}

function normalizeResponsive<TValue>(
  value: ResponsiveValue<TValue>,
  validate: (item: TValue) => boolean,
  name: string,
): Readonly<Partial<Record<SchemaBreakpoint, TValue>>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    if (!validate(value as TValue)) throw new Error(`Invalid ${name}: ${String(value)}`)
    return Object.freeze({ default: value })
  }

  const responsiveValue = value as Readonly<Record<string, TValue | undefined>>
  const normalized: Partial<Record<SchemaBreakpoint, TValue>> = {}
  for (const key of Object.keys(responsiveValue)) {
    if (!SCHEMA_BREAKPOINTS.includes(key as SchemaBreakpoint)) {
      throw new Error(`Invalid ${name} breakpoint: ${key}`)
    }
    const item = responsiveValue[key]
    if (typeof item !== 'undefined') {
      if (!validate(item)) throw new Error(`Invalid ${name} at ${key}: ${String(item)}`)
      normalized[key as SchemaBreakpoint] = item
    }
  }
  if (Object.keys(normalized).length === 0) throw new Error(`${name} must define at least one breakpoint`)
  return Object.freeze(normalized)
}

function normalizeJsonObject(value: unknown, name: string): JsonObject {
  const normalized = toJsonValue(value)
  if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized)) {
    throw new Error(`${name} must be a JSON-safe object`)
  }
  return normalized
}

function joinStatePath(parentPath: string | undefined, path: string | undefined): string | undefined {
  if (!path) return parentPath
  return parentPath ? `${parentPath}.${path}` : path
}

function freezeValue<TValue>(value: TValue): TValue {
  const visited = new WeakSet<object>()
  const freeze = (current: object): void => {
    if (visited.has(current)) return
    visited.add(current)
    for (const child of Reflect.ownKeys(current).map(key => Reflect.get(current, key))) {
      if ((typeof child === 'object' && child !== null) || typeof child === 'function') freeze(child)
    }
    Object.freeze(current)
  }
  if ((typeof value === 'object' && value !== null) || typeof value === 'function') freeze(value)
  return value
}

export abstract class SchemaComponentBuilder<
  TValues = Readonly<Record<string, unknown>>,
  TContext = unknown,
  TKind extends SchemaComponentKind = SchemaComponentKind,
> {
  readonly kind: TKind
  declare protected readonly valueType: TValues
  readonly #state: ComponentState<TContext>
  #defaults: ComponentDefaultsApplicator<this>
  #compiled?: CompiledSchemaComponent<TContext>

  protected constructor(kind: TKind) {
    this.kind = kind
    this.#defaults = new ComponentDefaultsApplicator('schema-component', kind)
    this.#state = {
      visibility: true,
      extraAttributes: {},
      slots: {},
    }
  }

  key(value: string): this {
    this.assertMutable()
    this.#state.key = assertNonEmpty(value, 'Component key')
    return this
  }

  statePath(value: string): this {
    this.assertMutable()
    this.#state.statePath = normalizeStatePath(value)
    return this
  }

  visible(value: boolean | SchemaVisibilityResolver<TContext> = true): this {
    this.assertMutable()
    this.#state.visibility = value
    return this
  }

  hidden(value: boolean | SchemaVisibilityResolver<TContext> = true): this {
    this.assertMutable()
    this.#state.visibility = typeof value === 'function'
      ? async context => !await value(context)
      : !value
    return this
  }

  columnSpan(value: ResponsiveValue<SchemaColumnSpan>): this {
    this.assertMutable()
    this.#state.columnSpan = value
    return this
  }

  columnStart(value: ResponsiveValue<number>): this {
    this.assertMutable()
    this.#state.columnStart = value
    return this
  }

  order(value: ResponsiveValue<number>): this {
    this.assertMutable()
    this.#state.order = value
    return this
  }

  extraAttributes(value: Readonly<Record<string, unknown>>): this {
    this.assertMutable()
    this.#state.extraAttributes = normalizeJsonObject(value, 'Extra attributes')
    return this
  }

  before(reference: string | RenderSlotReference): this {
    return this.setSlot('before', reference)
  }

  after(reference: string | RenderSlotReference): this {
    return this.setSlot('after', reference)
  }

  above(reference: string | RenderSlotReference): this {
    return this.setSlot('above', reference)
  }

  below(reference: string | RenderSlotReference): this {
    return this.setSlot('below', reference)
  }

  compileComponent(context: ComponentCompileContext): CompiledSchemaComponent<TContext> {
    if (this.#compiled) {
      const expectedKey = assignStableKey(this.kind, this.#state.key, context.position)
      const expectedId = `${context.parentId}.${expectedKey}`
      if (this.#compiled.id !== expectedId) {
        throw new Error(`Schema component ${this.#compiled.id} cannot be reused at ${expectedId}`)
      }
      return this.#compiled
    }

    this.assertMutable()

    const key = assignStableKey(this.kind, this.#state.key, context.position)
    const id = `${context.parentId}.${key}`
    const statePath = joinStatePath(context.parentPath, this.#state.statePath)
    const visibility = this.#state.visibility
    const dynamicVisibility = typeof visibility === 'function'
    const layout: SchemaLayoutProperties = {
      ...(typeof this.#state.columnSpan !== 'undefined'
        ? { columnSpan: normalizeResponsive(this.#state.columnSpan, item => item === 'full' || Number.isSafeInteger(item) && item > 0, 'column span') }
        : {}),
      ...(typeof this.#state.columnStart !== 'undefined'
        ? { columnStart: normalizeResponsive(this.#state.columnStart, item => Number.isSafeInteger(item) && item > 0, 'column start') }
        : {}),
      ...(typeof this.#state.order !== 'undefined'
        ? { order: normalizeResponsive(this.#state.order, Number.isSafeInteger, 'order') }
        : {}),
      ...this.layoutProperties(),
    }
    const definition: CompiledSchemaComponent<TContext> = {
      kind: this.kind,
      type: this.componentType(),
      id,
      key,
      ...(statePath ? { statePath } : {}),
      visible: typeof visibility === 'function' ? true : visibility,
      dynamicVisibility,
      layout,
      extraAttributes: this.#state.extraAttributes,
      slots: this.#state.slots,
      properties: this.componentProperties(),
      children: this.compileChildren({
        schemaId: context.schemaId,
        parentId: id,
        ...(statePath ? { parentPath: statePath } : {}),
        position: context.position,
      }),
      server: typeof visibility === 'function' ? { visibility } : {},
    }
    this.#compiled = freezeValue(definition)
    return this.#compiled
  }

  protected assertMutable(): void {
    this.#defaults.configure(this, Boolean(this.#compiled))
    if (this.#compiled) throw new Error(`Cannot change ${this.kind} after schema compilation`)
  }

  protected configureComponentDefaultType(type: string): void {
    this.#defaults = new ComponentDefaultsApplicator('schema-component', type)
  }

  protected componentType(): string {
    return this.kind
  }

  protected componentProperties(): SchemaComponentProperties {
    return {}
  }

  protected layoutProperties(): SchemaLayoutProperties {
    return {}
  }

  protected compileChildren(_context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[] {
    return []
  }

  private setSlot(slot: keyof SchemaRenderSlots, reference: string | RenderSlotReference): this {
    this.assertMutable()
    this.#state.slots = appendScopedRenderSlot(this.#state.slots, slot, reference, 'component')
    return this
  }
}

export class ContainerComponentBuilder<
  TValues = Readonly<Record<string, unknown>>,
  TContext = unknown,
  TKind extends SchemaComponentKind = SchemaComponentKind,
> extends SchemaComponentBuilder<TValues, TContext, TKind> {
  #children: readonly SchemaComponentBuilder<TValues, TContext>[] = []

  protected constructor(kind: TKind, children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super(kind)
    this.#children = [...children]
  }

  schema(children: readonly SchemaComponentBuilder<TValues, TContext>[]): this {
    this.assertMutable()
    this.#children = [...children]
    return this
  }

  protected override compileChildren(context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[] {
    return this.#children.map((child, index) => child.compileComponent({
      ...context,
      position: [...context.position, index],
    }))
  }
}

export class GridBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends ContainerComponentBuilder<TValues, TContext, 'grid'> {
  #columns: ResponsiveValue<number> = 1

  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('grid', children)
  }

  columns(value: ResponsiveValue<number>): this {
    this.assertMutable()
    this.#columns = value
    return this
  }

  protected override layoutProperties(): SchemaLayoutProperties {
    return {
      columns: normalizeResponsive(this.#columns, item => Number.isSafeInteger(item) && item > 0, 'column count'),
    }
  }
}

abstract class CollapsibleContainerBuilder<
  TValues,
  TContext,
  TKind extends 'fieldset' | 'group' | 'section',
> extends ContainerComponentBuilder<TValues, TContext, TKind> {
  #collapsible = false
  #collapsed = false
  #persistenceKey?: string

  collapsible(value = true): this {
    this.assertMutable()
    this.#collapsible = value
    return this
  }

  collapsed(value = true): this {
    this.assertMutable()
    this.#collapsed = value
    return this
  }

  persistCollapse(key: string): this {
    this.assertMutable()
    this.#persistenceKey = assertNonEmpty(key, 'Collapse persistence key')
    return this
  }

  protected collapseProperties(): SchemaCollapseProperties {
    if (this.#collapsed && !this.#collapsible) {
      throw new Error(`${this.kind} must be collapsible before it can start collapsed`)
    }
    if (this.#persistenceKey && !this.#collapsible) {
      throw new Error(`${this.kind} must be collapsible before collapse state can persist`)
    }
    return {
      collapsible: this.#collapsible,
      collapsed: this.#collapsed,
      ...(this.#persistenceKey ? { persistenceKey: this.#persistenceKey } : {}),
    }
  }
}

export class SectionBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends CollapsibleContainerBuilder<TValues, TContext, 'section'> {
  #heading: string | null = null
  #description: string | null = null

  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('section', children)
  }

  heading(value: string | null): this {
    this.assertMutable()
    this.#heading = value === null ? null : assertNonEmpty(value, 'Section heading')
    return this
  }

  description(value: string | null): this {
    this.assertMutable()
    this.#description = value === null ? null : assertNonEmpty(value, 'Section description')
    return this
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { heading: this.#heading, description: this.#description, collapse: this.collapseProperties() }
  }
}

export class GroupBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends CollapsibleContainerBuilder<TValues, TContext, 'group'> {
  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('group', children)
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { collapse: this.collapseProperties() }
  }
}

export class FieldsetBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends CollapsibleContainerBuilder<TValues, TContext, 'fieldset'> {
  #label: string | null = null

  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('fieldset', children)
  }

  label(value: string | null): this {
    this.assertMutable()
    this.#label = value === null ? null : assertNonEmpty(value, 'Fieldset label')
    return this
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { label: this.#label, collapse: this.collapseProperties() }
  }
}

class PersistentContainerBuilder<
  TValues,
  TContext,
  TKind extends 'tabs' | 'wizard',
> extends ContainerComponentBuilder<TValues, TContext, TKind> {
  #persistenceKey?: string

  persist(key: string): this {
    this.assertMutable()
    this.#persistenceKey = assertNonEmpty(key, 'Selection persistence key')
    return this
  }

  protected override componentProperties(): SchemaComponentProperties {
    return this.#persistenceKey ? { persistenceKey: this.#persistenceKey } : {}
  }
}

export class TabsBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends PersistentContainerBuilder<TValues, TContext, 'tabs'> {
  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('tabs', children)
  }

  protected override compileChildren(context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[] {
    const children = super.compileChildren(context)
    if (children.some(child => child.kind !== 'tab')) throw new Error('Tabs may contain only tab components')
    return children
  }
}

export class TabBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends ContainerComponentBuilder<TValues, TContext, 'tab'> {
  #label: string | null = null

  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('tab', children)
  }

  label(value: string): this {
    this.assertMutable()
    this.#label = assertNonEmpty(value, 'Tab label')
    return this
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { label: this.#label }
  }
}

export class WizardBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends PersistentContainerBuilder<TValues, TContext, 'wizard'> {
  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('wizard', children)
  }

  protected override compileChildren(context: ComponentCompileContext): readonly CompiledSchemaComponent<TContext>[] {
    const children = super.compileChildren(context)
    if (children.some(child => child.kind !== 'step')) throw new Error('Wizards may contain only step components')
    return children
  }
}

export class StepBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends ContainerComponentBuilder<TValues, TContext, 'step'> {
  #label: string | null = null
  #description: string | null = null

  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('step', children)
  }

  label(value: string): this {
    this.assertMutable()
    this.#label = assertNonEmpty(value, 'Step label')
    return this
  }

  description(value: string | null): this {
    this.assertMutable()
    this.#description = value === null ? null : assertNonEmpty(value, 'Step description')
    return this
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { label: this.#label, description: this.#description }
  }
}

export class SplitBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends ContainerComponentBuilder<TValues, TContext, 'split'> {
  #from: SchemaBreakpoint = 'md'

  constructor(children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) {
    super('split', children)
  }

  from(value: SchemaBreakpoint): this {
    this.assertMutable()
    this.#from = value
    return this
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { splitFrom: this.#from }
  }
}

abstract class MessageComponentBuilder<
  TValues,
  TContext,
  TKind extends 'callout' | 'empty-state',
> extends SchemaComponentBuilder<TValues, TContext, TKind> {
  #heading: string | null = null
  #description: string | null = null
  #icon: string | null = null

  heading(value: string): this {
    this.assertMutable()
    this.#heading = assertNonEmpty(value, 'Heading')
    return this
  }

  description(value: string | null): this {
    this.assertMutable()
    this.#description = value === null ? null : assertNonEmpty(value, 'Description')
    return this
  }

  icon(value: string | null): this {
    this.assertMutable()
    this.#icon = value === null ? null : assertNonEmpty(value, 'Icon')
    return this
  }

  protected messageProperties(): SchemaComponentProperties {
    return { heading: this.#heading, description: this.#description, icon: this.#icon }
  }
}

export class CalloutBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends MessageComponentBuilder<TValues, TContext, 'callout'> {
  #color: string | null = null

  constructor() {
    super('callout')
  }

  color(value: string | null): this {
    this.assertMutable()
    this.#color = value === null ? null : assertNonEmpty(value, 'Callout color')
    return this
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { ...this.messageProperties(), color: this.#color }
  }
}

export class EmptyStateBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends MessageComponentBuilder<TValues, TContext, 'empty-state'> {
  constructor() {
    super('empty-state')
  }

  protected override componentProperties(): SchemaComponentProperties {
    return this.messageProperties()
  }
}

export class CustomComponentBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown>
  extends SchemaComponentBuilder<TValues, TContext, 'custom'> {
  readonly #customType: string
  #properties: JsonObject = {}

  constructor(customType: string) {
    super('custom')
    this.#customType = assertNonEmpty(customType, 'Custom component type')
    if (!customComponentTypePattern.test(this.#customType)) {
      throw new Error(`Invalid custom component type: ${this.#customType}`)
    }
    this.configureComponentDefaultType(this.#customType)
  }

  properties(value: CustomComponentProperties): this {
    this.assertMutable()
    this.#properties = normalizeJsonObject(value, 'Custom component properties')
    return this
  }

  protected override componentType(): string {
    return this.#customType
  }

  protected override componentProperties(): SchemaComponentProperties {
    return { customType: this.#customType, customProperties: this.#properties }
  }
}

export class SchemaBuilder<TValues = Readonly<Record<string, unknown>>, TContext = unknown> {
  readonly #id: string
  #statePath?: SchemaPath<TValues>
  #components: readonly SchemaComponentBuilder<TValues, TContext>[] = []
  #compiled?: CompiledSchema<TValues, TContext>

  constructor(id: string) {
    this.#id = assignStableKey('schema', id, [])
  }

  statePath<TPath extends SchemaPath<TValues>>(value: TPath): this {
    this.assertMutable()
    normalizeStatePath(value)
    this.#statePath = value
    return this
  }

  components(components: readonly SchemaComponentBuilder<TValues, TContext>[]): this {
    this.assertMutable()
    this.#components = [...components]
    return this
  }

  schema(components: readonly SchemaComponentBuilder<TValues, TContext>[]): this {
    return this.components(components)
  }

  compile(): CompiledSchema<TValues, TContext> {
    if (this.#compiled) return this.#compiled
    const components = this.#components.map((component, index) => component.compileComponent({
      schemaId: this.#id,
      parentId: this.#id,
      ...(this.#statePath ? { parentPath: this.#statePath } : {}),
      position: [index],
    }))
    const ids = new Set<string>()
    const visit = (node: CompiledSchemaComponent<TContext>): void => {
      if (ids.has(node.id)) throw new Error(`Duplicate schema component key at ${node.id}`)
      ids.add(node.id)
      node.children.forEach(visit)
    }
    components.forEach(visit)
    this.#compiled = freezeValue({
      kind: 'schema',
      id: this.#id,
      ...(this.#statePath ? { statePath: this.#statePath } : {}),
      components,
    })
    return this.#compiled
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error(`Cannot change schema ${this.#id} after compilation`)
  }
}

export type SchemaTypeSource<TValue extends object> = RecordTypeSource & (
  | { readonly prototype: TValue }
  | { create(...parameters: never[]): TValue | Promise<TValue> }
)

export function defineSchema<TValuesSource extends RecordTypeSource>(id: string, values: TValuesSource): SchemaBuilder<RecordTypeValue<TValuesSource>, unknown>
export function defineSchema<TValuesSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource>(id: string, values: TValuesSource, context: TContextSource): SchemaBuilder<RecordTypeValue<TValuesSource>, RuntimeTypeValue<TContextSource>>
export function defineSchema(id?: string): SchemaBuilder<Readonly<Record<string, unknown>>, unknown>
export function defineSchema<TValuesSource extends RecordTypeSource = RecordTypeSource, TContextSource extends RuntimeTypeSource = RuntimeTypeSource>(
  id = 'schema',
  _values?: TValuesSource,
  _context?: TContextSource,
): SchemaBuilder<RecordTypeValue<TValuesSource>, RuntimeTypeValue<TContextSource>> {
  return new SchemaBuilder<RecordTypeValue<TValuesSource>, RuntimeTypeValue<TContextSource>>(id)
}
