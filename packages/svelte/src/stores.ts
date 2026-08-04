import { readable, type Readable } from 'svelte/store'

export interface PanelsStateSource<TState> {
  readonly state: TState
  subscribe(listener: (state: TState) => void): () => void
}

export interface PanelsSnapshotSource<TState> {
  readonly snapshot: TState
  subscribe(listener: (state: TState) => void): () => void
}

export interface PanelsSchemaSource<TState> {
  readonly schema: TState
  subscribe(listener: (state: TState) => void): () => void
}

export function toSvelteState<TState>(source: PanelsStateSource<TState>): Readable<TState> {
  return readable(source.state, set => {
    set(source.state)
    return source.subscribe(set)
  })
}

export function toSvelteSnapshot<TState>(source: PanelsSnapshotSource<TState>): Readable<TState> {
  return readable(source.snapshot, set => {
    set(source.snapshot)
    return source.subscribe(set)
  })
}

export function toSvelteSchema<TState>(source: PanelsSchemaSource<TState>): Readable<TState> {
  return readable(source.schema, set => {
    set(source.schema)
    return source.subscribe(set)
  })
}
