import type { FunctionalComponent, VNodeChild } from 'vue'
import type { VueFieldControlProps } from './fields'
import type { VueCustomColumnProps, VueCustomFilterProps } from './tables'
import type { VueCustomEntryProps } from './entries'

export interface VueRendererDefinition<TValue> {
  readonly valueType: TValue
}

export type VueDefinitionValue<TDefinition extends VueRendererDefinition<unknown>> = TDefinition['valueType']

export type VueDefinedFieldRendererProps<TDefinition extends VueRendererDefinition<unknown>> = Omit<VueFieldControlProps<Record<string, unknown>>, 'context'> & {
  readonly context: Omit<VueFieldControlProps<Record<string, unknown>>['context'], 'value'> & {
    readonly value: VueDefinitionValue<TDefinition>
  }
}

export type VueDefinedColumnRendererProps<TDefinition extends VueRendererDefinition<unknown>> = Omit<VueCustomColumnProps<Record<string, unknown>>, 'value'> & {
  readonly value: VueDefinitionValue<TDefinition>
}

export type VueDefinedEntryRendererProps<TDefinition extends VueRendererDefinition<unknown>> = Omit<VueCustomEntryProps, 'entry'> & {
  readonly entry: Omit<VueCustomEntryProps['entry'], 'state'> & {
    readonly state: VueDefinitionValue<TDefinition>
  }
}

export type VueDefinedFilterRendererProps<TDefinition extends VueRendererDefinition<unknown>> = Omit<VueCustomFilterProps, 'update' | 'value'> & {
  readonly update: (value: VueDefinitionValue<TDefinition>) => void
  readonly value: VueDefinitionValue<TDefinition>
}

export function defineVueFieldRenderer<TDefinition extends VueRendererDefinition<unknown>>(_definition: TDefinition, renderer: (props: VueDefinedFieldRendererProps<TDefinition>) => VNodeChild): FunctionalComponent<VueDefinedFieldRendererProps<TDefinition>> {
  return renderer
}

export function defineVueColumnRenderer<TDefinition extends VueRendererDefinition<unknown>>(_definition: TDefinition, renderer: (props: VueDefinedColumnRendererProps<TDefinition>) => VNodeChild): FunctionalComponent<VueDefinedColumnRendererProps<TDefinition>> {
  return renderer
}

export function defineVueEntryRenderer<TDefinition extends VueRendererDefinition<unknown>>(_definition: TDefinition, renderer: (props: VueDefinedEntryRendererProps<TDefinition>) => VNodeChild): FunctionalComponent<VueDefinedEntryRendererProps<TDefinition>> {
  return renderer
}

export function defineVueFilterRenderer<TDefinition extends VueRendererDefinition<unknown>>(_definition: TDefinition, renderer: (props: VueDefinedFilterRendererProps<TDefinition>) => VNodeChild): FunctionalComponent<VueDefinedFilterRendererProps<TDefinition>> {
  return renderer
}
