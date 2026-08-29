import { Button } from '../internal-ui'
import {
  defineComponent,
  h,
  nextTick,
  onMounted,
  ref,
  type Component,
  type PropType,
  type VNode,
  type VNodeChild,
} from 'vue'
import type { JsonObject, JsonValue, SchemaComponentManifest } from '@holo-js/panels-client'
import type {
  VueSchemaRendererProps,
} from './types'

type SchemaBreakpoint = keyof NonNullable<SchemaComponentManifest['layout']['columns']>

const breakpoints: readonly SchemaBreakpoint[] = ['default', 'sm', 'md', 'lg', 'xl', '2xl']

function safeAttributes(attributes: JsonObject): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {}
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'class' && typeof value === 'string') safe.class = value
    else if (name === 'hidden' && typeof value === 'boolean') safe.hidden = value
    else if (name === 'dir' && (value === 'ltr' || value === 'rtl' || value === 'auto')) safe.dir = value
    else if ((name === 'lang' || name === 'title') && typeof value === 'string') safe[name] = value
    else if ((name.startsWith('aria-') || name.startsWith('data-')) && isPrimitive(value)) safe[name] = value
  }
  return safe
}

function isPrimitive(value: JsonValue): value is boolean | number | string {
  return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
}

function layoutStyle(component: SchemaComponentManifest): Record<string, string | number> {
  const style: Record<string, string | number> = {}
  for (const breakpoint of breakpoints) {
    const span = component.layout.columnSpan?.[breakpoint]
    const columns = component.layout.columns?.[breakpoint]
    const start = span === 'full' ? 1 : component.layout.columnStart?.[breakpoint]
    const end = span === 'full' ? -1 : typeof span === 'number' ? `span ${span}` : undefined
    const order = component.layout.order?.[breakpoint]
    if (columns !== undefined) style[`--hp-schema-columns-${breakpoint}`] = columns
    if (start !== undefined) style[`--hp-schema-column-start-${breakpoint}`] = start
    if (end !== undefined) style[`--hp-schema-column-end-${breakpoint}`] = end
    if (order !== undefined) style[`--hp-schema-order-${breakpoint}`] = order
  }
  return style
}

function elementId(schemaId: string, componentId: string, suffix: string): string {
  return `hp-schema-${schemaId}-${componentId}-${suffix}`.replace(/[^a-z0-9_-]/giu, '-')
}

function storageKey(schemaId: string, kind: string, key: string | undefined): string | undefined {
  return key ? `holo-panels:${schemaId}:${kind}:${key}` : undefined
}

function readStoredIndex(key: string | undefined, maximum: number): number {
  if (!key) return 0
  try {
    const stored = Number.parseInt(globalThis.localStorage?.getItem(key) ?? '', 10)
    return Number.isInteger(stored) && stored >= 0 && stored < maximum ? stored : 0
  } catch {
    return 0
  }
}

function readStoredOpen(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback
  try {
    const stored = globalThis.localStorage?.getItem(key)
    return stored === 'true' || stored === 'false' ? stored === 'true' : fallback
  } catch {
    return fallback
  }
}

function persist(key: string | undefined, value: string): void {
  if (!key) return
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    return
  }
}

function rendererName(type: string): string {
  return `schema.${type.replaceAll(':', '.').replaceAll('_', '-')}`
}

interface NodeProps extends Omit<VueSchemaRendererProps, 'schema'> {
  readonly component: SchemaComponentManifest
  readonly schema: VueSchemaRendererProps['schema']
  readonly schemaId: string
}

function slot(props: NodeProps, placement: keyof SchemaComponentManifest['slots']): VNodeChild {
  return (props.component.slots[placement] ?? []).map((reference) => {
    const Renderer = props.registry.resolve(reference.component, props.panelId, `schema ${placement} slot on "${props.component.id}"`)
    return h(Renderer, {
      ...reference.properties,
      component: props.component,
      key: `${reference.source}:${reference.order}:${reference.component}`,
      placement,
      reference,
      schemaComponentId: props.component.id,
      schemaStatePath: props.component.statePath,
    })
  })
}

function icon(component: SchemaComponentManifest): VNodeChild {
  return component.properties.icon
    ? h('span', { 'aria-hidden': 'true', class: 'hp-schema-icon', 'data-icon': component.properties.icon })
    : null
}

function description(component: SchemaComponentManifest): VNodeChild {
  return component.properties.description
    ? h('p', { class: 'hp-schema-description' }, component.properties.description)
    : null
}

