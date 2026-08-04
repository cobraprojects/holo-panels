import type { EntryRendererRegistration } from './contracts'

interface StoredRenderer<TRenderer> {
  readonly renderer: TRenderer
  readonly source: string
}

export class EntryRendererRegistry<TRenderer> {
  readonly #renderers = new Map<string, StoredRenderer<TRenderer>>()

  register(registration: EntryRendererRegistration, renderer: TRenderer): () => void {
    if (!/^[a-z][a-z0-9.-]*(?::entry:[a-z][a-z0-9._-]*)?$/u.test(registration.type)) {
      throw new Error(`[Holo Panels] Invalid entry renderer type: ${registration.type}`)
    }
    const existing = this.#renderers.get(registration.type)
    if (existing) throw new Error(`Entry renderer "${registration.type}" from ${registration.source} conflicts with ${existing.source}`)
    this.#renderers.set(registration.type, { renderer, source: registration.source })
    return () => this.#renderers.delete(registration.type)
  }

  resolve(type: string, requestedFrom = 'compiled infolist'): TRenderer {
    const entry = this.#renderers.get(type)
    if (!entry) throw new Error(`Missing entry renderer "${type}", requested from ${requestedFrom}`)
    return entry.renderer
  }

  has(type: string): boolean {
    return this.#renderers.has(type)
  }
}
