export type DefaultableComponentKind =
  | 'action'
  | 'column'
  | 'entry'
  | 'field'
  | 'filter'
  | 'schema-component'
  | 'summary'
  | 'widget'

export interface LabelComponentDefaultBuilder {
  label(value: string | null): this
}

export interface SchemaComponentDefaultBuilder {
  hidden(value?: boolean): this
  visible(value?: boolean): this
}

export interface WidgetComponentDefaultBuilder {
  heading(value: string | null): this
}

export interface ComponentDefaultBuilderByKind {
  readonly action: LabelComponentDefaultBuilder
  readonly column: LabelComponentDefaultBuilder
  readonly entry: LabelComponentDefaultBuilder
  readonly field: LabelComponentDefaultBuilder
  readonly filter: LabelComponentDefaultBuilder
  readonly 'schema-component': SchemaComponentDefaultBuilder
  readonly summary: LabelComponentDefaultBuilder
  readonly widget: WidgetComponentDefaultBuilder
}

export interface ComponentDefault<TBuilder extends object = object> {
  readonly apply: <TConcreteBuilder extends TBuilder>(builder: TConcreteBuilder) => TConcreteBuilder
  readonly kind: DefaultableComponentKind
  readonly type: string
}

export interface PanelsConfiguration {
  readonly defaults?: readonly ComponentDefault[]
}

const componentTypePattern = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u

export function componentDefault<
  const TKind extends DefaultableComponentKind,
  const TType extends string,
>(
  kind: TKind,
  type: TType,
  apply: <TBuilder extends ComponentDefaultBuilderByKind[TKind]>(builder: TBuilder) => TBuilder,
): ComponentDefault
export function componentDefault<TBuilder extends object>(
  kind: DefaultableComponentKind,
  type: string,
  apply: (builder: TBuilder) => TBuilder,
): ComponentDefault<TBuilder>
export function componentDefault<TBuilder extends object>(
  kind: DefaultableComponentKind,
  type: string,
  apply: (builder: TBuilder) => TBuilder,
): ComponentDefault<TBuilder> {
  const normalizedType = type.trim()
  if (!componentTypePattern.test(normalizedType)) throw new Error('Component defaults require a stable component type')
  if (typeof apply !== 'function') throw new TypeError('Component defaults require an apply callback')
  const guardedApply = <TConcreteBuilder extends TBuilder>(builder: TConcreteBuilder): TConcreteBuilder => {
    const transformed = apply(builder)
    if (typeof transformed !== 'object' || transformed === null || Object.getPrototypeOf(transformed) !== Object.getPrototypeOf(builder)) {
      throw new TypeError('Component defaults must return the same concrete builder subtype')
    }
    return transformed as TConcreteBuilder
  }
  return Object.freeze({ apply: guardedApply, kind, type: normalizedType })
}

export function definePanelsConfig(configuration: PanelsConfiguration): PanelsConfiguration {
  const defaults = configuration.defaults ?? []
  if (!Array.isArray(defaults)) throw new TypeError('Panels configuration defaults must be an array')
  return Object.freeze({ defaults: Object.freeze([...defaults]) })
}
