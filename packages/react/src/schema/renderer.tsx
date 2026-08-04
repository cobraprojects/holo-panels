import {
  Fragment,
  createElement,
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ComponentType,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { JsonObject, SchemaComponentManifest } from '@holo-js/panels-client'
import type { ComponentRegistry } from '../registry'
import type {
  ReactSchemaCustomRendererProps,
  ReactSchemaRendererProps,
  ReactSchemaSlotRendererProps,
} from './types'

type SchemaBreakpoint = keyof NonNullable<SchemaComponentManifest['layout']['columns']>

const breakpoints: readonly SchemaBreakpoint[] = ['default', 'sm', 'md', 'lg', 'xl', '2xl']

type LayoutStyle = CSSProperties & Readonly<Record<`--hp-schema-${string}`, string | number | undefined>>

function classes(...values: readonly (string | null | undefined | false)[]): string {
  return values.filter(Boolean).join(' ')
}

function safeAttributes(attributes: JsonObject): HTMLAttributes<HTMLElement> {
  const safe: Record<string, string | number | boolean> = {}
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'className' && typeof value === 'string') safe.className = value
    else if (name === 'hidden' && typeof value === 'boolean') safe.hidden = value
    else if (name === 'dir' && (value === 'ltr' || value === 'rtl' || value === 'auto')) safe.dir = value
    else if ((name === 'lang' || name === 'title') && typeof value === 'string') safe[name] = value
    else if ((name.startsWith('aria-') || name.startsWith('data-')) && ['boolean', 'number', 'string'].includes(typeof value)) {
      safe[name] = value as boolean | number | string
    }
  }
  return safe as HTMLAttributes<HTMLElement>
}

function layoutStyle(component: SchemaComponentManifest): LayoutStyle {
  const style: Record<string, string | number | undefined> = {}
  for (const breakpoint of breakpoints) {
    const suffix = breakpoint === 'default' ? 'default' : breakpoint
    const span = component.layout.columnSpan?.[breakpoint]
    style[`--hp-schema-columns-${suffix}`] = component.layout.columns?.[breakpoint]
    style[`--hp-schema-column-start-${suffix}`] = span === 'full' ? 1 : component.layout.columnStart?.[breakpoint]
    style[`--hp-schema-column-end-${suffix}`] = span === 'full' ? -1 : typeof span === 'number' ? `span ${span}` : undefined
    style[`--hp-schema-order-${suffix}`] = component.layout.order?.[breakpoint]
  }
  return style as LayoutStyle
}

function storageKey(kind: string, key: string): string {
  return `holo-panels:${kind}:${key}`
}

function usePersistentIndex(key: string | undefined, initial: number, maximum: number): readonly [number, (value: number) => void] {
  const [selected, setSelected] = useState(initial)
  useEffect(() => {
    if (!key) return
    try {
      const stored = Number.parseInt(window.localStorage.getItem(key) ?? '', 10)
      if (Number.isInteger(stored) && stored >= 0 && stored < maximum) setSelected(stored)
    } catch {
      return
    }
  }, [key, maximum])
  const select = (value: number): void => {
    setSelected(value)
    if (!key) return
    try {
      window.localStorage.setItem(key, String(value))
    } catch {
      return
    }
  }
  return [Math.min(selected, Math.max(0, maximum - 1)), select]
}

function usePersistentOpen(key: string | undefined, initial: boolean): readonly [boolean, (value: boolean) => void] {
  const [open, setOpen] = useState(initial)
  useEffect(() => {
    if (!key) return
    try {
      const stored = window.localStorage.getItem(key)
      if (stored === 'true' || stored === 'false') setOpen(stored === 'true')
    } catch {
      return
    }
  }, [key])
  const update = (value: boolean): void => {
    setOpen(value)
    if (!key) return
    try {
      window.localStorage.setItem(key, String(value))
    } catch {
      return
    }
  }
  return [open, update]
}

function description(component: SchemaComponentManifest): ReactNode {
  return component.properties.description
    ? <p className="hp-schema-description">{component.properties.description}</p>
    : null
}

function icon(component: SchemaComponentManifest): ReactNode {
  return component.properties.icon
    ? <span aria-hidden="true" className="hp-schema-icon" data-icon={component.properties.icon} />
    : null
}

function Collapsible({ children, component, label }: {
  readonly children: ReactNode
  readonly component: SchemaComponentManifest
  readonly label: string
}): ReactNode {
  const collapse = component.properties.collapse
  const key = collapse?.persistenceKey ? storageKey('collapse', collapse.persistenceKey) : undefined
  const [open, setOpen] = usePersistentOpen(key, !(collapse?.collapsed ?? false))
  if (!collapse?.collapsible) return children
  return <details onToggle={event => setOpen(event.currentTarget.open)} open={open}>
    <summary>{label}</summary>
    {children}
  </details>
}

