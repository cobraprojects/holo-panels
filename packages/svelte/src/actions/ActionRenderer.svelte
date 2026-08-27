<script lang="ts">
  import { Button } from '../ui/button'
  import Icon from '../components/Icon.svelte'
  import { type JsonObject } from '@holo-js/panels-client'
  import { ActionsRenderHook, type ActionModalWidth, type RenderSlotReference, type SchemaManifest } from '@holo-js/panels-core'
  import * as AlertDialog from '../ui/alert-dialog'
  import * as Dialog from '../ui/dialog'
  import * as DropdownMenu from '../ui/dropdown-menu'
  import * as Sheet from '../ui/sheet'
  import { SvelteComponentRegistry } from '../registry'
  import SchemaRenderer from '../schemas/SchemaRenderer.svelte'
  import RenderHook from '../components/RenderHook.svelte'
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

  function modalWidthClass(width: ActionModalWidth): string {
    if (width === 'small') return 'hp:w-full hp:sm:max-w-sm'
    if (width === 'large') return 'hp:w-full hp:sm:max-w-2xl'
    if (width === 'extra-large') return 'hp:w-full hp:sm:max-w-4xl'
    if (width === 'screen') return 'hp:h-[calc(100vh-2rem)] hp:w-[calc(100vw-2rem)] hp:max-w-none'
    return 'hp:w-full hp:sm:max-w-lg'
  }

  function modalSlotReference(value: JsonObject | RenderSlotReference | null): RenderSlotReference | null {
    if (!value || typeof value.component !== 'string') return null
    const properties = value.properties
    if (properties === undefined) return { component: value.component }
    if (!properties || Array.isArray(properties) || typeof properties !== 'object') return null
    return { component: value.component, properties }
  }

  function isModalSchema(value: JsonObject): value is JsonObject & SchemaManifest<JsonObject> {
    return value.kind === 'schema' && typeof value.id === 'string' && Array.isArray(value.components)
  }

  function modalSchema(value: JsonObject | null): SchemaManifest<JsonObject> | null {
    return value && isModalSchema(value) ? value : null
  }
</script>

