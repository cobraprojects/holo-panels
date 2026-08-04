import { toJsonValue } from '../protocol/serialization'
import { appendScopedRenderSlot } from '../panels/render-slots'
import type {
  CompiledSchema,
  CompiledSchemaComponent,
  SchemaComponentPatch,
  SchemaComponentManifest,
  SchemaManifest,
  SchemaRenderSlots,
  TargetedSchemaPatch,
} from './contracts'

export interface SchemaTraversalContext<TContext> {
  readonly depth: number
  readonly parent?: CompiledSchemaComponent<TContext>
  readonly index: number
}

function assertPatchObject(value: unknown, name: string): void {
  const normalized = toJsonValue(value)
  if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized)) {
    throw new Error(`${name} must be a JSON-safe object`)
  }
}

function normalizeSlotPatch(slots: SchemaRenderSlots): SchemaRenderSlots {
  let normalized: SchemaRenderSlots = {}
  const slotNames = ['above', 'after', 'before', 'below'] as const
  for (const slot of slotNames) {
    const references = slots[slot]
    if (references === undefined) continue
    if (!Array.isArray(references)) throw new TypeError('Schema slot patches require ordered reference arrays')
    for (const reference of references) {
      normalized = appendScopedRenderSlot(normalized, slot, reference, reference.source)
    }
  }
  return normalized
}

function freezeValue<TValue>(value: TValue): TValue {
  const freeze = (current: object, visited: WeakSet<object>): void => {
    if (visited.has(current)) return
    visited.add(current)
    for (const child of Reflect.ownKeys(current).map(key => Reflect.get(current, key))) {
      if ((typeof child === 'object' && child !== null) || typeof child === 'function') freeze(child, visited)
    }
    Object.freeze(current)
  }
  if ((typeof value === 'object' && value !== null) || typeof value === 'function') freeze(value, new WeakSet())
  return value
}

export function traverseSchema<TValues, TContext>(
  schema: CompiledSchema<TValues, TContext>,
  visitor: (
    component: CompiledSchemaComponent<TContext>,
    context: SchemaTraversalContext<TContext>,
  ) => void,
): void {
  const visit = (
    components: readonly CompiledSchemaComponent<TContext>[],
    depth: number,
    parent?: CompiledSchemaComponent<TContext>,
  ): void => {
    components.forEach((component, index) => {
      visitor(component, {
        depth,
        ...(parent ? { parent } : {}),
        index,
      })
      visit(component.children, depth + 1, component)
    })
  }
  visit(schema.components, 0)
}

export function findSchemaComponent<TValues, TContext>(
  schema: CompiledSchema<TValues, TContext>,
  id: string,
): CompiledSchemaComponent<TContext> | undefined {
  let found: CompiledSchemaComponent<TContext> | undefined
  traverseSchema(schema, (component) => {
    if (!found && component.id === id) found = component
  })
  return found
}

export function traverseSchemaManifest<TValues>(
  schema: SchemaManifest<TValues>,
  visitor: (component: SchemaComponentManifest, context: Readonly<{ depth: number, index: number, parent?: SchemaComponentManifest }>) => void,
): void {
  const visit = (components: readonly SchemaComponentManifest[], depth: number, parent?: SchemaComponentManifest): void => {
    components.forEach((component, index) => {
      visitor(component, { depth, index, ...(parent ? { parent } : {}) })
      visit(component.children, depth + 1, component)
    })
  }
  visit(schema.components, 0)
}

function patchComponent<TContext>(
  component: CompiledSchemaComponent<TContext>,
  changes: SchemaComponentPatch,
): CompiledSchemaComponent<TContext> {
  if (changes.layout) assertPatchObject(changes.layout, 'Schema layout patch')
  if (changes.extraAttributes) assertPatchObject(changes.extraAttributes, 'Schema attribute patch')
  if (changes.properties) assertPatchObject(changes.properties, 'Schema property patch')
  const slots = changes.slots ? normalizeSlotPatch(changes.slots) : undefined
  const visible = changes.visible
  return {
    ...component,
    ...(typeof visible === 'boolean' ? { visible, dynamicVisibility: false, server: {} } : {}),
    ...(changes.layout ? { layout: { ...component.layout, ...changes.layout } } : {}),
    ...(changes.extraAttributes ? { extraAttributes: { ...component.extraAttributes, ...changes.extraAttributes } } : {}),
    ...(slots ? { slots: { ...component.slots, ...slots } } : {}),
    ...(changes.properties ? { properties: { ...component.properties, ...changes.properties } } : {}),
  }
}

