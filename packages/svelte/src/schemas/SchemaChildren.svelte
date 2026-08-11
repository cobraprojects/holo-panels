<script lang="ts">
  import type { SchemaComponentManifest } from '@holo-js/panels-client'
  import type { Snippet } from 'svelte'
  import type { SchemaRendererContext } from './contracts'

  let {
    components,
    context,
    renderNode,
  }: {
    readonly components: readonly SchemaComponentManifest[]
    readonly context: SchemaRendererContext
    readonly renderNode: Snippet<[SchemaComponentManifest]>
  } = $props()
</script>

{#each components as component (component.key)}
  {@render renderNode(component)}
{/each}
