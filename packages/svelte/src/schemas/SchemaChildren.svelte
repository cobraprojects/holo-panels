<script lang="ts">
  import type { SchemaComponentManifest } from '@holo-js/panels-client'
  import type { SchemaRendererContext } from './contracts'
  import SchemaNode from './SchemaNode.svelte'

  let {
    components,
    context,
  }: {
    readonly components: readonly SchemaComponentManifest[]
    readonly context: SchemaRendererContext
  } = $props()
</script>

{#each components as component (component.key)}
  <SchemaNode {component} {context} />
{/each}