function content(props: NodeProps): VNodeChild[] {
  return [
    slot(props, 'before'),
    props.renderContent?.({ component: props.component, panelId: props.panelId, schema: props.schema }),
    ...props.component.children.map(child => h(VueSchemaNode, { ...props, component: child, key: child.key })),
    slot(props, 'after'),
  ]
}

function custom(props: NodeProps, children: VNodeChild[]): VNode {
  const component = props.component
  const Renderer = props.registry.resolve(
    rendererName(component.properties.customType ?? component.type),
    props.panelId,
    `schema component "${component.id}"`,
  )
  return h(Renderer as Component, {
    component,
    properties: component.properties.customProperties ?? {},
    schemaComponentId: component.id,
    schemaStatePath: component.statePath,
  }, { default: () => children })
}

const VueSchemaNode = defineComponent({
  name: 'VueSchemaNode',
  props: {
    component: { type: Object as PropType<SchemaComponentManifest>, required: true },
    panelId: { type: String, required: true },
    registry: { type: Object as PropType<NodeProps['registry']>, required: true },
    renderContent: Function as PropType<NodeProps['renderContent']>,
    schema: { type: Object as PropType<NodeProps['schema']>, required: true },
    schemaId: { type: String, required: true },
  },
  setup(componentProps) {
    const collapse = componentProps.component.properties.collapse
    const collapseKey = storageKey(componentProps.schemaId, 'collapse', collapse?.persistenceKey)
    const open = ref(!(collapse?.collapsed ?? false))
    const selectionKey = storageKey(
      componentProps.schemaId,
      componentProps.component.kind,
      componentProps.component.properties.persistenceKey,
    )
    const selected = ref(0)
    onMounted(() => {
      open.value = readStoredOpen(collapseKey, open.value)
      selected.value = readStoredIndex(selectionKey, componentProps.component.children.filter(child => child.visible).length)
    })

    function select(index: number): void {
      selected.value = index
      persist(selectionKey, String(index))
    }

    function toggle(): void {
      open.value = !open.value
      persist(collapseKey, String(open.value))
    }

    function collapsibleBody(props: NodeProps, children: VNodeChild[], label: string): VNodeChild[] {
      if (!collapse?.collapsible) return children
      const regionId = elementId(props.schemaId, props.component.id, 'content')
      return [
        h(Button, {
          'aria-controls': regionId,
          'aria-expanded': String(open.value),
          type: 'button',
          onClick: toggle,
        }, `${open.value ? 'Collapse' : 'Expand'} ${label}`),
        h('div', { hidden: !open.value, id: regionId }, children),
      ]
    }

    function tabs(props: NodeProps, attributes: Record<string, unknown>): VNode {
      const children = props.component.children.filter(child => child.visible && child.kind === 'tab')
      const activeIndex = Math.min(selected.value, Math.max(0, children.length - 1))
      const onKeydown = (event: KeyboardEvent, index: number): void => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || children.length === 0) return
        const next = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? children.length - 1
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + children.length) % children.length
        event.preventDefault()
        const tablist = (event.currentTarget as HTMLElement).parentElement
        select(next)
        void nextTick(() => tablist?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus())
      }
      return h('div', attributes, [
        slot(props, 'before'),
        props.renderContent?.({ component: props.component, panelId: props.panelId, schema: props.schema }),
        h('div', { 'aria-label': props.component.properties.label ?? props.component.properties.heading ?? 'Tabs', role: 'tablist' }, children.map((child, index) => h(Button, {
          'aria-controls': elementId(props.schemaId, child.id, 'panel'),
          'aria-selected': String(index === activeIndex),
          id: elementId(props.schemaId, child.id, 'tab'),
          key: child.key,
          role: 'tab',
          tabindex: index === activeIndex ? 0 : -1,
          type: 'button',
          onClick: () => select(index),
          onKeydown: (event: KeyboardEvent) => onKeydown(event, index),
        }, child.properties.label ?? `Tab ${index + 1}`))),
        ...children.map((child, index) => h('div', {
          'aria-labelledby': elementId(props.schemaId, child.id, 'tab'),
          hidden: index !== activeIndex,
          id: elementId(props.schemaId, child.id, 'panel'),
          key: child.key,
          role: 'tabpanel',
          tabindex: 0,
        }, index === activeIndex ? [h(VueSchemaNode, { ...props, component: child, key: child.key })] : [])),
        slot(props, 'after'),
      ])
    }

    function wizard(props: NodeProps, attributes: Record<string, unknown>): VNode {
      const children = props.component.children.filter(child => child.visible && child.kind === 'step')
      const activeIndex = Math.min(selected.value, Math.max(0, children.length - 1))
      const active = children[activeIndex]
      return h('div', attributes, [
        slot(props, 'before'),
        props.renderContent?.({ component: props.component, panelId: props.panelId, schema: props.schema }),
        h('nav', { 'aria-label': props.component.properties.label ?? props.component.properties.heading ?? 'Wizard progress' }, [
          h('ol', children.map((child, index) => h('li', { 'aria-current': index === activeIndex ? 'step' : undefined, key: child.key }, [
            h(Button, { type: 'button', onClick: () => select(index) }, child.properties.label ?? `Step ${index + 1}`),
          ]))),
        ]),
        active ? h(VueSchemaNode, { ...props, component: active, key: active.key }) : null,
        children.length > 1 ? h('div', { class: 'hp-schema-wizard-navigation' }, [
          h(Button, { disabled: activeIndex === 0, type: 'button', onClick: () => select(activeIndex - 1) }, 'Previous'),
          h(Button, { disabled: activeIndex === children.length - 1, type: 'button', onClick: () => select(activeIndex + 1) }, 'Next'),
        ]) : null,
        slot(props, 'after'),
      ])
    }

    return (): VNodeChild => {
      const component = componentProps.component
      if (!component.visible) return null
      const props: NodeProps = { ...componentProps, component }
      const extra = safeAttributes(component.extraAttributes)
      const className = ['hp-schema-node', `hp-schema-${component.kind}`, extra.class].filter(Boolean)
      delete extra.class
      const attributes: Record<string, unknown> = {
        ...extra,
        class: className,
        'data-dynamic-visibility': component.dynamicVisibility ? 'true' : undefined,
        'data-compact': component.properties.compact ? 'true' : undefined,
        'data-contained': component.properties.contained === false ? 'false' : undefined,
        'data-grow': component.properties.grow === false ? 'false' : undefined,
        'data-schema-id': component.id,
        'data-schema-leaf': ['entry', 'field', 'filter', 'widget'].includes(component.kind) ? component.kind : undefined,
        'data-state-path': component.statePath,
        style: layoutStyle(component),
      }
      const children = content(props)
      const heading = component.properties.heading
      const body = [heading ? h('h2', [icon(component), heading]) : null, description(component), ...children]
      let rendered: VNode
      if (component.kind === 'grid') rendered = h('div', attributes, children)
      else if (component.kind === 'section') rendered = h('section', attributes, collapsibleBody(props, body, heading ?? 'section'))
      else if (component.kind === 'group') rendered = h('div', { ...attributes, role: 'group' }, collapsibleBody(props, body, component.properties.label ?? heading ?? 'group'))
      else if (component.kind === 'fieldset') rendered = h('fieldset', attributes, [
        h('legend', component.properties.label ?? heading ?? 'Fields'),
        ...collapsibleBody(props, [description(component), ...children], component.properties.label ?? heading ?? 'fields'),
      ])
      else if (component.kind === 'tabs') rendered = tabs(props, attributes)
      else if (component.kind === 'wizard') rendered = wizard(props, attributes)
      else if (component.kind === 'split') rendered = h('div', { ...attributes, 'data-split-from': component.properties.splitFrom ?? 'default' }, children)
      else if (component.kind === 'callout') rendered = h('aside', { ...attributes, 'data-color': component.properties.color ?? undefined, role: 'note' }, body)
      else if (component.kind === 'empty-state') rendered = h('section', { ...attributes, 'aria-label': heading ?? 'Empty state' }, body)
      else if (component.kind === 'custom') rendered = h('div', attributes, [custom(props, children)])
      else rendered = h('div', attributes, [description(component), ...children])
      return [slot(props, 'above'), rendered, slot(props, 'below')]
    }
  },
})

export const VueSchemaRenderer = defineComponent({
  name: 'VueSchemaRenderer',
  props: {
    panelId: { type: String, required: true },
    registry: { type: Object as PropType<VueSchemaRendererProps['registry']>, required: true },
    renderContent: Function as PropType<VueSchemaRendererProps['renderContent']>,
    schema: { type: Object as PropType<VueSchemaRendererProps['schema']>, required: true },
  },
  setup(props) {
    return () => h('div', {
      class: 'hp-schema hp:grid hp:gap-6',
      'data-schema-id': props.schema.id,
      'data-state-path': props.schema.statePath,
    }, props.schema.components.map(component => h(VueSchemaNode, {
      component,
      key: component.key,
      panelId: props.panelId,
      registry: props.registry,
      renderContent: props.renderContent,
      schema: props.schema,
      schemaId: props.schema.id,
    })))
  },
})
