import { type JsonObject, type RecordPath, toJsonValue } from '@holo-js/panels-core'

export type SchemaOperation = 'create' | 'edit' | 'view' | string
export type SchemaColumns = number | Readonly<Record<string, number>>

export interface SchemaComponentManifest {
  readonly kind: string
  readonly key: string
  readonly properties?: JsonObject
  readonly server?: object
  readonly [property: string]: unknown
}

export interface SchemaComponentContract<TRecord extends object = object> {
  compile(): object
}

export type SchemaComponent<TRecord extends object = object> = SchemaComponentContract<TRecord>
export type SchemaComponentFor<TRecord extends object> = SchemaComponentContract & (
  | { readonly recordPath: RecordPath<TRecord> }
  | { readonly recordPath?: undefined }
)

function compileComponent(component: SchemaComponentContract): SchemaComponentManifest {
  const compiled = component.compile()
  const candidate = 'manifest' in compiled ? Reflect.get(compiled, 'manifest') : compiled
  if (!candidate || typeof candidate !== 'object') throw new Error('Schema components must compile to an object manifest')
  return candidate as SchemaComponentManifest
}

export function compileSchemaComponentManifest(component: SchemaComponentContract): JsonObject {
  const client = Object.fromEntries(Object.entries(compileComponent(component)).filter(([key]) => key !== 'server'))
  const value = toJsonValue(client)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Schema component manifests must be JSON-safe objects')
  return value
}

export class Schema<TRecord extends object = Record<string, unknown>, TState extends object = TRecord, TFactory = undefined> {
  declare readonly resourceRecordType: TRecord
  declare readonly stateType: TState
  readonly definitionKind = 'schema' as const
  #components: readonly SchemaComponentContract<TRecord>[] = []
  #columns: SchemaColumns = 1
  #extraAttributes: JsonObject = {}
  #operation: SchemaOperation | null = null
  readonly #factory: TFactory | undefined

  constructor(factory?: TFactory) {
    this.#factory = factory
  }

  components(components: readonly SchemaComponentFor<TRecord>[]): this
  components<const TComponents extends readonly SchemaComponentContract<TRecord>[]>(components: (factory: TFactory) => TComponents): this
  components<const TComponents extends readonly SchemaComponentContract<TRecord>[]>(components: readonly SchemaComponentFor<TRecord>[] | ((factory: TFactory) => TComponents)): this {
    let resolved: readonly SchemaComponentContract[]
    if (typeof components === 'function') {
      const factory = this.#factory
      if (factory === undefined) throw new Error('Schema component callbacks require a component factory')
      resolved = components(factory)
    } else {
      resolved = components
    }
    this.#components = Object.freeze([...resolved])
    return this
  }

  schema<const TComponents extends readonly SchemaComponentContract<TRecord>[]>(components: TComponents): this {
    return this.components(components)
  }

  columns(columns: SchemaColumns): this {
    this.#columns = typeof columns === 'number' ? columns : Object.freeze({ ...columns })
    return this
  }

