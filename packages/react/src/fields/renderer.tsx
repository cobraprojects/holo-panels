import { createElement, type ReactNode } from 'react'
import { ReactBasicField } from './basic'
import { ReactCollectionField } from './collections'
import { ReactOptionField } from './options'
import { useFieldContext } from './shared'
import type { ReactFieldControlProps, ReactFieldRendererProps } from './types'
import { ReactUploadField } from './upload'

const basicTypes = new Set(['checkbox', 'color', 'date', 'hidden', 'radio', 'slider', 'slug', 'text', 'textarea', 'toggle'])
const optionTypes = new Set(['checkbox-list', 'multiselect', 'select', 'toggle-buttons'])
const collectionTypes = new Set(['builder', 'code', 'key-value', 'markdown', 'repeater', 'rich-editor', 'tags'])

export function fieldRendererName(type: string): string {
  return type.startsWith('panels:field:') ? `field.${type.slice('panels:field:'.length)}` : `field.${type.replaceAll(':', '.')}`
}

export function ReactFieldRenderer<TValues extends object>(props: ReactFieldRendererProps<TValues>): ReactNode {
  const context = useFieldContext(props)
  if (!context) return null
  const controlProps: ReactFieldControlProps<TValues> = { ...props, context }
  if (basicTypes.has(props.definition.type)) return <ReactBasicField {...controlProps} />
  if (optionTypes.has(props.definition.type)) return <ReactOptionField {...controlProps} />
  if (collectionTypes.has(props.definition.type)) return <ReactCollectionField {...controlProps} />
  if (props.definition.type === 'panels:field:upload') return <ReactUploadField {...controlProps} />
  const CustomRenderer = props.registry.resolve<ReactFieldControlProps<TValues>>(
    fieldRendererName(props.definition.type),
    props.panelId,
    `field "${props.definition.path}"`,
  )
  return createElement(CustomRenderer, controlProps)
}

export function registerReactFieldRenderers(registry: ReactFieldRendererProps<object>['registry']): typeof registry {
  for (const type of basicTypes) registry.register(fieldRendererName(type), ReactBasicField, '@holo-js/panels-react')
  for (const type of optionTypes) registry.register(fieldRendererName(type), ReactOptionField, '@holo-js/panels-react')
  for (const type of collectionTypes) registry.register(fieldRendererName(type), ReactCollectionField, '@holo-js/panels-react')
  registry.register('field.upload', ReactUploadField, '@holo-js/panels-react')
  return registry
}
