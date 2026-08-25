<script lang="ts">
  import type { JsonObject, PanelManifest, RenderHook } from '@holo-js/panels-core'
  import type { SvelteComponentRegistry, SveltePanelComponent } from '../registry'
  import { usePanelsRenderHooks } from '../render-hook-context'

  let { data, hook, manifest, registry, scopes }: {
    readonly data?: JsonObject
    readonly hook: RenderHook
    readonly manifest?: Pick<PanelManifest, 'id' | 'slots'>
    readonly registry?: SvelteComponentRegistry
    readonly scopes?: readonly string[]
  } = $props()

  const context = usePanelsRenderHooks()
  const resolvedData = $derived(data ?? context?.data ?? {})
  const resolvedManifest = $derived(manifest ?? context?.manifest)
  const resolvedRegistry = $derived(registry ?? context?.registry)
  const resolvedScopes = $derived(scopes ?? context?.scopes ?? [])
  const references = $derived(resolvedManifest?.slots[hook] ?? [])

  function resolve(component: string): SveltePanelComponent<{ readonly data: JsonObject, readonly scopes: readonly string[] }> {
    if (!resolvedRegistry || !resolvedManifest) throw new Error(`[Holo Panels] Render hook "${hook}" requires a component registry.`)
    return resolvedRegistry.resolve(component, resolvedManifest.id, `render hook "${hook}"`)
  }
</script>

{#each references as reference, index (`${reference.source}:${reference.component}:${reference.order}:${index}`)}
  {@const Component = resolve(reference.component)}
  <Component {...reference.properties} data={resolvedData} scopes={resolvedScopes} />
{/each}
