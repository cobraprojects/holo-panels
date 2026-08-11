import type { Component } from 'svelte'
import type { SvelteCustomFieldProps } from './fields'
import type { SvelteCustomColumnProps, SvelteCustomFilterProps } from './tables'
import type { SvelteCustomEntryProps } from './entries'

export interface SvelteRendererDefinition<TValue> {
  readonly valueType: TValue
}

export type SvelteDefinitionValue<TDefinition extends SvelteRendererDefinition<unknown>> = TDefinition['valueType']

export type SvelteDefinedFieldRendererProps<TDefinition extends SvelteRendererDefinition<unknown>> = Omit<SvelteCustomFieldProps, 'setValue' | 'value'> & {
  readonly setValue: (value: SvelteDefinitionValue<TDefinition>) => void
  readonly value: SvelteDefinitionValue<TDefinition>
}

export type SvelteDefinedColumnRendererProps<TDefinition extends SvelteRendererDefinition<unknown>> = Omit<SvelteCustomColumnProps<Record<string, unknown>>, 'value'> & {
  readonly value: SvelteDefinitionValue<TDefinition>
}

export type SvelteDefinedEntryRendererProps<TDefinition extends SvelteRendererDefinition<unknown>> = Omit<SvelteCustomEntryProps, 'entry'> & {
  readonly entry: Omit<SvelteCustomEntryProps['entry'], 'state'> & {
    readonly state: SvelteDefinitionValue<TDefinition>
  }
}

export type SvelteDefinedFilterRendererProps<TDefinition extends SvelteRendererDefinition<unknown>> = Omit<SvelteCustomFilterProps, 'update' | 'value'> & {
  readonly update: (value: SvelteDefinitionValue<TDefinition>) => void
  readonly value: SvelteDefinitionValue<TDefinition>
}

export function defineSvelteFieldRenderer<TDefinition extends SvelteRendererDefinition<unknown>>(_definition: TDefinition, renderer: Component<SvelteDefinedFieldRendererProps<TDefinition>>): Component<SvelteDefinedFieldRendererProps<TDefinition>> {
  return renderer
}

export function defineSvelteColumnRenderer<TDefinition extends SvelteRendererDefinition<unknown>>(_definition: TDefinition, renderer: Component<SvelteDefinedColumnRendererProps<TDefinition>>): Component<SvelteDefinedColumnRendererProps<TDefinition>> {
  return renderer
}

export function defineSvelteEntryRenderer<TDefinition extends SvelteRendererDefinition<unknown>>(_definition: TDefinition, renderer: Component<SvelteDefinedEntryRendererProps<TDefinition>>): Component<SvelteDefinedEntryRendererProps<TDefinition>> {
  return renderer
}

export function defineSvelteFilterRenderer<TDefinition extends SvelteRendererDefinition<unknown>>(_definition: TDefinition, renderer: Component<SvelteDefinedFilterRendererProps<TDefinition>>): Component<SvelteDefinedFilterRendererProps<TDefinition>> {
  return renderer
}
