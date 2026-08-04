import type { GlobalSearchStore, NavigationStore } from '@holo-js/panels-client'

export interface ReactNavigationSearchRendererProps {
  readonly navigation: NavigationStore
  readonly onNavigate?: (url: string) => void
  readonly search: GlobalSearchStore
}