export function applySchemaNodePatches<TValues, TContext>(
  schema: CompiledSchema<TValues, TContext>,
  patches: readonly TargetedSchemaPatch[],
): CompiledSchema<TValues, TContext> {
  const patchById = new Map<string, SchemaComponentPatch>()
  for (const patch of patches) {
    if (patchById.has(patch.id)) throw new Error(`Duplicate schema patch target: ${patch.id}`)
    patchById.set(patch.id, patch.changes)
  }

  const found = new Set<string>()
  const visit = (component: CompiledSchemaComponent<TContext>): CompiledSchemaComponent<TContext> => {
    const children = component.children.map(visit)
    const changes = patchById.get(component.id)
    if (changes) found.add(component.id)
    if (!changes && children.every((child, index) => child === component.children[index])) return component
    const withChildren = children.every((child, index) => child === component.children[index])
      ? component
      : { ...component, children }
    return changes ? patchComponent(withChildren, changes) : withChildren
  }
  const components = schema.components.map(visit)
  const missing = [...patchById.keys()].filter(id => !found.has(id))
  if (missing.length > 0) throw new Error(`Schema patch target not found: ${missing.join(', ')}`)
  if (components.every((component, index) => component === schema.components[index])) return schema
  return freezeValue({ ...schema, components })
}

export function patchSchemaNode<TValues, TContext>(
  schema: CompiledSchema<TValues, TContext>,
  id: string,
  changes: SchemaComponentPatch,
): CompiledSchema<TValues, TContext> {
  return applySchemaNodePatches(schema, [{ id, changes }])
}

function patchManifestComponent(
  component: SchemaComponentManifest,
  changes: SchemaComponentPatch,
): SchemaComponentManifest {
  if (changes.layout) assertPatchObject(changes.layout, 'Schema layout patch')
  if (changes.extraAttributes) assertPatchObject(changes.extraAttributes, 'Schema attribute patch')
  if (changes.properties) assertPatchObject(changes.properties, 'Schema property patch')
  const slots = changes.slots ? normalizeSlotPatch(changes.slots) : undefined
  return {
    ...component,
    ...(typeof changes.visible === 'boolean' ? { visible: changes.visible } : {}),
    ...(changes.layout ? { layout: { ...component.layout, ...changes.layout } } : {}),
    ...(changes.extraAttributes ? { extraAttributes: { ...component.extraAttributes, ...changes.extraAttributes } } : {}),
    ...(slots ? { slots: { ...component.slots, ...slots } } : {}),
    ...(changes.properties ? { properties: { ...component.properties, ...changes.properties } } : {}),
  }
}

export function applySchemaManifestPatches<TValues>(
  schema: SchemaManifest<TValues>,
  patches: readonly TargetedSchemaPatch[],
): SchemaManifest<TValues> {
  const patchById = new Map<string, SchemaComponentPatch>()
  for (const patch of patches) {
    if (patchById.has(patch.id)) throw new Error(`Duplicate schema patch target: ${patch.id}`)
    patchById.set(patch.id, patch.changes)
  }
  const found = new Set<string>()
  const visit = (component: SchemaComponentManifest): SchemaComponentManifest => {
    const children = component.children.map(visit)
    const changes = patchById.get(component.id)
    if (changes) found.add(component.id)
    if (!changes && children.every((child, index) => child === component.children[index])) return component
    const withChildren = children.every((child, index) => child === component.children[index]) ? component : { ...component, children }
    return changes ? patchManifestComponent(withChildren, changes) : withChildren
  }
  const components = schema.components.map(visit)
  const missing = [...patchById.keys()].filter(id => !found.has(id))
  if (missing.length > 0) throw new Error(`Schema patch target not found: ${missing.join(', ')}`)
  if (components.every((component, index) => component === schema.components[index])) return schema
  return freezeValue({ ...schema, components })
}

export function patchSchemaManifestNode<TValues>(
  schema: SchemaManifest<TValues>,
  id: string,
  changes: SchemaComponentPatch,
): SchemaManifest<TValues> {
  return applySchemaManifestPatches(schema, [{ changes, id }])
}

export async function evaluateSchemaVisibility<TContext>(
  component: CompiledSchemaComponent<TContext>,
  context: TContext,
): Promise<boolean> {
  return component.server.visibility
    ? await component.server.visibility(context)
    : component.visible
}
