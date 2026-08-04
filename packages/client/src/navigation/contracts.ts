export type ClientNavigationLayout = 'sidebar' | 'topbar'
export type ClientNavigationViewport = 'desktop' | 'mobile' | 'tablet'

export interface ClientNavigationItem {
  readonly active: boolean
  readonly badge: string | null
  readonly cluster: string | null
  readonly group: string | null
  readonly icon: string | null
  readonly id: string
  readonly kind: 'dashboard' | 'page' | 'resource'
  readonly label: string
  readonly parent: string | null
  readonly path: string
  readonly sort: number
  readonly variant: string | null
}

export interface ClientNavigationSection {
  readonly active: boolean
  readonly collapsible?: boolean
  readonly icon?: string | null
  readonly id: string
  readonly label: string
  readonly sort: number
}

export interface ClientPanelSwitchItem {
  readonly active: boolean
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly path: string
  readonly sort: number
}

export interface ClientNavigationManifest {
  readonly activeItemId: string | null
  readonly clusters: readonly ClientNavigationSection[]
  readonly collapsible: boolean
  readonly groups: readonly ClientNavigationSection[]
  readonly items: readonly ClientNavigationItem[]
  readonly layout: ClientNavigationLayout
  readonly panelId: string
  readonly panels: readonly ClientPanelSwitchItem[]
}

export interface NavigationState {
  readonly collapsedClusters: ReadonlySet<string>
  readonly collapsedGroups: ReadonlySet<string>
  readonly focusedItemId: string | null
  readonly manifest: ClientNavigationManifest
  readonly menuOpen: boolean
  readonly viewport: ClientNavigationViewport
}

export type NavigationKey = 'ArrowDown' | 'ArrowUp' | 'End' | 'Enter' | 'Escape' | 'Home'
export type NavigationStateListener = (state: NavigationState) => void