interface ComponentRendererProps<TValues extends object = Record<string, unknown>> extends Omit<ReactSchemaRendererProps<TValues>, 'schema'> {
  readonly component: SchemaComponentManifest
  readonly schema: ReactSchemaRendererProps<TValues>['schema']
}

function TabsRenderer<TValues extends object>({ component, ...props }: ComponentRendererProps<TValues>): ReactNode {
  const children = component.children.filter(child => child.visible)
  const persistence = component.properties.persistenceKey
  const [selected, select] = usePersistentIndex(persistence ? storageKey('tabs', persistence) : undefined, 0, children.length)
  const instanceId = useId().replaceAll(':', '')
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || children.length === 0) return
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? children.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + children.length) % children.length
    event.preventDefault()
    select(next)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return <div className="hp-schema-tabs">
    <div aria-label={component.properties.label ?? component.properties.heading ?? 'Tabs'} role="tablist">
      {children.map((child, index) => <button
        aria-controls={`${instanceId}-${child.id}-panel`}
        aria-selected={index === selected}
        id={`${instanceId}-${child.id}-tab`}
        key={child.key}
        onClick={() => select(index)}
        onKeyDown={event => onKeyDown(event, index)}
        role="tab"
        tabIndex={index === selected ? 0 : -1}
        type="button"
      >{child.properties.label ?? `Tab ${index + 1}`}</button>)}
    </div>
    {children.map((child, index) => <div
      aria-labelledby={`${instanceId}-${child.id}-tab`}
      hidden={index !== selected}
      id={`${instanceId}-${child.id}-panel`}
      key={child.key}
      role="tabpanel"
    >{index === selected ? <ComponentRenderer component={child} {...props} /> : null}</div>)}
  </div>
}

function WizardRenderer<TValues extends object>({ component, ...props }: ComponentRendererProps<TValues>): ReactNode {
  const children = component.children.filter(child => child.visible)
  const persistence = component.properties.persistenceKey
  const [selected, select] = usePersistentIndex(persistence ? storageKey('wizard', persistence) : undefined, 0, children.length)
  const active = children[selected]
  return <div className="hp-schema-wizard">
    <nav aria-label={component.properties.label ?? component.properties.heading ?? 'Wizard progress'}>
      <ol>{children.map((child, index) => <li aria-current={index === selected ? 'step' : undefined} key={child.key}>
        <button onClick={() => select(index)} type="button">{child.properties.label ?? `Step ${index + 1}`}</button>
      </li>)}</ol>
    </nav>
    {active ? <ComponentRenderer component={active} {...props} /> : null}
    {children.length > 1 ? <div className="hp-schema-wizard-navigation">
      <button disabled={selected === 0} onClick={() => select(selected - 1)} type="button">Previous</button>
      <button disabled={selected === children.length - 1} onClick={() => select(selected + 1)} type="button">Next</button>
    </div> : null}
  </div>
}

function CustomRenderer<TValues extends object>({ component, registry, panelId, children }: ComponentRendererProps<TValues> & { readonly children: ReactNode }): ReactNode {
  const type = component.properties.customType ?? component.type
  const name = schemaRendererName(type)
  const Renderer = registry.resolve<ReactSchemaCustomRendererProps>(name, panelId, `schema component "${component.id}"`)
  return createElement(Renderer, { children, component, properties: component.properties.customProperties ?? {} })
}

function slot(component: SchemaComponentManifest, placement: keyof SchemaComponentManifest['slots'], registry: ComponentRegistry, panelId: string): ReactNode {
  const references = component.slots[placement] ?? []
  return references.map((reference) => {
    const Renderer = registry.resolve<ReactSchemaSlotRendererProps>(reference.component, panelId, `schema ${placement} slot on "${component.id}"`)
    return createElement(Renderer, { ...reference.properties, component, key: `${reference.source}:${reference.order}:${reference.component}`, placement, reference })
  })
}

