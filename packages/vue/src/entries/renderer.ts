import type { PanelTranslator } from '@holo-js/panels-client'
import { usePanelTranslator } from '../localization'
import { Button } from '../internal-ui'
import { VueActionRenderer } from '../actions/renderer'
import { defineComponent, h, onScopeDispose, ref, shallowRef, type Component, type PropType, type VNode, type VNodeChild } from 'vue'
import {
  entryRichTextMetadata,
  entryUsesMarkdown,
  safeEntryAttributes,
  safeMarkdownBlocks,
  type EntrySafeContentSegment,
} from '@holo-js/panels-client'
import { colorValue, entryRendererName, entryText, safeEntryUrl } from './helpers'
import type { VueCustomEntryProps, VueEntryRendererProps, VueEntrySnapshot } from './types'

const breakpoints = ['default', 'sm', 'md', 'lg', 'xl', '2xl'] as const

function entryLayout(entry: VueEntrySnapshot): Record<string, number | string> {
  const style: Record<string, number | string> = {}
  for (const breakpoint of breakpoints) {
    const span = entry.layout?.columnSpan?.[breakpoint]
    const start = span === 'full' ? 1 : entry.layout?.columnStart?.[breakpoint]
    if (start !== undefined) style[`--hp-schema-column-start-${breakpoint}`] = start
    if (span !== undefined) style[`--hp-schema-column-end-${breakpoint}`] = span === 'full' ? -1 : `span ${span}`
    const order = entry.layout?.order?.[breakpoint]
    if (order !== undefined) style[`--hp-schema-order-${breakpoint}`] = order
  }
  return style
}

function markdownSegment(segment: EntrySafeContentSegment): VNodeChild {
  if (segment.kind === 'strong') return h('strong', segment.value)
  if (segment.kind === 'emphasis') return h('em', segment.value)
  if (segment.kind === 'code') return h('code', segment.value)
  if (segment.kind === 'link') return h('a', { href: segment.href, rel: segment.href.startsWith('/') ? undefined : 'noopener noreferrer' }, segment.value)
  return segment.value
}

function safeRichContent(entry: VueEntrySnapshot): VNodeChild | null {
  if (entryUsesMarkdown(entry.properties)) {
    return h('div', { 'data-entry-content': 'markdown' }, safeMarkdownBlocks(entry.formattedState).map((block, index) => h('p', { key: index }, block.segments.map(markdownSegment))))
  }
  const richText = entryRichTextMetadata(entry.properties)
  return richText
    ? h('div', { 'data-entry-content': 'rich-text', 'data-sanitizer': richText.sanitizer }, entryText(entry.formattedState))
    : null
}

function objectEntries(value: VueEntrySnapshot['formattedState']): readonly (readonly [string, VueEntrySnapshot['formattedState']])[] {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.entries(value) : []
}

function valueList(value: VueEntrySnapshot['formattedState']): readonly VueEntrySnapshot['formattedState'][] {
  return Array.isArray(value) ? value : []
}

function builtInContent(entry: VueEntrySnapshot, translate: PanelTranslator): VNodeChild {
  const state = entry.formattedState
  const richContent = safeRichContent(entry)
  if (richContent) return richContent
  if (entry.type === 'boolean' || entry.type === 'icon') {
    const active = Boolean(entry.state)
    const configuredIcon = entry.type === 'icon'
      ? entry.properties.icon
      : active ? entry.properties.truthyIcon : entry.properties.falsyIcon
    const icon = typeof configuredIcon === 'string' ? configuredIcon : active ? 'check' : 'x-mark'
    return h('span', { 'aria-label': translate(active ? 'filters.yes' : 'filters.no'), 'data-icon': icon, role: 'img' }, active ? '✓' : '✕')
  }
  if (entry.type === 'image') {
    const source = safeEntryUrl(typeof entry.state === 'string' ? entry.state : null)
    const alt = typeof entry.properties.alt === 'string' ? entry.properties.alt : entry.label ?? ''
    const size = typeof entry.properties.size === 'number' ? entry.properties.size : undefined
    return source ? h('img', {
      alt,
      class: entry.properties.circular === true ? 'hp-entry-image-circular' : undefined,
      height: size,
      src: source,
      width: size,
    }) : entryText(state)
  }
  if (entry.type === 'color') {
    const color = colorValue(state)
    return color
      ? h('span', [h('span', { 'aria-hidden': 'true', class: 'hp-entry-color', style: { backgroundColor: color } }), color])
      : entryText(state)
  }
  if (entry.type === 'code') return h('pre', { 'data-line-numbers': entry.properties.lineNumbers === true || undefined }, [h('code', { 'data-language': entry.properties.language }, entryText(state))])
  if (entry.type === 'key-value') {
    const keyLabel = typeof entry.properties.keyLabel === 'string' ? entry.properties.keyLabel : undefined
    const valueLabel = typeof entry.properties.valueLabel === 'string' ? entry.properties.valueLabel : undefined
    return h('dl', { 'aria-label': [keyLabel, valueLabel].filter(Boolean).join(' / ') || undefined }, objectEntries(state).flatMap(([key, value]) => [h('dt', { key: `${key}-key` }, key), h('dd', { key }, entryText(value))]))
  }
  if (entry.type === 'repeatable') {
    const schema = Array.isArray(entry.properties.schema) ? entry.properties.schema.join(' ') : undefined
    return h('ol', { 'data-entry-schema': schema }, valueList(state).map((value, index) => h('li', { key: index }, entryText(value))))
  }
  const text = entryText(state) || entry.placeholder || ''
  return entry.properties.badge === true ? h('span', { class: 'hp-entry-badge' }, text) : text
}

