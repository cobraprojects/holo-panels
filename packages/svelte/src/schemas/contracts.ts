import type { SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-client'
import type { Snippet } from 'svelte'
import type { SvelteComponentRegistry } from '../registry'

export interface SchemaContentRendererProps<TValues extends object = Record<string, unknown>> {
  readonly component: SchemaComponentManifest
  readonly panelId: string
  readonly schema: SchemaManifest<TValues>
}

export interface SvelteSchemaRendererProps<TValues extends object = Record<string, unknown>> {
  readonly panelId: string
  readonly registry: SvelteComponentRegistry
  readonly renderContent?: Snippet<[SchemaContentRendererProps<TValues>]>
  readonly schema: SchemaManifest<TValues>
}

export interface SchemaRendererContext {
  readonly panelId: string
  readonly registry: SvelteComponentRegistry
  readonly renderContent?: SvelteSchemaRendererProps['renderContent']
  readonly schema: SchemaManifest
  readonly schemaId: string
}

export interface SchemaRegisteredComponentProps extends Record<string, unknown> {
  readonly schemaComponentId: string
  readonly schemaStatePath?: string
}