<div class="hp-action" data-action-mount={action.mount}>
  <div class="hp-action-collection">
    {#each actions.filter(candidate => !groupedActionIds.has(candidate.id)) as candidate (candidate.id)}
      {#if candidate.visible !== false}<Button class="hp-action-trigger" data-action-id={candidate.id} data-color={candidate.color ?? undefined} variant={candidate.color === 'danger' ? 'destructive' : 'outline'} disabled={candidate.disabled === true || $actionState.frames.some(frame => frame.manifest.id === candidate.id)} onclick={() => store.mount(candidate)} type="button">{#if candidate.icon}<Icon name={candidate.icon} />{/if}<span>{candidate.label}</span></Button>{/if}
    {/each}
    {#each groups as group (group.id)}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}<Button {...props} variant="outline">{#if group.icon}<Icon name={group.icon} />{/if}{group.label ?? 'Actions'}<Icon name="chevron-down" /></Button>{/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" data-holo-panel>
          {#each group.actions as id (id)}
            {@const candidate = findAction(id)}
            {#if candidate && candidate.visible !== false}<DropdownMenu.Item disabled={candidate.disabled} variant={candidate.color === 'danger' ? 'destructive' : 'default'} onSelect={() => store.mount(candidate)}>{#if candidate.icon}<Icon name={candidate.icon} />{/if}{candidate.label}</DropdownMenu.Item>{/if}
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/each}
  </div>
  {#each $actionState.frames.slice(-1) as frame, index (`${frame.manifest.id}-${index}`)}
    {@const titleId = `hp-action-${frame.manifest.id.replace(/[^a-z0-9_-]/giu, '-')}-title-${index}`}
    {@const typeId = customTypeId(frame.manifest.id)}
    {@const schema = modalSchema(frame.manifest.modal?.schema ?? null)}
    {@const contentReference = modalSlotReference(frame.manifest.modal?.content ?? null)}
    {@const footerReference = modalSlotReference(frame.manifest.modal?.footer ?? null)}
    {@const Custom = registry?.hasRenderer(typeId, panelId) ? registry.resolve<SvelteActionCustomProps>(typeId, panelId, 'action modal') : undefined}
    {@const Content = contentReference && registry ? registry.resolve<SvelteActionSlotProps>(contentReference.component, panelId, 'action modal content') : undefined}
    {@const Footer = footerReference && registry ? registry.resolve<SvelteActionSlotProps>(footerReference.component, panelId, 'action modal footer') : undefined}
    {#snippet actionContent()}
      <RenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_BEFORE} />
      {#if Content}<Content {...contentReference?.properties ?? {}} {frame} />{/if}
      <RenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_AFTER} />
      {#if Custom}
        <Custom {frame} setInput={(input: JsonObject) => store.setInput(input)} {submit} />
      {:else}
        <form class="hp:space-y-4" onsubmit={(event) => { event.preventDefault(); void submit() }}>
          {#if schema}
            <RenderHook hook={ActionsRenderHook.MODAL_SCHEMA_BEFORE} /><SchemaRenderer panelId={panelId ?? 'default'} registry={schemaRegistry} {schema} /><RenderHook hook={ActionsRenderHook.MODAL_SCHEMA_AFTER} />
          {/if}
          <Dialog.Footer><Button class="hp-action-trigger" data-action-id={frame.manifest.id} data-color={frame.manifest.color ?? undefined} variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'} disabled={frame.phase === 'submitting'} type="submit">{#if frame.manifest.icon}<Icon name={frame.manifest.icon} />{/if}<span>{frame.phase === 'submitting' ? 'Working…' : 'Run action'}</span></Button></Dialog.Footer>
        </form>
      {/if}
      {#each frame.manifest.modal?.nestedActions ?? [] as id (id)}
        {@const nested = findAction(id)}
        {#if nested && nested.visible !== false}<Button class="hp-action-trigger" data-action-id={nested.id} data-color={nested.color ?? undefined} variant={nested.color === 'danger' ? 'destructive' : 'outline'} disabled={nested.disabled} onclick={() => store.mount(nested)} type="button">{#if nested.icon}<Icon name={nested.icon} />{/if}<span>{nested.label}</span></Button>{/if}
      {/each}
      <RenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_BEFORE} />
      {#if Footer}<Footer {...footerReference?.properties ?? {}} {frame} />{/if}
      <RenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_AFTER} />
    {/snippet}
    {#if frame.phase === 'confirming'}
      <AlertDialog.Root open>
        <AlertDialog.Content data-holo-panel data-panels-component="confirmation" onEscapeKeydown={() => store.close()} onInteractOutside={() => store.close()}>
          <AlertDialog.Header><AlertDialog.Title id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</AlertDialog.Title><AlertDialog.Description>{frame.manifest.confirmation}</AlertDialog.Description></AlertDialog.Header>
          <AlertDialog.Footer><AlertDialog.Cancel onclick={() => store.close()}>Cancel</AlertDialog.Cancel><AlertDialog.Action variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'} onclick={(event) => { event.preventDefault(); store.confirm() }}>{#if frame.manifest.icon}<Icon name={frame.manifest.icon} />{/if}Confirm</AlertDialog.Action></AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {:else if frame.manifest.modal?.slideOver}
      <Sheet.Root open onOpenChange={(open) => { if (!open) store.close() }}>
        <Sheet.Content class={modalWidthClass(frame.manifest.modal?.width ?? 'medium')} data-holo-panel data-modal-width={frame.manifest.modal?.width ?? 'medium'} data-panels-component="slide-over">
          <Sheet.Header><Sheet.Title id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</Sheet.Title>{#if frame.manifest.modal?.description}<Sheet.Description>{frame.manifest.modal.description}</Sheet.Description>{/if}</Sheet.Header>
          <div class="hp:space-y-4 hp:p-4">{@render actionContent()}</div>
        </Sheet.Content>
      </Sheet.Root>
    {:else}
      <Dialog.Root open onOpenChange={(open) => { if (!open) store.close() }}>
        <Dialog.Content class={modalWidthClass(frame.manifest.modal?.width ?? 'medium')} data-holo-panel data-modal-width={frame.manifest.modal?.width ?? 'medium'} data-panels-component="modal">
          <Dialog.Header><Dialog.Title id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</Dialog.Title>{#if frame.manifest.modal?.description}<Dialog.Description>{frame.manifest.modal.description}</Dialog.Description>{/if}</Dialog.Header>
          {@render actionContent()}
        </Dialog.Content>
      </Dialog.Root>
    {/if}
  {/each}
</div>
