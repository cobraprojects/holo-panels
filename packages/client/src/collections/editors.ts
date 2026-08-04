export type EditorKind = 'code' | 'markdown' | 'rich-text'

export interface EditorMountTarget {
  setAttribute(name: string, value: string): void
}

export interface EditorAdapterContext {
  readonly disabled: boolean
  readonly element: EditorMountTarget
  readonly onChange: (value: string) => void
  readonly readOnly: boolean
  readonly value: string
}

export interface EditorAdapterInstance {
  destroy(): void
  focus(): void
  update(value: string): void
}

export interface EditorAdapter {
  readonly kind: EditorKind
  mount(context: EditorAdapterContext): EditorAdapterInstance
}

interface StoredEditorAdapter {
  readonly adapter: EditorAdapter
  readonly source: string
}

function identifier(value: string): void {
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(value)) throw new Error(`Invalid editor adapter ID: ${value}`)
}

export class EditorAdapterRegistry {
  readonly #adapters = new Map<string, StoredEditorAdapter>()

  register(id: string, adapter: EditorAdapter, source = 'application'): () => void {
    identifier(id)
    const existing = this.#adapters.get(id)
    if (existing) throw new Error(`Editor adapter "${id}" from ${source} conflicts with ${existing.source}`)
    this.#adapters.set(id, { adapter, source })
    return () => this.#adapters.delete(id)
  }

  resolve(id: string, requestedFrom = 'compiled field schema'): EditorAdapter {
    const entry = this.#adapters.get(id)
    if (!entry) throw new Error(`Missing editor adapter "${id}", requested from ${requestedFrom}`)
    return entry.adapter
  }

  has(id: string): boolean {
    return this.#adapters.has(id)
  }
}
