import type { Component } from 'svelte'
import RawSchemaRenderer from './schemas/SchemaRenderer.svelte'
import type { SvelteSchemaRendererProps } from './schemas/contracts'

export const SchemaRenderer: Component<SvelteSchemaRendererProps> = RawSchemaRenderer

export type * from './schemas/contracts'
