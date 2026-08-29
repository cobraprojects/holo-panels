<script lang="ts">
  import type { SchemaContentRendererProps } from '../schemas/contracts'
  import type { SvelteFieldDefinition, SvelteFieldRendererProps, SvelteFormStore } from './contracts'
  import type { SchemaManifest } from '@holo-js/panels-client'
  import type { SvelteComponentRegistry } from '../registry'
  import SchemaRenderer from '../schemas/SchemaRenderer.svelte'
  import FieldRenderer from './FieldRenderer.svelte'

  export interface Props {
    readonly collectionStores: ReadonlyMap<string, SvelteFieldRendererProps['collectionStore']>
    readonly actionPending?: (path: string, actionId: string) => boolean
    readonly fields: readonly SvelteFieldDefinition[]
    readonly executeAction?: (path: string, actionId: string) => void
    readonly form: SvelteFormStore
    readonly optionStores: ReadonlyMap<string, SvelteFieldRendererProps['optionStore']>
    readonly panelId: string
    readonly registry: SvelteComponentRegistry
    readonly schema: SchemaManifest<Record<string, unknown>>
    readonly uploadStores: ReadonlyMap<string, SvelteFieldRendererProps['uploadStore']>
  }

  let { actionPending, collectionStores, executeAction, fields, form, optionStores, panelId, registry, schema, uploadStores }: Props = $props()
</script>

{#snippet renderField({ component }: SchemaContentRendererProps<Record<string, unknown>>)}
  {@const definition = component.kind === 'field' ? fields.find(field => field.path === component.statePath) : undefined}
  {#if definition}<FieldRenderer {definition} actionPending={(actionId) => actionPending?.(definition.path, actionId) === true} executeAction={(actionId) => executeAction?.(definition.path, actionId)} {form} collectionStore={collectionStores.get(definition.path)} optionStore={optionStores.get(definition.path)} {panelId} {registry} uploadStore={uploadStores.get(definition.path)} />{/if}
{/snippet}

<SchemaRenderer {panelId} {registry} {schema} renderContent={renderField} />
