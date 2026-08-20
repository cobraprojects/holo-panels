import {
  DISCOVERY_MARKER,
  PanelBuilder,
  definePage as defineCorePage,
  definePanel as defineCorePanel,
  type DiscoverableDefinition,
  type OptionalRuntimeTypeValue,
  type RuntimeTypeSource,
} from '@holo-js/panels-core'

export { PanelBuilder as PanelDefinition }
export const definePanel = defineCorePanel
export const definePage = defineCorePage

export interface CompiledCustomDefinition<TKind extends string, TValue, TContext> {
  readonly definitionKind: TKind
  readonly id: string
  readonly label?: string
  readonly properties: Readonly<Record<string, unknown>>
  readonly renderer?: string
  readonly visible: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>)
}

export class CustomDefinitionBuilder<TKind extends string, TValue = unknown, TContext = unknown> {
  declare readonly contextType: TContext
  readonly definitionKind: TKind
  readonly id: string
  declare readonly valueType: TValue
  #label?: string
  #properties: Readonly<Record<string, unknown>> = {}
  #renderer?: string
  #visible: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>) = true

  constructor(definitionKind: TKind, id: string) {
    this.definitionKind = definitionKind
    this.id = id
  }

  label(value: string): this { this.#label = value; return this }
  properties(value: Readonly<Record<string, unknown>>): this { this.#properties = Object.freeze({ ...value }); return this }
  renderer(value: string): this { this.#renderer = value; return this }
  visible(value: boolean | ((value: TValue, context: TContext) => boolean | Promise<boolean>)): this { this.#visible = value; return this }

  compile(): CompiledCustomDefinition<TKind, TValue, TContext> {
    return Object.freeze({
      definitionKind: this.definitionKind,
      id: this.id,
      ...(this.#label ? { label: this.#label } : {}),
      properties: this.#properties,
      ...(this.#renderer ? { renderer: this.#renderer } : {}),
      visible: this.#visible,
    })
  }
}

function customDefinition<
  TKind extends string,
  TValueSource extends RuntimeTypeSource | undefined = undefined,
  TContextSource extends RuntimeTypeSource | undefined = undefined,
>(
  definitionKind: TKind,
  id: string,
  _valueSource?: TValueSource,
  _contextSource?: TContextSource,
): CustomDefinitionBuilder<TKind, OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> {
  return new CustomDefinitionBuilder(definitionKind, id)
}

function discoverable<TKind extends DiscoverableDefinition['kind']>(kind: TKind, id: string): DiscoverableDefinition<TKind> {
  return Object.freeze({ discoveryMarker: DISCOVERY_MARKER, id, kind })
}

export const defineColumn = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'column', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('column', id, valueSource, contextSource)
export const defineEntry = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'entry', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('entry', id, valueSource, contextSource)
export const defineField = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'field', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('field', id, valueSource, contextSource)
export const defineFilter = <TValueSource extends RuntimeTypeSource | undefined = undefined, TContextSource extends RuntimeTypeSource | undefined = undefined>(id: string, valueSource?: TValueSource, contextSource?: TContextSource): CustomDefinitionBuilder<'filter', OptionalRuntimeTypeValue<TValueSource>, OptionalRuntimeTypeValue<TContextSource>> => customDefinition('filter', id, valueSource, contextSource)
export const defineCluster = (id: string): DiscoverableDefinition<'cluster'> => discoverable('cluster', id)
export const defineWidget = (id: string): DiscoverableDefinition<'widget'> => discoverable('widget', id)
