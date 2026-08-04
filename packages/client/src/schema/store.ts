import {
  applySchemaManifestPatches,
  type SchemaManifest,
  type TargetedSchemaPatch,
} from '@holo-js/panels-core'

export type SchemaStateListener<TValues> = (
  schema: SchemaManifest<TValues>,
  previous: SchemaManifest<TValues>,
) => void

export class SchemaStateStore<TValues> {
  #schema: SchemaManifest<TValues>
  readonly #listeners = new Set<SchemaStateListener<TValues>>()

  constructor(schema: SchemaManifest<TValues>) {
    this.#schema = schema
  }

  get schema(): SchemaManifest<TValues> {
    return this.#schema
  }

  subscribe(listener: SchemaStateListener<TValues>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  patch(patches: readonly TargetedSchemaPatch[]): SchemaManifest<TValues> {
    if (patches.length === 0) return this.#schema
    const previous = this.#schema
    const next = applySchemaManifestPatches(previous, patches)
    if (next === previous) return previous
    this.#schema = next
    for (const listener of this.#listeners) listener(next, previous)
    return next
  }
}
