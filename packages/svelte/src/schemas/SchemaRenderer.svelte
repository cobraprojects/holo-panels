<script lang="ts">
  import type { SvelteSchemaRendererProps } from './contracts'
  import type { SchemaComponentManifest } from '@holo-js/panels-client'
  import SchemaChildren from './SchemaChildren.svelte'
  import SchemaNode from './SchemaNode.svelte'

  let {
    panelId,
    renderContent,
    registry,
    schema,
  }: SvelteSchemaRendererProps = $props()

  const context = $derived({ panelId, registry, renderContent, schema, schemaId: schema.id })
</script>

{#snippet renderNode(component: SchemaComponentManifest)}
  <SchemaNode {component} {context} {renderNode} />
{/snippet}

<div class="hp-schema" data-schema-id={schema.id} data-state-path={schema.statePath}>
  <SchemaChildren components={schema.components} {context} {renderNode} />
</div>