function slot(entry: VueEntrySnapshot, props: VueEntryRendererProps, placement: 'above' | 'after' | 'before' | 'below'): VNodeChild {
  const references = entry.slots?.[placement] ?? []
  if (references.length === 0) return null
  if (!props.registry) throw new Error(`[Holo Panels] A Vue component registry is required for entry ${placement} slots on "${entry.id}".`)
  return references.map(reference => h(props.registry?.resolve(reference.component, props.panelId, `entry ${placement} slot on "${entry.id}"`) as Component, {
    ...reference.properties,
    entry,
    key: `${reference.source}:${reference.order}:${reference.component}`,
    placement,
    reference,
  }))
}

function content(entry: VueEntrySnapshot, props: VueEntryRendererProps, translate: PanelTranslator): VNodeChild {
  if (!entry.type.includes(':entry:')) return builtInContent(entry, translate)
  if (!props.registry) throw new Error(`[Holo Panels] A Vue component registry is required for custom entry "${entry.type}".`)
  const component = props.registry.resolve(
    entryRendererName(entry.type),
    props.panelId,
    `entry "${entry.id}"`,
  ) as Component<VueCustomEntryProps>
  return h(component, { ...props, entry })
}

export const VueEntryRenderer = defineComponent({
  name: 'VueEntryRenderer',
  props: {
    entry: { type: Object as PropType<VueEntryRendererProps>, required: true },
  },
  setup(componentProps) {
    const state = shallowRef(componentProps.entry.store.snapshot)
    onScopeDispose(componentProps.entry.store.subscribe(next => {
      state.value = next
    }))
    const translate = usePanelTranslator()
    const copyStatus = ref('')
    const actionError = ref<string | null>(null)
    const copy = async (): Promise<void> => {
      if (!globalThis.navigator?.clipboard) {
        copyStatus.value = translate('copy.unavailable')
        return
      }
      try {
        await globalThis.navigator.clipboard.writeText(entryText(state.value.formattedState))
        copyStatus.value = translate('copy.copied')
      } catch {
        copyStatus.value = translate('copy.failed')
      }
    }
    const runAction = async (id: string): Promise<void> => {
      if (!componentProps.entry.action) return
      actionError.value = null
      try {
        await componentProps.entry.action(id)
      } catch (cause) {
        actionError.value = cause instanceof Error ? cause.message : translate('feedback.actionFailed')
      }
    }
    return (): VNode => {
      const entry = state.value
      if (entry.visible === false) return h('template')
      const labelId = `${entry.id}-label`
      const safeUrl = safeEntryUrl(entry.url)
      const rendered = content(entry, componentProps.entry, translate)
      const linked = safeUrl
        ? h('a', { href: safeUrl, rel: safeUrl.startsWith('/') ? undefined : 'noopener noreferrer' }, [rendered])
        : rendered
      const attributes = safeEntryAttributes(entry.extraAttributes)
      return h('section', {
        ...attributes,
        'aria-labelledby': entry.label ? labelId : undefined,
        class: ['hp-entry', entry.inlineLabel ? 'hp-entry-inline' : null, attributes.class, attributes.className],
        'data-panels-entry': entry.id,
        style: entryLayout(entry),
        title: entry.tooltip ?? undefined,
      }, [
        slot(entry, componentProps.entry, 'above'),
        entry.label ? h('h3', { id: labelId }, entry.label) : null,
        slot(entry, componentProps.entry, 'before'),
        h('div', { class: 'hp-entry-state' }, [linked]),
        slot(entry, componentProps.entry, 'after'),
        entry.copyable ? h(Button, { type: 'button', onClick: () => void copy() }, translate('actions.copy')) : null,
        ...(componentProps.entry.actionStore ? [] : entry.actions.map(action => h(Button, {
          disabled: entry.pending || !componentProps.entry.action,
          key: action,
          type: 'button',
          onClick: () => void runAction(action),
        }, action))),
        componentProps.entry.actionStore && componentProps.entry.actions?.[0] ? h(VueActionRenderer, {
          action: componentProps.entry.actions[0],
          actions: componentProps.entry.actions.filter(action => entry.actions.includes(action.id)),
          panelId: componentProps.entry.panelId,
          recordIds: componentProps.entry.recordIds,
          registry: componentProps.entry.registry,
          store: componentProps.entry.actionStore,
        }) : null,
        h('span', { 'aria-live': 'polite', class: 'hp-visually-hidden' }, copyStatus.value),
        entry.pending ? h('span', { role: 'status' }, translate('entries.loading')) : null,
        entry.error ? h('span', { role: 'alert' }, entry.error) : null,
        actionError.value ? h('span', { role: 'alert' }, actionError.value) : null,
        slot(entry, componentProps.entry, 'below'),
      ])
    }
  },
})

export function registerVueEntryRenderer(registry: VueEntryRendererProps['registry'], type: string, component: Component): typeof registry {
  if (!registry) throw new Error('[Holo Panels] A Vue component registry is required to register an entry renderer.')
  registry.register(entryRendererName(type), component, '@holo-js/panels-vue')
  return registry
}
