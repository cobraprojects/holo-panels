export type NavigationItemKind = 'dashboard' | 'page' | 'resource'
export type NavigationLayout = 'sidebar' | 'topbar'

export interface NavigationContext<TActor, TTenant> {
  readonly activePath: string
  readonly actor: TActor
  readonly panelId: string
  readonly panelPath: string
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export type NavigationResolver<TValue, TActor, TTenant> = TValue | ((context: NavigationContext<TActor, TTenant>) => TValue | Promise<TValue>)

export interface NavigationSource<TActor, TTenant> {
  readonly authorize?: (context: NavigationContext<TActor, TTenant>) => boolean | Promise<boolean>
  readonly badge?: NavigationResolver<string | null, TActor, TTenant>
  readonly cluster?: string | null
  readonly group?: string | null
  readonly icon?: string | null
  readonly id: string
  readonly kind: NavigationItemKind
  readonly label: string
  readonly parent?: string | null
  readonly path: string
  readonly sort?: number
  readonly variant?: string | null
}

export interface NavigationClusterSource<TActor, TTenant> {
  readonly authorize?: (context: NavigationContext<TActor, TTenant>) => boolean | Promise<boolean>
  readonly collapsible?: boolean
  readonly icon?: string | null
  readonly id: string
  readonly label: string
  readonly sort?: number
}

export interface PanelSwitchSource<TActor, TTenant> {
  readonly authorize?: (context: NavigationContext<TActor, TTenant>) => boolean | Promise<boolean>
  readonly icon?: string | null
  readonly id: string
  readonly label: string
  readonly path: string
  readonly sort?: number
}

export interface ResolvedNavigationItem {
  readonly active: boolean
  readonly badge: string | null
  readonly cluster: string | null
  readonly group: string | null
  readonly icon: string | null
  readonly id: string
  readonly kind: NavigationItemKind
  readonly label: string
  readonly parent: string | null
  readonly path: string
  readonly sort: number
  readonly variant: string | null
}

export interface ResolvedNavigationCluster {
  readonly active: boolean
  readonly collapsible: boolean
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly sort: number
}

export interface ResolvedNavigationGroup {
  readonly active: boolean
  readonly id: string
  readonly label: string
  readonly sort: number
}

export interface ResolvedPanelSwitchItem {
  readonly active: boolean
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly path: string
  readonly sort: number
}

export interface NavigationManifest {
  readonly activeItemId: string | null
  readonly clusters: readonly ResolvedNavigationCluster[]
  readonly collapsible: boolean
  readonly groups: readonly ResolvedNavigationGroup[]
  readonly items: readonly ResolvedNavigationItem[]
  readonly layout: NavigationLayout
  readonly panelId: string
  readonly panels: readonly ResolvedPanelSwitchItem[]
}

export interface ResolveNavigationOptions<TActor, TTenant> {
  readonly clusters?: readonly NavigationClusterSource<TActor, TTenant>[]
  readonly collapsible?: boolean
  readonly context: NavigationContext<TActor, TTenant>
  readonly items: readonly NavigationSource<TActor, TTenant>[]
  readonly layout?: NavigationLayout
  readonly panels?: readonly PanelSwitchSource<TActor, TTenant>[]
}
