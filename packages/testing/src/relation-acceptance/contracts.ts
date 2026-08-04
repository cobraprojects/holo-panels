import type { ClientRelationManager } from '@holo-js/panels-client'

export type { ClientRelationManager } from '@holo-js/panels-client'

export interface RelationAcceptanceRenderReport {
  readonly framework: 'react' | 'svelte' | 'vue'
  readonly markup: string
  readonly ssrStable: boolean
}

export interface RelationAcceptanceFixture {
  readonly framework: RelationAcceptanceRenderReport['framework']
  render(managers: readonly ClientRelationManager[]): Promise<RelationAcceptanceRenderReport>
}

export interface RelationAcceptanceJourneyReport {
  readonly framework: RelationAcceptanceRenderReport['framework']
  readonly managers: readonly ClientRelationManager[]
  readonly render: RelationAcceptanceRenderReport
}
