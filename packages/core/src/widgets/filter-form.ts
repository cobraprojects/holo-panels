import { formValidationFields, validateFormFields } from '../fields/validation'
import { toJsonValue } from '../protocol/serialization'
import type { JsonObject, JsonValue } from '../protocol/json'
import { resolveResourceForm, resourceSchemaFields } from '../resources/form-schema'
import { resolveFieldProperty } from '../fields/base/runtime'

export interface DashboardFilterSchema {
  readonly fields?: readonly object[]
  readonly components?: readonly object[]
}

export function dashboardFilterManifest(schema: DashboardFilterSchema): JsonObject {
  const project = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(project)
    if (!value || typeof value !== 'object') return value
    const server = Reflect.get(value, 'server')
    const children = server && typeof server === 'object' ? Reflect.get(server, 'children') : undefined
    return Object.fromEntries(Object.entries({ ...value, ...(Array.isArray(children) ? { children } : {}) }).filter(([key]) => key !== 'server').map(([key, child]) => [key, project(child)]))
  }
  const manifest = toJsonValue(project(schema))
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Dashboard filters require a compiled form schema')
  return manifest
}

export async function resolveDashboardFilterForm(schema: DashboardFilterSchema | null | undefined, input: JsonObject = {}): Promise<{ schema: JsonObject, values: JsonObject } | null> {
  if (!schema) return null
  const values = structuredClone(input)
  const source = { ...schema, fields: schema.fields ?? schema.components ?? [] }
  const knownFields = new Map(resourceSchemaFields(source).map(field => [String(Reflect.get(field, 'path')), field]))
  const resolvedFields = new Map<string, object>()
  const resolving = new Set<string>()
  const context = {
    operation: 'filter' as const,
    record: null,
    get: (path: string): JsonValue => {
      if (!knownFields.has(path)) return null
      if (!resolvedFields.has(path)) throw new Error('Dashboard field callbacks must declare forward dependencies')
      return readPath(values, path) ?? null
    },
    set: (path: string, value: JsonValue): void => setPath(values, path, value),
  }
  const visit = async (node: object): Promise<object> => {
    const server = Reflect.get(node, 'server')
    const children = server && typeof server === 'object' ? Reflect.get(server, 'children') : Reflect.get(node, 'children')
    const path = Reflect.get(node, 'path')
    if (typeof path !== 'string') return { ...node, ...(Array.isArray(children) ? { children: await visitNodes(children), server: undefined } : {}) }
    const existing = resolvedFields.get(path)
    if (existing) return existing
    const scope = { ...context, path, values, value: readPath(values, path) ?? null }
    const resolvedField: Record<string, unknown> = { visible: Reflect.get(node, 'hidden') !== true, ...node }
    for (const key of ['defaultValue', 'visible', 'disabled', 'readOnly', 'label', 'helperText', 'hint', 'placeholder']) {
      const callback = server && typeof server === 'object' ? Reflect.get(server, key) : undefined
      resolvedField[key] = await resolveFieldProperty(resolvedField[key] ?? null, typeof callback === 'function' ? (context: typeof scope): unknown => Reflect.apply(callback, server, [context]) : undefined, scope)
      if (key === 'defaultValue' && readPath(values, path) === undefined) setPath(values, path, toJsonValue(resolvedField[key] ?? ''))
    }
    const protectedField = resolvedField.disabled === true || resolvedField.readOnly === true || resolvedField.visible === false
    scope.value = protectedField ? toJsonValue(resolvedField.defaultValue ?? '') : readPath(values, path) ?? toJsonValue(resolvedField.defaultValue ?? '')
    const hydrate = server && typeof server === 'object' ? Reflect.get(server, 'hydrate') : undefined
    if (!protectedField && typeof hydrate === 'function') scope.value = toJsonValue(await Reflect.apply(hydrate, server, [scope]))
    setPath(values, path, scope.value)
    const result = { ...resolvedField, server: undefined }
    resolvedFields.set(path, result)
    return result
  }
  const resolveDependency = async (path: string): Promise<void> => {
    if (resolvedFields.has(path)) return
    const field = knownFields.get(path)
    if (!field || resolving.has(path)) throw new Error('Invalid dashboard field dependency')
    resolving.add(path)
    const dependencies = Reflect.get(field, 'dependencies')
    if (Array.isArray(dependencies)) for (const dependency of dependencies) {
      if (typeof dependency !== 'string') throw new Error('Invalid dashboard field dependency')
      await resolveDependency(dependency)
    }
    await visit(field)
    resolving.delete(path)
  }
  const visitNodes = async (nodes: readonly object[]): Promise<object[]> => {
    const result: object[] = []
    for (const node of nodes) result.push(await visit(node))
    return result
  }
  for (const path of knownFields.keys()) await resolveDependency(path)
  const resolved = await resolveResourceForm(source, context)
  for (const field of resourceSchemaFields(resolved)) knownFields.set(String(Reflect.get(field, 'path')), field)
  for (const path of knownFields.keys()) await resolveDependency(path)
  const fields = resolved ? Reflect.get(resolved, 'fields') : []
  const manifest = dashboardFilterManifest({ ...Object.fromEntries(Object.entries(schema).filter(([key]) => key !== 'components')), fields: await visitNodes(Array.isArray(fields) ? fields : []) })
  return { schema: manifest, values: await resolveDashboardFilters(manifest, values, false) }
}

