import { toJsonValue } from '../protocol/serialization'
import type { JsonObject } from '../protocol/json'
import { SCHEMA_BREAKPOINTS, type SchemaComponentKind, type SchemaComponentManifest, type SchemaManifest, type SchemaBreakpoint } from '../schemas/contracts'

function object(value: unknown): object | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function member(value: object | undefined, key: string): unknown {
  return value ? Reflect.get(value, key) : undefined
}

function objects(value: unknown): readonly object[] {
  return Array.isArray(value) ? value.filter((item): item is object => object(item) !== undefined) : []
}

function children(component: object): readonly object[] {
  return objects(member(object(member(component, 'server')), 'children') ?? member(component, 'children'))
}

async function resolveComponent(component: object, context: object): Promise<object> {
  const server = object(member(component, 'server'))
  const resolveChildren = member(server, 'resolveChildren')
  const resolvedChildren = typeof resolveChildren === 'function'
    ? objects(await Reflect.apply(resolveChildren, server, [context]))
    : children(component)
  const nextChildren = await Promise.all(resolvedChildren.map(child => resolveComponent(child, context)))
  return { ...component, server: { ...server, children: nextChildren } }
}

export async function resolveResourceForm(form: object | undefined, context: object): Promise<object | undefined> {
  if (!form) return undefined
  return { ...form, fields: await Promise.all(objects(member(form, 'fields')).map(component => resolveComponent(component, context))) }
}

export function resourceSchemaFields(form: object | undefined): readonly object[] {
  const visit = (components: readonly object[]): readonly object[] => components.flatMap(component => {
    if (typeof member(component, 'path') === 'string') return [component]
    return visit(children(component))
  })
  return visit(objects(member(form, 'fields')))
}

function responsive<TValue extends number | 'full'>(value: unknown): Partial<Record<SchemaBreakpoint, TValue>> | undefined {
  if (value === undefined || value === null) return undefined
  const entries = typeof value === 'object' ? Object.entries(value) : [['lg', value]]
  const result: Partial<Record<SchemaBreakpoint, TValue>> = {}
  for (const [breakpoint, item] of entries) {
    if (!SCHEMA_BREAKPOINTS.includes(breakpoint as SchemaBreakpoint) || item !== 'full' && !Number.isSafeInteger(item)) throw new Error('[Holo Panels] Invalid responsive schema value.')
    result[breakpoint as SchemaBreakpoint] = item as TValue
  }
  return result
}

function jsonObject(value: unknown): JsonObject {
  const result = toJsonValue(value ?? {})
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('[Holo Panels] Schema attributes must be an object.')
  return result
}

function defined<TValue extends object>(value: TValue): TValue {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as TValue
}

const layoutKinds = new Set<SchemaComponentKind>(['callout', 'empty-state', 'fieldset', 'grid', 'group', 'section', 'split', 'step', 'tab', 'tabs', 'wizard'])

function schemaComponent(component: object, id: string): SchemaComponentManifest {
  const path = member(component, 'path')
  const sourceKind = member(component, 'kind')
  const kind = typeof path === 'string' ? 'field' : sourceKind === 'wizard-step' ? 'step' : sourceKind === 'flex' ? 'split' : sourceKind
  if (kind !== 'field' && !layoutKinds.has(kind as SchemaComponentKind)) throw new Error('[Holo Panels] Unknown form layout.')
  const text = (key: string): string | undefined => typeof member(component, key) === 'string' ? String(member(component, key)) : undefined
  return {
    children: children(component).map((child, index) => schemaComponent(child, `${id}.${index}`)),
    dynamicVisibility: false,
    extraAttributes: jsonObject(member(component, 'extraAttributes')),
    id,
    key: id,
    kind: kind as SchemaComponentKind,
    layout: defined({
      columns: responsive<number>(member(component, 'columns')),
      columnSpan: responsive<number | 'full'>(member(component, 'columnSpan')),
      columnStart: responsive<number>(member(component, 'columnStart')),
      order: responsive<number>(member(component, 'columnOrder')),
    }),
    properties: defined({
      heading: text('heading'),
      description: text('description'),
      label: text('label'),
      icon: text('icon'),
      color: text('color'),
      compact: member(component, 'compact') === true,
      contained: member(component, 'contained') !== false,
      grow: member(component, 'grow') !== false,
      collapse: { collapsed: member(component, 'collapsed') === true, collapsible: member(component, 'collapsible') === true },
      ...(text('from') ? { splitFrom: text('from') as SchemaBreakpoint } : {}),
    }),
    slots: {},
    ...(typeof path === 'string' ? { statePath: path } : {}),
    type: String(kind),
    visible: member(component, 'hidden') !== true && member(component, 'visible') !== false,
  }
}

export function resourceFormSchema(form: object | undefined, id: string): SchemaManifest {
  return {
    components: [schemaComponent({ kind: 'grid', columns: member(form, 'columns') ?? { default: 1 }, children: objects(member(form, 'fields')) }, `${id}.layout`)],
    id,
    kind: 'schema',
  }
}
