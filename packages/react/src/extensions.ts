import type { ComponentType, ReactNode } from 'react'
import type { ReactFieldControlProps } from './fields'
import type { ReactCustomColumnProps, ReactCustomFilterProps } from './tables'
import type { ReactCustomEntryProps } from './entries'

export interface ReactRendererDefinition<TValue> {
  readonly valueType: TValue
}

export type ReactDefinitionValue<TDefinition extends ReactRendererDefinition<unknown>> = TDefinition['valueType']

export type ReactDefinedFieldRendererProps<TDefinition extends ReactRendererDefinition<unknown>> = Omit<ReactFieldControlProps<Record<string, unknown>>, 'context'> & {
  readonly context: Omit<ReactFieldControlProps<Record<string, unknown>>['context'], 'value'> & {
    readonly value: ReactDefinitionValue<TDefinition>
  }
}

export type ReactDefinedColumnRendererProps<TDefinition extends ReactRendererDefinition<unknown>> = Omit<ReactCustomColumnProps<Record<string, unknown>>, 'value'> & {
  readonly value: ReactDefinitionValue<TDefinition>
}

export type ReactDefinedEntryRendererProps<TDefinition extends ReactRendererDefinition<unknown>> = Omit<ReactCustomEntryProps, 'entry'> & {
  readonly entry: Omit<ReactCustomEntryProps['entry'], 'state'> & {
    readonly state: ReactDefinitionValue<TDefinition>
  }
}

export type ReactDefinedFilterRendererProps<TDefinition extends ReactRendererDefinition<unknown>> = Omit<ReactCustomFilterProps, 'update' | 'value'> & {
  readonly update: (value: ReactDefinitionValue<TDefinition>) => void
  readonly value: ReactDefinitionValue<TDefinition>
}

export function defineReactFieldRenderer<TDefinition extends ReactRendererDefinition<unknown>>(
  _definition: TDefinition,
  renderer: (props: ReactDefinedFieldRendererProps<TDefinition>) => ReactNode,
): ComponentType<ReactDefinedFieldRendererProps<TDefinition>> {
  return renderer
}

export function defineReactColumnRenderer<TDefinition extends ReactRendererDefinition<unknown>>(
  _definition: TDefinition,
  renderer: (props: ReactDefinedColumnRendererProps<TDefinition>) => ReactNode,
): ComponentType<ReactDefinedColumnRendererProps<TDefinition>> {
  return renderer
}

export function defineReactEntryRenderer<TDefinition extends ReactRendererDefinition<unknown>>(
  _definition: TDefinition,
  renderer: (props: ReactDefinedEntryRendererProps<TDefinition>) => ReactNode,
): ComponentType<ReactDefinedEntryRendererProps<TDefinition>> {
  return renderer
}

export function defineReactFilterRenderer<TDefinition extends ReactRendererDefinition<unknown>>(
  _definition: TDefinition,
  renderer: (props: ReactDefinedFilterRendererProps<TDefinition>) => ReactNode,
): ComponentType<ReactDefinedFilterRendererProps<TDefinition>> {
  return renderer
}
