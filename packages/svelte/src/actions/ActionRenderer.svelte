<script lang="ts">
  import type { JsonObject } from '@holo-js/panels-client'
  import Dialog from '../components/Dialog.svelte'
  import Dropdown from '../components/Dropdown.svelte'
  import SlideOver from '../components/SlideOver.svelte'
  import { SvelteComponentRegistry } from '../registry'
  import SchemaRenderer from '../schemas/SchemaRenderer.svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteActionCustomProps, SvelteActionRendererProps, SvelteActionSlotProps } from './contracts'

  let { action, actions = [action], groups = [], panelId, recordIds, registry, store }: SvelteActionRendererProps = $props()
  const actionState = $derived.by(() => toSvelteState(store))
  const defaultSchemaRegistry = new SvelteComponentRegistry()
  const schemaRegistry = $derived(registry ?? defaultSchemaRegistry)

  async function submit(): Promise<void> {
    try {
      await store.submit(recordIds)
    } catch {
      return
    }
  }

  function customTypeId(id: string): string {
    return `panels:action:${id.replace(/[^a-z0-9-]/giu, '-').toLowerCase()}`
  }

  const groupedActionIds = $derived(new Set(groups.flatMap(group => group.actions)))

  function findAction(id: string): (typeof actions)[number] | undefined {
    return actions.find(candidate => candidate.id === id)
  }
</script>

<div class="hp-action" data-action-mount={action.mount}>
  <div class="hp-action-collection">
    {#each actions.filter(candidate => !groupedActionIds.has(candidate.id)) as candidate (candidate.id)}
      {#if candidate.visible !== false}<button data-action-id={candidate.id} disabled={candidate.disabled === true || $actionState.frames.some(frame => frame.manifest.id === candidate.id)} onclick={() => store.mount(candidate)} type="button">{candidate.label}</button>{/if}
    {/each}
    {#each groups as group (group.id)}
      <span data-action-color={group.color ?? undefined} data-action-icon={group.icon ?? undefined}><Dropdown label={group.label ?? 'Actions'} items={group.actions.flatMap(id => { const candidate = findAction(id); return !candidate || candidate.visible === false ? [] : [{ disabled: candidate.disabled, id, label: candidate.label }] })} onselect={(id) => { const candidate = findAction(id); if (candidate) store.mount(candidate) }} /></span>
    {/each}
  </div>
  {#each $actionState.frames.slice(-1) as frame, index (`${frame.manifest.id}-${index}`)}
    {@const titleId = `hp-action-${frame.manifest.id.replace(/[^a-z0-9_-]/giu, '-')}-title-${index}`}
    {@const typeId = customTypeId(frame.manifest.id)}
    {@const Custom = registry?.hasRenderer(typeId, panelId) ? registry.resolve<SvelteActionCustomProps>(typeId, panelId, 'action modal') : undefined}
    {@const Surface = frame.manifest.modal?.slideOver ? SlideOver : Dialog}
    {@const Content = frame.manifest.modal?.content && registry ? registry.resolve<SvelteActionSlotProps>(frame.manifest.modal.content.component, panelId, 'action modal content') : undefined}
    {@const Footer = frame.manifest.modal?.footer && registry ? registry.resolve<SvelteActionSlotProps>(frame.manifest.modal.footer.component, panelId, 'action modal footer') : undefined}
    <Surface labelledBy={titleId} onclose={() => store.close()} open>
      <div data-modal-width={frame.manifest.modal?.width ?? 'medium'}>
      <h2 id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</h2>
      {#if frame.manifest.modal?.description}<p>{frame.manifest.modal.description}</p>{/if}
      {#if Content}<Content {...frame.manifest.modal?.content?.properties} {frame} />{/if}
      {#if frame.phase === 'confirming'}
        <p>{frame.manifest.confirmation}</p>
        <button onclick={() => store.confirm()} type="button">Confirm</button>
      {:else if Custom}
        <Custom {frame} setInput={(input: JsonObject) => store.setInput(input)} {submit} />
      {:else}
        <form onsubmit={(event) => { event.preventDefault(); void submit() }}>
          {#if frame.manifest.modal?.schema}
            <SchemaRenderer panelId={panelId ?? 'default'} registry={schemaRegistry} schema={frame.manifest.modal.schema} />
          {/if}
          <button disabled={frame.phase === 'submitting'} type="submit">{frame.phase === 'submitting' ? 'Working…' : 'Run action'}</button>
        </form>
      {/if}
      {#each frame.manifest.modal?.nestedActions ?? [] as id (id)}
        {@const nested = findAction(id)}
        {#if nested && nested.visible !== false}<button data-action-id={nested.id} disabled={nested.disabled} onclick={() => store.mount(nested)} type="button">{nested.label}</button>{/if}
      {/each}
      {#if frame.error}<div role="alert">{frame.error}</div>{/if}
      {#if frame.phase === 'succeeded'}<div aria-live="polite" role="status">Action completed</div>{/if}
      {#if Footer}<Footer {...frame.manifest.modal?.footer?.properties} {frame} />{/if}
      <button onclick={() => store.close()} type="button">Close</button>
      </div>
    </Surface>
  {/each}
</div>
