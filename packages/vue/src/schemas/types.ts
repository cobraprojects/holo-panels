import type { SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-client'
import type { VNodeChild } from 'vue'
import type { ComponentRegistry } from '../registry'

export interface SchemaContentRendererProps<TValues extends object = Record<string, unknown>> {
  readonly component: SchemaComponentManifest
  readonly panelId: string
  readonly schema: SchemaManifest<TValues>
}

export interface VueSchemaRendererProps<TValues extends object = Record<string, unknown>> {
  readonly panelId: string
  readonly registry: ComponentRegistry
  readonly renderContent?: (props: SchemaContentRendererProps<TValues>) => VNodeChild
  readonly schema: SchemaManifest<TValues>
}