function semanticContent<TValues extends object>(component: SchemaComponentManifest, content: ReactNode, props: ComponentRendererProps<TValues>, attributes: HTMLAttributes<HTMLElement>): ReactNode {
  const heading = component.properties.heading
  const body = <Fragment>{heading ? <h2>{icon(component)}{heading}</h2> : null}{description(component)}{content}</Fragment>
  if (component.kind === 'grid') return <div {...attributes} className={classes('hp-schema-node hp-schema-grid', attributes.className)} style={layoutStyle(component)}>{content}</div>
  if (component.kind === 'section') return <section {...attributes} className={classes('hp-schema-node hp-schema-section', attributes.className)} style={layoutStyle(component)}><Collapsible component={component} label={heading ?? 'Section'}>{body}</Collapsible></section>
  if (component.kind === 'group') return <div {...attributes} className={classes('hp-schema-node hp-schema-group', attributes.className)} style={layoutStyle(component)}><Collapsible component={component} label={component.properties.label ?? heading ?? 'Group'}>{body}</Collapsible></div>
  if (component.kind === 'fieldset') return <fieldset {...attributes} className={classes('hp-schema-node hp-schema-fieldset', attributes.className)} style={layoutStyle(component)}><legend>{component.properties.label ?? heading ?? 'Fields'}</legend><Collapsible component={component} label={component.properties.label ?? heading ?? 'Fields'}>{description(component)}{content}</Collapsible></fieldset>
  if (component.kind === 'tabs') return <div {...attributes} className={classes('hp-schema-node', attributes.className)} style={layoutStyle(component)}><TabsRenderer {...props} /></div>
  if (component.kind === 'wizard') return <div {...attributes} className={classes('hp-schema-node', attributes.className)} style={layoutStyle(component)}><WizardRenderer {...props} /></div>
  if (component.kind === 'split') return <div {...attributes} className={classes('hp-schema-node hp-schema-split', attributes.className)} data-split-from={component.properties.splitFrom ?? 'default'} style={layoutStyle(component)}>{content}</div>
  if (component.kind === 'callout') return <aside {...attributes} className={classes('hp-schema-node hp-schema-callout', attributes.className)} data-color={component.properties.color ?? undefined} role="note" style={layoutStyle(component)}>{body}</aside>
  if (component.kind === 'empty-state') return <section {...attributes} aria-label={heading ?? 'Empty state'} className={classes('hp-schema-node hp-schema-empty-state', attributes.className)} style={layoutStyle(component)}>{body}</section>
  if (component.kind === 'entry' || component.kind === 'filter' || component.kind === 'widget') {
    return <div {...attributes} className={classes(`hp-schema-node hp-schema-${component.kind}`, attributes.className)} data-schema-leaf={component.kind} style={layoutStyle(component)}>{content}</div>
  }
  if (component.kind === 'tab' || component.kind === 'step') return <div {...attributes} className={classes(`hp-schema-node hp-schema-${component.kind}`, attributes.className)} style={layoutStyle(component)}>{description(component)}{content}</div>
  return <div {...attributes} className={classes('hp-schema-node hp-schema-custom', attributes.className)} style={layoutStyle(component)}><CustomRenderer {...props}>{content}</CustomRenderer></div>
}

function ComponentRenderer<TValues extends object>({ component, panelId, registry, renderContent, schema }: ComponentRendererProps<TValues>): ReactNode {
  if (!component.visible) return null
  const attributes = safeAttributes(component.extraAttributes)
  const children = <Fragment>
    {slot(component, 'before', registry, panelId)}
    {renderContent?.({ component, panelId, schema })}
    {component.children.map(child => <ComponentRenderer component={child} key={child.key} panelId={panelId} registry={registry} renderContent={renderContent} schema={schema} />)}
    {slot(component, 'after', registry, panelId)}
  </Fragment>
  return <Fragment>
    {slot(component, 'above', registry, panelId)}
    {semanticContent(component, children, { component, panelId, registry, renderContent, schema }, attributes)}
    {slot(component, 'below', registry, panelId)}
  </Fragment>
}

export function schemaRendererName(type: string): string {
  return `schema.${type.replaceAll(':', '.').replaceAll('_', '-')}`
}

export function registerReactSchemaRenderer(registry: ComponentRegistry, type: string, renderer: ComponentType<ReactSchemaCustomRendererProps>, source = 'application'): ComponentRegistry {
  return registry.register(schemaRendererName(type), renderer, source)
}

export function ReactSchemaRenderer<TValues extends object = Record<string, unknown>>({ panelId, registry, renderContent, schema }: ReactSchemaRendererProps<TValues>): ReactNode {
  return <div className="hp-schema" data-schema-id={schema.id} data-state-path={schema.statePath}>
    {schema.components.map(component => <ComponentRenderer component={component} key={component.key} panelId={panelId} registry={registry} renderContent={renderContent} schema={schema} />)}
  </div>
}
