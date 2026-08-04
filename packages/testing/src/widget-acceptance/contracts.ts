import type { WidgetStore } from '@holo-js/panels-client'
import type { WidgetManifest } from '@holo-js/panels-core'

export interface WidgetAcceptanceItem {
  readonly manifest: WidgetManifest
  readonly placement: 'dashboard' | 'resource-footer' | 'resource-header'
  readonly store: WidgetStore
}

export interface WidgetAcceptanceModel {
  readonly dashboardId: string
  readonly dashboardWidgets: readonly WidgetAcceptanceItem[]
  readonly resourceWidgets: readonly WidgetAcceptanceItem[]
  readonly viewportWidth: number
}

export interface WidgetAcceptanceRenderReport {
  readonly framework: 'react' | 'svelte' | 'vue'
  readonly markup: string
  readonly ssrStable: boolean
}

export interface WidgetAcceptanceFixture {
  readonly framework: WidgetAcceptanceRenderReport['framework']
  render(model: WidgetAcceptanceModel): Promise<WidgetAcceptanceRenderReport>
}

export interface WidgetAcceptanceJourneyReport {
  readonly filteredValue: string
  readonly framework: WidgetAcceptanceRenderReport['framework']
  readonly pollingCancelled: boolean
  readonly render: WidgetAcceptanceRenderReport
}
