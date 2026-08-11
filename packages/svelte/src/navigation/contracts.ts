import type { GlobalSearchStore, NavigationStore, PanelShellStore, PanelTenantSwitcherTransport } from '@holo-js/panels-client'

export interface SvelteNavigationSearchRendererProps {
  readonly navigation: NavigationStore
  readonly onNavigate?: (url: string) => void
  readonly search: GlobalSearchStore
}

export interface SvelteTenantSwitcherProps {
  readonly onError?: (error: unknown) => void
  readonly onNavigate?: (path: string) => void
  readonly onSwitched?: (routeKey: string) => void
  readonly store: PanelShellStore
  readonly transport: PanelTenantSwitcherTransport
}
