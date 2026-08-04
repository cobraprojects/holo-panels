import type { JsonObject, SchemaComponentManifest, SchemaManifest, ScopedRenderSlotManifest } from '@holo-js/panels-client'
import type { ReactNode } from 'react'
import type { ComponentRegistry } from '../registry'

export interface SchemaContentRendererProps<TValues extends object = Record<string, unknown>> {
  readonly component: SchemaComponentManifest
  readonly panelId: string
  readonly schema: SchemaManifest<TValues>
}

export interface ReactSchemaCustomRendererProps {
  readonly children: ReactNode
  readonly component: SchemaComponentManifest
  readonly properties: JsonObject
}

export interface ReactSchemaSlotRendererProps {
  readonly component: SchemaComponentManifest
  readonly placement: keyof SchemaComponentManifest['slots']
  readonly reference: ScopedRenderSlotManifest
}

export interface ReactSchemaRendererProps<TValues extends object = Record<string, unknown>> {
  readonly panelId: string
  readonly registry: ComponentRegistry
  readonly renderContent?: (props: SchemaContentRendererProps<TValues>) => ReactNode
  readonly schema: SchemaManifest<TValues>
}
