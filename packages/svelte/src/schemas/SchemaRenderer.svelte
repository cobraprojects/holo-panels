<script lang="ts">
  import type { SvelteSchemaRendererProps } from './contracts'
  import SchemaChildren from './SchemaChildren.svelte'

  let {
    panelId,
    renderContent,
    registry,
    schema,
  }: SvelteSchemaRendererProps = $props()

  const context = $derived({ panelId, registry, renderContent, schema, schemaId: schema.id })
</script>

<div class="hp-schema" data-schema-id={schema.id} data-state-path={schema.statePath}>
  <SchemaChildren components={schema.components} {context} />
</div>
