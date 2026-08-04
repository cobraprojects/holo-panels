import type { GlobalSearchStore, NavigationStore } from '@holo-js/panels-client'

export interface NavigationSearchAcceptanceModel {
  readonly navigation: NavigationStore
  readonly search: GlobalSearchStore
}

export interface NavigationSearchAcceptanceRenderReport {
  readonly framework: 'react' | 'svelte' | 'vue'
  readonly markup: string
  readonly ssrStable: boolean
}

export interface NavigationSearchAcceptanceFixture {
  readonly framework: NavigationSearchAcceptanceRenderReport['framework']
  render(model: NavigationSearchAcceptanceModel): Promise<NavigationSearchAcceptanceRenderReport>
}

export interface NavigationSearchAcceptanceJourneyReport {
  readonly activePath: string | null
  readonly collapsedItems: readonly string[]
  readonly framework: NavigationSearchAcceptanceRenderReport['framework']
  readonly panelPath: string
  readonly render: NavigationSearchAcceptanceRenderReport
  readonly searchResultTitles: readonly string[]
}
