import type { ClientNavigationManifest, ClientNavigationViewport, NavigationKey, NavigationState, NavigationStateListener } from './contracts'

function viewport(width: number): ClientNavigationViewport {
  if (!Number.isFinite(width) || width < 0) throw new Error('Navigation viewport widths must be non-negative')
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

function frozen(state: NavigationState): NavigationState {
  return Object.freeze({ ...state, collapsedClusters: new Set(state.collapsedClusters), collapsedGroups: new Set(state.collapsedGroups) })
}

export class NavigationStore {
  readonly #listeners = new Set<NavigationStateListener>()
  #state: NavigationState

  constructor(manifest: ClientNavigationManifest, width = 1280) {
    const ids = new Set<string>()
    for (const item of manifest.items) {
      if (ids.has(item.id)) throw new Error(`Duplicate client navigation item "${item.id}"`)
      ids.add(item.id)
    }
    this.#state = frozen({
      collapsedClusters: new Set(),
      collapsedGroups: new Set(),
      focusedItemId: manifest.activeItemId ?? manifest.items[0]?.id ?? null,
      manifest: Object.freeze({ ...manifest, clusters: Object.freeze([...manifest.clusters]), groups: Object.freeze([...manifest.groups]), items: Object.freeze([...manifest.items]), panels: Object.freeze([...manifest.panels]) }),
      menuOpen: viewport(width) === 'desktop' && manifest.layout === 'sidebar',
      viewport: viewport(width),
    })
  }

  get snapshot(): NavigationState {
    return this.#state
  }

  get visibleItems() {
    return this.#state.manifest.items.filter(item => !this.#state.collapsedGroups.has(item.group ?? '') && !this.#state.collapsedClusters.has(item.cluster ?? ''))
  }

  activePath(path: string): void {
    const candidates = this.#state.manifest.items
      .filter(item => path === item.path || path.startsWith(`${item.path}/`))
      .sort((left, right) => right.path.length - left.path.length || left.id.localeCompare(right.id))
    this.update({ focusedItemId: candidates[0]?.id ?? null })
  }

  setViewport(width: number): void {
    const next = viewport(width)
    this.update({ menuOpen: next === 'desktop' && this.#state.manifest.layout === 'sidebar', viewport: next })
  }

  toggleMenu(): void {
    if (this.#state.manifest.layout !== 'sidebar' || !this.#state.manifest.collapsible) return
    this.update({ menuOpen: !this.#state.menuOpen })
  }

  toggleGroup(id: string): void {
    if (!this.#state.manifest.groups.some(group => group.id === id)) throw new Error(`Unknown navigation group "${id}"`)
    this.toggleSet('collapsedGroups', id)
  }

  toggleCluster(id: string): void {
    const cluster = this.#state.manifest.clusters.find(candidate => candidate.id === id)
    if (!cluster) throw new Error(`Unknown navigation cluster "${id}"`)
    if (cluster.collapsible === false) return
    this.toggleSet('collapsedClusters', id)
  }

  key(key: NavigationKey): string | null {
    if (key === 'Escape') {
      if (this.#state.viewport !== 'desktop') this.update({ menuOpen: false })
      return null
    }
    const items = this.visibleItems
    if (items.length === 0) return null
    const current = Math.max(0, items.findIndex(item => item.id === this.#state.focusedItemId))
    if (key === 'Enter') return items[current]?.path ?? null
    const index = key === 'Home'
      ? 0
      : key === 'End'
        ? items.length - 1
        : key === 'ArrowDown'
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length
    this.update({ focusedItemId: items[index]?.id ?? null })
    return null
  }

  switchPanel(id: string): string {
    const panel = this.#state.manifest.panels.find(candidate => candidate.id === id)
    if (!panel) throw new Error(`Unknown or unauthorized panel "${id}"`)
    return panel.path
  }

  subscribe(listener: NavigationStateListener): () => void {
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  private toggleSet(key: 'collapsedClusters' | 'collapsedGroups', id: string): void {
    const next = new Set(this.#state[key])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    this.update({ [key]: next })
    if (!this.visibleItems.some(item => item.id === this.#state.focusedItemId)) this.update({ focusedItemId: this.visibleItems[0]?.id ?? null })
  }

  private update(patch: Partial<NavigationState>): void {
    this.#state = frozen({ ...this.#state, ...patch })
    for (const listener of this.#listeners) listener(this.#state)
  }
}
