<script lang="ts">
  import { SvelteComponentRegistry } from '../src/registry'
  import type { SchemaManifest } from '@holo-js/panels-client'
  import type { SchemaContentRendererProps } from '../src/schemas/contracts'
  import SchemaRenderer from '../src/schemas/SchemaRenderer.svelte'
  import P16SchemaCustom from './P16SchemaCustom.svelte'
  import P16SchemaSlot from './P16SchemaSlot.svelte'

  let { schema }: { readonly schema: SchemaManifest } = $props()
  const registry = new SvelteComponentRegistry()
  registry.register({ component: P16SchemaCustom, source: 'schema test', typeId: 'acme:review' })
  registry.register({ component: P16SchemaSlot, source: 'schema test', typeId: 'acme:slot' })

</script>

{#snippet renderContent(props: SchemaContentRendererProps)}
  <span data-schema-content={props.component.id}>{props.panelId}:{props.schema.id}</span>
{/snippet}

<SchemaRenderer panelId="admin" {registry} {renderContent} {schema} />
