import type { EntrySnapshot, SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-client'
import type { JsonObject, SchemaRenderSlots } from '@holo-js/panels-core'

export interface SchemaComponentExpectation {
  readonly extraAttributes?: JsonObject
  readonly kind?: SchemaComponentManifest['kind']
  readonly slots?: SchemaRenderSlots
  readonly statePath?: string
  readonly type?: string
  readonly visible?: boolean
}

export interface EntryPresentationExpectation {
  readonly extraAttributes?: JsonObject
  readonly layout?: EntrySnapshot['layout']
  readonly slots?: EntrySnapshot['slots']
  readonly visible?: boolean
}

export function schemaComponents<TValues>(schema: SchemaManifest<TValues>): readonly SchemaComponentManifest[] {
  const components: SchemaComponentManifest[] = []
  const visit = (component: SchemaComponentManifest): void => {
    components.push(component)
    component.children.forEach(visit)
  }
  schema.components.forEach(visit)
  return Object.freeze(components)
}

export function schemaComponent<TValues>(schema: SchemaManifest<TValues>, id: string): SchemaComponentManifest {
  const matches = schemaComponents(schema).filter(component => component.id === id)
  if (matches.length === 0) throw new Error(`[Holo Panels] Expected schema component "${id}" was not found.`)
  if (matches.length > 1) throw new Error(`[Holo Panels] Schema component ID "${id}" is ambiguous.`)
  return matches[0] as SchemaComponentManifest
}

function equalJson(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

export function assertSchemaComponent<TValues>(
  schema: SchemaManifest<TValues>,
  id: string,
  expectation: SchemaComponentExpectation,
): SchemaComponentManifest {
  const component = schemaComponent(schema, id)
  for (const [key, expected] of Object.entries(expectation)) {
    if (!equalJson(component[key as keyof SchemaComponentManifest], expected)) {
      throw new Error(`[Holo Panels] Schema component "${id}" has an unexpected ${key}.`)
    }
  }
  return component
}

export function assertEntryPresentation(
  entry: EntrySnapshot,
  expectation: EntryPresentationExpectation,
): EntrySnapshot {
  for (const [key, expected] of Object.entries(expectation)) {
    if (!equalJson(entry[key as keyof EntrySnapshot], expected)) {
      throw new Error(`[Holo Panels] Entry "${entry.id}" has an unexpected ${key}.`)
    }
  }
  return entry
}
