import { usePanelTranslator } from '../localization'
import {
  createElement,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import {
  entryRichTextMetadata,
  entryUsesMarkdown,
  safeEntryAttributes,
  safeMarkdownBlocks,
  type EntrySafeContentSegment,
} from '@holo-js/panels-client'
import { Button } from '../internal-ui'
import { ReactActionRenderer } from '../actions/renderer'
import { colorValue, entryRendererName, entryText, safeEntryUrl } from './helpers'
import type {
  ReactCustomEntryProps,
  ReactEntryRendererProps,
  ReactEntrySlotRendererProps,
  ReactEntrySnapshot,
} from './types'

const breakpoints = ['default', 'sm', 'md', 'lg', 'xl', '2xl'] as const

function entryAttributes(entry: ReactEntrySnapshot): HTMLAttributes<HTMLElement> {
  const attributes = safeEntryAttributes(entry.extraAttributes)
  const normalized: Record<string, boolean | number | string> = {}
  for (const [name, value] of Object.entries(attributes)) normalized[name === 'class' ? 'className' : name] = value
  return normalized as HTMLAttributes<HTMLElement>
}

function entryLayout(entry: ReactEntrySnapshot): CSSProperties {
  const style: Record<string, number | string> = {}
  for (const breakpoint of breakpoints) {
    const span = entry.layout?.columnSpan?.[breakpoint]
    const start = span === 'full' ? 1 : entry.layout?.columnStart?.[breakpoint]
    if (start !== undefined) style[`--hp-schema-column-start-${breakpoint}`] = start
    if (span !== undefined) style[`--hp-schema-column-end-${breakpoint}`] = span === 'full' ? -1 : `span ${span}`
    const order = entry.layout?.order?.[breakpoint]
    if (order !== undefined) style[`--hp-schema-order-${breakpoint}`] = order
  }
  return style as CSSProperties
}

function MarkdownSegment({ segment }: { readonly segment: EntrySafeContentSegment }): ReactNode {
  if (segment.kind === 'strong') return <strong>{segment.value}</strong>
  if (segment.kind === 'emphasis') return <em>{segment.value}</em>
  if (segment.kind === 'code') return <code>{segment.value}</code>
  if (segment.kind === 'link') return <a href={segment.href} rel={segment.href.startsWith('/') ? undefined : 'noopener noreferrer'}>{segment.value}</a>
  return segment.value
}

function safeRichContent(entry: ReactEntrySnapshot): ReactNode | null {
  if (entryUsesMarkdown(entry.properties)) {
    return <div data-entry-content="markdown">{safeMarkdownBlocks(entry.formattedState).map((block, blockIndex) => (
      <p key={blockIndex}>{block.segments.map((segment, segmentIndex) => <MarkdownSegment key={segmentIndex} segment={segment} />)}</p>
    ))}</div>
  }
  const richText = entryRichTextMetadata(entry.properties)
  return richText
    ? <div data-entry-content="rich-text" data-sanitizer={richText.sanitizer}>{entryText(entry.formattedState)}</div>
    : null
}

function objectEntries(value: ReactEntrySnapshot['formattedState']): readonly (readonly [string, ReactEntrySnapshot['formattedState']])[] {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.entries(value) : []
}

function valueList(value: ReactEntrySnapshot['formattedState']): readonly ReactEntrySnapshot['formattedState'][] {
  return Array.isArray(value) ? value : []
}

function BuiltInContent({ entry }: { readonly entry: ReactEntrySnapshot }): ReactNode {
  const translate = usePanelTranslator()
  const state = entry.formattedState
  const richContent = safeRichContent(entry)
  if (richContent) return richContent
  if (entry.type === 'boolean' || entry.type === 'icon') {
    const active = Boolean(entry.state)
    const configuredIcon = entry.type === 'icon'
      ? entry.properties.icon
      : active ? entry.properties.truthyIcon : entry.properties.falsyIcon
    const icon = typeof configuredIcon === 'string' ? configuredIcon : active ? 'check' : 'x-mark'
    return <span aria-label={translate(active ? 'filters.yes' : 'filters.no')} data-icon={icon} role="img">{active ? '✓' : '✕'}</span>
  }
  if (entry.type === 'image') {
    const source = safeEntryUrl(typeof entry.state === 'string' ? entry.state : null)
    const alt = typeof entry.properties.alt === 'string' ? entry.properties.alt : entry.label ?? ''
    const size = typeof entry.properties.size === 'number' ? entry.properties.size : undefined
    return source ? <img alt={alt} className={entry.properties.circular === true ? 'hp-entry-image-circular' : undefined} height={size} src={source} width={size} /> : entryText(state)
  }
  if (entry.type === 'color') {
    const color = colorValue(state)
    return color ? <span><span aria-hidden="true" className="hp-entry-color" style={{ backgroundColor: color }} />{color}</span> : entryText(state)
  }
  if (entry.type === 'code') return <pre data-line-numbers={entry.properties.lineNumbers === true || undefined}><code data-language={entry.properties.language}>{entryText(state)}</code></pre>
  if (entry.type === 'key-value') {
    const keyLabel = typeof entry.properties.keyLabel === 'string' ? entry.properties.keyLabel : undefined
    const valueLabel = typeof entry.properties.valueLabel === 'string' ? entry.properties.valueLabel : undefined
    return <dl aria-label={[keyLabel, valueLabel].filter(Boolean).join(' / ') || undefined}>{objectEntries(state).flatMap(([key, value]) => [<dt key={`${key}-key`}>{key}</dt>, <dd key={key}>{entryText(value)}</dd>])}</dl>
  }
  if (entry.type === 'repeatable') {
    const schema = Array.isArray(entry.properties.schema) ? entry.properties.schema.join(' ') : undefined
    return <ol data-entry-schema={schema}>{valueList(state).map((value, index) => <li key={index}>{entryText(value)}</li>)}</ol>
  }
  const text = entryText(state) || entry.placeholder || ''
  return entry.properties.badge === true ? <span className="hp-entry-badge">{text}</span> : text
}

function EntrySlot({ entry, placement, props }: {
  readonly entry: ReactEntrySnapshot
  readonly placement: ReactEntrySlotRendererProps['placement']
  readonly props: ReactEntryRendererProps
}): ReactNode {
  const references = entry.slots?.[placement] ?? []
  if (references.length === 0) return null
  if (!props.registry) throw new Error(`[Holo Panels] A React component registry is required for entry ${placement} slots on "${entry.id}".`)
  return references.map(reference => {
    const Renderer = props.registry?.resolve<ReactEntrySlotRendererProps>(reference.component, props.panelId, `entry ${placement} slot on "${entry.id}"`)
    return Renderer ? createElement(Renderer, {
      ...reference.properties,
      entry,
      key: `${reference.source}:${reference.order}:${reference.component}`,
      placement,
      reference,
    }) : null
  })
}

function EntryContent(props: ReactEntryRendererProps & { readonly entry: ReactEntrySnapshot }): ReactNode {
  if (!props.entry.type.includes(':entry:')) return <BuiltInContent entry={props.entry} />
  if (!props.registry) throw new Error(`[Holo Panels] A React component registry is required for custom entry "${props.entry.type}".`)
  const Custom = props.registry.resolve<ReactCustomEntryProps>(
    entryRendererName(props.entry.type),
    props.panelId,
    `entry "${props.entry.id}"`,
  )
  return <Custom {...props} />
}

export function ReactEntryRenderer(props: ReactEntryRendererProps): ReactNode {
  const entry = useSyncExternalStore(
    listener => props.store.subscribe(listener),
    () => props.store.snapshot,
    () => props.store.snapshot,
  )
  const translate = usePanelTranslator()
  const [copyStatus, setCopyStatus] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const safeUrl = safeEntryUrl(entry.url)
  if (entry.visible === false) return null
  const labelId = `${entry.id}-label`
  const content = <EntryContent {...props} entry={entry} />
  const copy = async (): Promise<void> => {
    if (!globalThis.navigator?.clipboard) {
      setCopyStatus(translate('copy.unavailable'))
      return
    }
    try {
      await globalThis.navigator.clipboard.writeText(entryText(entry.formattedState))
      setCopyStatus(translate('copy.copied'))
    } catch {
      setCopyStatus(translate('copy.failed'))
    }
  }
  const runAction = async (id: string): Promise<void> => {
    if (!props.action) return
    setActionError(null)
    try {
      await props.action(id)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : translate('feedback.actionFailed'))
    }
  }
  const attributes = entryAttributes(entry)
  const actions = props.actionStore ? (props.actions ?? []).filter(action => entry.actions.includes(action.id)) : []
  return <section
    {...attributes}
    aria-labelledby={entry.label ? labelId : undefined}
    className={`hp-entry${entry.inlineLabel ? ' hp-entry-inline' : ''}${attributes.className ? ` ${attributes.className}` : ''}`}
    data-panels-entry={entry.id}
    style={entryLayout(entry)}
    title={entry.tooltip ?? undefined}
  >
    <EntrySlot entry={entry} placement="above" props={props} />
    {entry.label ? <h3 id={labelId}>{entry.label}</h3> : null}
    <EntrySlot entry={entry} placement="before" props={props} />
    <div className="hp-entry-state">{safeUrl
      ? <a href={safeUrl} rel={safeUrl.startsWith('/') ? undefined : 'noopener noreferrer'}>{content}</a>
      : content}</div>
    <EntrySlot entry={entry} placement="after" props={props} />
    {entry.copyable ? <Button onClick={() => void copy()} type="button">{translate('actions.copy')}</Button> : null}
    {props.actionStore ? null : entry.actions.map(action => <Button disabled={entry.pending || !props.action} key={action} onClick={() => void runAction(action)} type="button">{action}</Button>)}
    <span aria-live="polite" className="hp-visually-hidden">{copyStatus}</span>
    {entry.pending ? <span role="status">{translate('entries.loading')}</span> : null}
    {entry.error ? <span role="alert">{entry.error}</span> : null}
    {actionError ? <span role="alert">{actionError}</span> : null}
    <EntrySlot entry={entry} placement="below" props={props} />
    {props.actionStore && actions[0] ? <ReactActionRenderer actions={actions} manifest={actions[0]} panelId={props.panelId} recordIds={props.recordIds} registry={props.registry} store={props.actionStore} /> : null}
  </section>
}

export function registerReactEntryRenderer(
  registry: NonNullable<ReactEntryRendererProps['registry']>,
  type: string,
  component: ComponentType<ReactCustomEntryProps>,
): typeof registry {
  registry.register(entryRendererName(type), component, '@holo-js/panels-react')
  return registry
}
