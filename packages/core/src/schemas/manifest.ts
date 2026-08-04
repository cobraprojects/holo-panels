import { toJsonValue } from '../protocol/serialization'
import type { CompiledSchema, CompiledSchemaComponent, SchemaComponentManifest, SchemaManifest } from './contracts'

function freezeValue<TValue>(value: TValue): TValue {
  const visited = new WeakSet<object>()
  const freeze = (current: object): void => {
    if (visited.has(current)) return
    visited.add(current)
    for (const child of Reflect.ownKeys(current).map(key => Reflect.get(current, key))) {
      if (typeof child === 'object' && child !== null) freeze(child)
    }
    Object.freeze(current)
  }
  if (typeof value === 'object' && value !== null) freeze(value)
  return value
}

async function projectComponent<TContext>(
  component: CompiledSchemaComponent<TContext>,
  context: TContext,
): Promise<SchemaComponentManifest> {
  const visible = component.server.visibility
    ? await component.server.visibility(context)
    : component.visible
  const manifest: SchemaComponentManifest = {
    children: await Promise.all(component.children.map(child => projectComponent(child, context))),
    dynamicVisibility: component.dynamicVisibility,
    extraAttributes: component.extraAttributes,
    id: component.id,
    key: component.key,
    kind: component.kind,
    layout: component.layout,
    properties: component.properties,
    slots: component.slots,
    ...(component.statePath ? { statePath: component.statePath } : {}),
    type: component.type,
    visible,
  }
  toJsonValue(manifest)
  return freezeValue(manifest)
}

export async function toSchemaManifest<TValues, TContext>(
  schema: CompiledSchema<TValues, TContext>,
  context: TContext,
): Promise<SchemaManifest<TValues>> {
  const manifest: SchemaManifest<TValues> = {
    components: await Promise.all(schema.components.map(component => projectComponent(component, context))),
    id: schema.id,
    kind: 'schema',
    ...(schema.statePath ? { statePath: schema.statePath } : {}),
  }
  toJsonValue(manifest)
  return freezeValue(manifest)
}
