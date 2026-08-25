<script lang="ts">
  import RenderHook from '../src/components/RenderHook.svelte'
  import { providePanelsRenderHooks } from '../src/render-hook-context'
  import { SvelteComponentRegistry } from '../src/registry'
  import HookBanner from './HookBanner.svelte'

  const registry = new SvelteComponentRegistry()
  registry.register({ component: HookBanner, source: 'test', typeId: 'app.banner' })
  providePanelsRenderHooks({
    data: { recordId: 42 },
    manifest: { id: 'admin', slots: { 'panels::page.start': [{ component: 'app.banner', order: 0, properties: { title: 'Notice' }, source: 'panel' }] } },
    registry,
    scopes: ['posts', 'edit'],
  })
</script>

<RenderHook hook="panels::page.start" />
