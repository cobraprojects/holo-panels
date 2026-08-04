import type { Component } from 'svelte'
import RawRelationManagerRenderer from './RelationManagerRenderer.svelte'
import type { SvelteRelationManagerRendererProps } from './contracts'

export interface SvelteRelationManagerRendererComponentProps {
  readonly relations: SvelteRelationManagerRendererProps
}

export const SvelteRelationManagerRenderer: Component<SvelteRelationManagerRendererComponentProps> = RawRelationManagerRenderer
export type { SvelteRelationManagerRendererProps, SvelteRelationOperationRequest } from './contracts'