function fieldDefaults(value: JsonValue): ReadonlyMap<string, JsonValue> {
  const defaults = new Map<string, JsonValue>()
  const visit = (node: JsonValue): void => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!node || typeof node !== 'object') return
    if (typeof node.path === 'string' && typeof node.type === 'string') defaults.set(node.path, node.defaultValue ?? '')
    Object.values(node).forEach(visit)
  }
  visit(value)
  return defaults
}

function pathParts(path: string): readonly string[] {
  const parts = path.split('.')
  if (parts.some(part => !/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(part) || ['__proto__', 'constructor', 'prototype'].includes(part))) throw new Error('Invalid dashboard filter path')
  return parts
}

function readPath(values: JsonObject, path: string): JsonValue | undefined {
  let value: JsonValue | undefined = values
  for (const key of pathParts(path)) value = value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, key) ? value[key] : undefined
  return value
}

function setPath(values: JsonObject, path: string, value: JsonValue): void {
  const parts = pathParts(path)
  let target = values
  for (const key of parts.slice(0, -1)) {
    const current = target[key]
    if (current === undefined) target[key] = {}
    const child = target[key]
    if (!child || typeof child !== 'object' || Array.isArray(child)) throw new Error('Dashboard filter paths overlap')
    target = child
  }
  target[parts.at(-1)!] = value
}

export async function resolveDashboardFilters(schema: JsonObject | null, input: JsonObject = {}, validate = true, locale = 'en'): Promise<JsonObject> {
  if (!schema) {
    if (Object.keys(input).length > 0) throw new Error('The dashboard has no filter form')
    return {}
  }
  const fields = formValidationFields(schema)
  const defaults = fieldDefaults(schema)
  const result: JsonObject = {}
  const allowed = new Set(fields.map(field => field.path))
  const check = (value: JsonObject, prefix = ''): void => {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (allowed.has(path)) continue
      if (child && typeof child === 'object' && !Array.isArray(child) && fields.some(field => field.path.startsWith(`${path}.`))) check(child, path)
      else throw new Error('Unknown dashboard filter')
    }
  }
  check(input)
  for (const field of fields) {
    const value = field.disabled || field.readOnly || field.visible === false ? undefined : readPath(input, field.path)
    setPath(result, field.path, value ?? defaults.get(field.path) ?? '')
  }
  const errors = validate ? await validateFormFields(fields, result, locale) : {}
  if (Object.keys(errors).length > 0) throw new DashboardFilterValidationError(errors)
  return result
}

export class DashboardFilterValidationError extends Error {
  constructor(readonly errors: Readonly<Record<string, readonly string[]>>) {
    super('Dashboard filters are invalid')
    this.name = 'DashboardFilterValidationError'
  }
}