  extraAttributes(attributes: Readonly<Record<string, unknown>>): this {
    const value = toJsonValue(attributes)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Schema extra attributes must be a JSON-safe object')
    }
    this.#extraAttributes = value
    return this
  }

  operation(operation: SchemaOperation | null): this {
    this.#operation = operation
    return this
  }

  getComponents(): readonly SchemaComponentContract<TRecord>[] {
    return this.#components
  }

  compile(): Readonly<{
    readonly columns: SchemaColumns
    readonly extraAttributes: JsonObject
    readonly fields: readonly SchemaComponentManifest[]
    readonly operation: SchemaOperation | null
  }> {
    return Object.freeze({
      columns: this.#columns,
      extraAttributes: Object.freeze({ ...this.#extraAttributes }),
      fields: Object.freeze(this.#components.map(compileComponent)),
      operation: this.#operation,
    })
  }
}

export abstract class Component<TRecord extends object = object> implements SchemaComponentContract<TRecord> {
  declare readonly resourceRecordType: TRecord
  readonly key: string
  readonly kind: string
  #columnSpan: number | 'full' | Readonly<Record<string, number | 'full'>> = 1
  #columnStart: number | Readonly<Record<string, number>> | null = null
  #extraAttributes: JsonObject = {}
  #hidden = false

  protected constructor(kind: string, key: string) {
    this.kind = kind
    this.key = key
  }

  columnSpan(span: number | 'full' | Readonly<Record<string, number | 'full'>>): this {
    this.#columnSpan = typeof span === 'object' ? Object.freeze({ ...span }) : span
    return this
  }

  columnSpanFull(): this {
    return this.columnSpan('full')
  }

  columnStart(start: number | Readonly<Record<string, number>> | null): this {
    this.#columnStart = typeof start === 'object' && start !== null ? Object.freeze({ ...start }) : start
    return this
  }

  extraAttributes(attributes: Readonly<Record<string, unknown>>): this {
    const value = toJsonValue(attributes)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Schema component extra attributes must be a JSON-safe object')
    }
    this.#extraAttributes = value
    return this
  }

  hidden(value = true): this {
    this.#hidden = value
    return this
  }

  visible(value = true): this {
    this.#hidden = !value
    return this
  }

  compile(): SchemaComponentManifest {
    return Object.freeze({
      columnSpan: this.#columnSpan,
      columnStart: this.#columnStart,
      extraAttributes: Object.freeze({ ...this.#extraAttributes }),
      hidden: this.#hidden,
      key: this.key,
      kind: this.kind,
      ...this.componentProperties(),
    })
  }

  protected componentProperties(): JsonObject {
    return {}
  }
}

abstract class ChildComponent<TRecord extends object = object> extends Component<TRecord> {
  #children: readonly SchemaComponentContract<TRecord>[] = []

  schema<const TComponents extends readonly SchemaComponentContract<TRecord>[]>(components: TComponents): this {
    this.#children = Object.freeze([...components])
    return this
  }

  components<const TComponents extends readonly SchemaComponentContract<TRecord>[]>(components: TComponents): this {
    return this.schema(components)
  }

  protected override componentProperties(): JsonObject {
    return {
      children: this.#children.map(compileSchemaComponentManifest),
    }
  }
}

export class Grid<TRecord extends object = object> extends ChildComponent<TRecord> {
  readonly #gridColumns: SchemaColumns

  private constructor(columns: SchemaColumns = 2) {
    super('grid', 'grid')
    this.#gridColumns = columns
  }

  static make<TRecord extends object = object>(columns: SchemaColumns = 2): Grid<TRecord> {
    return new Grid(columns)
  }

  protected override componentProperties(): JsonObject {
    return { ...super.componentProperties(), columns: this.#gridColumns }
  }
}

export class Section<TRecord extends object = object> extends ChildComponent<TRecord> {
  #aside = false
  #collapsed = false
  #collapsible = false
  #compact = false
  #description: string | null = null
  #heading: string | null
  #icon: string | null = null

  private constructor(heading: string | null = null) {
    super('section', heading ?? 'section')
    this.#heading = heading
  }

  static make<TRecord extends object = object>(heading: string | null = null): Section<TRecord> {
    return new Section(heading)
  }

  aside(value = true): this {
    this.#aside = value
    return this
  }

  collapsed(value = true): this {
    this.#collapsed = value
    return this
  }

  collapsible(value = true): this {
    this.#collapsible = value
    return this
  }

  compact(value = true): this {
    this.#compact = value
    return this
  }

  description(value: string | null): this {
    this.#description = value
    return this
  }

  heading(value: string | null): this {
    this.#heading = value
    return this
  }

  icon(value: string | null): this {
    this.#icon = value
    return this
  }

  protected override componentProperties(): JsonObject {
    return {
      ...super.componentProperties(),
      aside: this.#aside,
      collapsed: this.#collapsed,
      collapsible: this.#collapsible,
      compact: this.#compact,
      description: this.#description,
      heading: this.#heading,
      icon: this.#icon,
    }
  }
}

export class Tabs<TRecord extends object = object> extends ChildComponent<TRecord> {
  private constructor(key = 'tabs') {
    super('tabs', key)
  }

  static make<TRecord extends object = object>(key = 'tabs'): Tabs<TRecord> {
    return new Tabs(key)
  }
}

export class Tab<TRecord extends object = object> extends ChildComponent<TRecord> {
  #badge: number | string | null = null
  #icon: string | null = null
  readonly #label: string

  private constructor(label: string) {
    super('tab', label)
    this.#label = label
  }

  static make<TRecord extends object = object>(label: string): Tab<TRecord> {
    return new Tab(label)
  }

  badge(value: number | string | null): this {
    this.#badge = value
    return this
  }

  icon(value: string | null): this {
    this.#icon = value
    return this
  }

  protected override componentProperties(): JsonObject {
    return { ...super.componentProperties(), badge: this.#badge, icon: this.#icon, label: this.#label }
  }
}

export class Fieldset<TRecord extends object = object> extends ChildComponent<TRecord> {
  readonly #label: string

  private constructor(label: string) {
    super('fieldset', label)
    this.#label = label
  }

  static make<TRecord extends object = object>(label: string): Fieldset<TRecord> {
    return new Fieldset(label)
  }

  protected override componentProperties(): JsonObject {
    return { ...super.componentProperties(), label: this.#label }
  }
}

export class Wizard<TRecord extends object = object> extends ChildComponent<TRecord> {
  private constructor(key = 'wizard') {
    super('wizard', key)
  }

  static make<TRecord extends object = object>(key = 'wizard'): Wizard<TRecord> {
    return new Wizard(key)
  }

  steps<const TSteps extends readonly SchemaComponentContract<TRecord>[]>(steps: TSteps): this {
    return this.schema(steps)
  }
}

export class WizardStep<TRecord extends object = object> extends ChildComponent<TRecord> {
  readonly #label: string

  private constructor(label: string) {
    super('wizard-step', label)
    this.#label = label
  }

  static make<TRecord extends object = object>(label: string): WizardStep<TRecord> {
    return new WizardStep(label)
  }

  protected override componentProperties(): JsonObject {
    return { ...super.componentProperties(), label: this.#label }
  }
}

export interface LayoutFactory<TRecord extends object> {
  fieldset(label: string): Fieldset<TRecord>
  grid(columns?: SchemaColumns): Grid<TRecord>
  section(heading?: string | null): Section<TRecord>
  tab(label: string): Tab<TRecord>
  tabs(key?: string): Tabs<TRecord>
  wizard(key?: string): Wizard<TRecord>
  wizardStep(label: string): WizardStep<TRecord>
}

export function createLayoutFactory<TRecord extends object>(): LayoutFactory<TRecord> {
  return Object.freeze({
    fieldset: (label: string) => Fieldset.make<TRecord>(label),
    grid: (columns?: SchemaColumns) => Grid.make<TRecord>(columns),
    section: (heading?: string | null) => Section.make<TRecord>(heading),
    tab: (label: string) => Tab.make<TRecord>(label),
    tabs: (key?: string) => Tabs.make<TRecord>(key),
    wizard: (key?: string) => Wizard.make<TRecord>(key),
    wizardStep: (label: string) => WizardStep.make<TRecord>(label),
  })
}
