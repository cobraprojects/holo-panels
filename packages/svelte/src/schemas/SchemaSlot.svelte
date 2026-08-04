<script lang="ts">
  import type { SchemaComponentManifest } from '@holo-js/panels-client'
  import type { SchemaRegisteredComponentProps, SchemaRendererContext } from './contracts'
  import { resolveRegisteredComponent } from './helpers'

  let {
    context,
    ownerId,
    slots = [],
    statePath,
  }: {
    readonly context: SchemaRendererContext
    readonly ownerId: string
    readonly slots?: NonNullable<SchemaComponentManifest['slots'][keyof SchemaComponentManifest['slots']]>
    readonly statePath?: string
  } = $props()
</script>

{#each slots as slot (`${slot.source}:${slot.order}:${slot.component}`)}
  {@const Renderer = resolveRegisteredComponent(context, slot.component, `schema slot on "${ownerId}"`)}
  <Renderer {...slot.properties} schemaComponentId={ownerId} schemaStatePath={statePath} />
{/each}
