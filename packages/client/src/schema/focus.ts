import { traverseSchemaManifest, type SchemaManifest } from '@holo-js/panels-core'
import type { FormFocusMetadata } from '../forms/types'

function withoutArrayIndexes(path: string): string {
  return path.split('.').filter(segment => !/^\d+$/.test(segment)).join('.')
}

export class SchemaFocusIndex<TValues> {
  readonly #componentIdByPath = new Map<string, string>()
  readonly #orderedPaths: readonly string[]

  constructor(schema?: SchemaManifest<TValues>) {
    const orderedPaths: string[] = []
    if (schema) {
      traverseSchemaManifest(schema, (component) => {
        if (!component.statePath || this.#componentIdByPath.has(component.statePath)) return
        this.#componentIdByPath.set(component.statePath, component.id)
        orderedPaths.push(component.statePath)
      })
    }
    this.#orderedPaths = Object.freeze(orderedPaths)
  }

  firstError(
    errors: Readonly<Record<string, readonly string[]>>,
    requestVersion?: number,
  ): FormFocusMetadata | undefined {
    const errorPaths = Object.keys(errors).filter(path => (errors[path]?.length ?? 0) > 0)
    if (errorPaths.length === 0) return undefined
    const orderedError = this.#orderedPaths
      .map(schemaPath => errorPaths.find(path => withoutArrayIndexes(path) === withoutArrayIndexes(schemaPath)))
      .find((path): path is string => typeof path === 'string')
    const path = orderedError ?? errorPaths.sort()[0]!
    const normalizedPath = withoutArrayIndexes(path)
    const componentEntry = [...this.#componentIdByPath.entries()]
      .find(([schemaPath]) => withoutArrayIndexes(schemaPath) === normalizedPath)
    return Object.freeze({
      path,
      ...(componentEntry ? { componentId: componentEntry[1] } : {}),
      ...(typeof requestVersion === 'number' ? { requestVersion } : {}),
    })
  }
}
