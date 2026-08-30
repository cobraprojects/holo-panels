<script lang="ts">
  import { Button } from '../ui/button'
  import Icon from '../components/Icon.svelte'
  import { actionFormField, actionFormSchema, actionManifestCollection, createPanelTranslator, readOnlyPresentationStores, type JsonObject } from '@holo-js/panels-client'
  import { ActionsRenderHook, type ActionModalWidth, type RenderSlotReference, type SchemaManifest } from '@holo-js/panels-core'
  import * as AlertDialog from '../ui/alert-dialog'
  import * as Dialog from '../ui/dialog'
  import * as DropdownMenu from '../ui/dropdown-menu'
  import * as Sheet from '../ui/sheet'
  import { SvelteComponentRegistry } from '../registry'
  import SchemaRenderer from '../schemas/SchemaRenderer.svelte'
  import FieldRenderer from '../fields/FieldRenderer.svelte'
  import EntryRenderer from '../entries/EntryRenderer.svelte'
  import RenderHook from '../components/RenderHook.svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteActionCustomProps, SvelteActionRendererProps, SvelteActionSlotProps } from './contracts'

  let { action, actions = [action], groups = [], input, panelId, recordIds, registry, showTriggers = true, store }: SvelteActionRendererProps = $props()
  const actionState = $derived.by(() => toSvelteState(store))
  const formState = $derived.by(() => $actionState.frames.length && store.activeForm ? toSvelteState(store.activeForm) : undefined)
  const defaultSchemaRegistry = new SvelteComponentRegistry()
  const schemaRegistry = $derived(registry ?? defaultSchemaRegistry)
  const translate = $derived(createPanelTranslator(globalThis.document?.documentElement.lang || 'en'))
  async function submit(): Promise<void> {
    try {
      const current = store
      const result = await current.submit(recordIds)
      if (current.activeFrame?.result === result) current.close()
    } catch {
      return
    }
  }

  function activate(candidate: (typeof actions)[number]): void {
    store.mount(candidate, input)
    if (!candidate.confirmation && !candidate.modal) void submit()
  }

  function customTypeId(id: string): string {
    return `panels:action:${id.replace(/[^a-z0-9-]/giu, '-').toLowerCase()}`
  }

  const groupedActionIds = $derived(new Set(groups.flatMap(group => group.actions)))
  const collection = $derived(actionManifestCollection(actions))
  const nestedIds = $derived(new Set(collection.flatMap(candidate => candidate.modal?.nestedActions ?? [])))

  function findAction(id: string): (typeof actions)[number] | undefined {
    return collection.find(candidate => candidate.id === id)
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

</script>

<div class="hp-action" data-action-mount={action.mount}>
  {#if showTriggers}<div class="hp-action-collection">
    {#each collection.filter(candidate => !groupedActionIds.has(candidate.id) && !nestedIds.has(candidate.id)) as candidate (candidate.id)}
      {#if candidate.visible !== false}<Button class="hp-action-trigger" data-action={candidate.id} data-action-id={candidate.id} data-operation={candidate.kind} data-color={candidate.color ?? undefined} variant={candidate.color === 'danger' ? 'destructive' : 'outline'} disabled={candidate.disabled === true || $actionState.frames.some(frame => frame.manifest.id === candidate.id)} onclick={() => activate(candidate)} type="button">{#if candidate.icon}<Icon name={candidate.icon} />{/if}<span>{candidate.label}</span></Button>{/if}
    {/each}
    {#each groups as group (group.id)}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}<Button {...props} aria-label={group.label ?? 'Actions'} class="hp-action-group-trigger" data-action-group={group.id} variant="outline">{#if group.icon}<Icon name={group.icon} />{/if}{group.label ?? 'Actions'}<Icon name="chevron-down" /></Button>{/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" data-holo-panel>
          {#each group.actions as id (id)}
            {@const candidate = findAction(id)}
            {#if candidate && candidate.visible !== false}<DropdownMenu.Item data-action={id} data-action-id={id} data-color={candidate.color ?? undefined} disabled={candidate.disabled || $actionState.frames.some(frame => frame.manifest.id === id)} variant={candidate.color === 'danger' ? 'destructive' : 'default'} onSelect={() => activate(candidate)}>{#if candidate.icon}<Icon name={candidate.icon} />{/if}{candidate.label}</DropdownMenu.Item>{/if}
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/each}
  </div>{/if}
  {#each $actionState.frames.slice(-1) as frame, index (`${frame.manifest.id}-${index}`)}
    {@const dismiss = {
      onEscapeKeydown: (event: KeyboardEvent) => { if (frame.manifest.modal?.closeByEscaping === false) event.preventDefault() },
      onInteractOutside: (event: Event) => { if (frame.manifest.modal?.closeByClickingAway === false) event.preventDefault() },
      onOpenAutoFocus: (event: Event) => { if (frame.manifest.modal?.autofocus === false) event.preventDefault() },
    }}
    {@const titleId = `hp-action-${frame.manifest.id.replace(/[^a-z0-9_-]/giu, '-')}-title-${index}`}
    {@const typeId = customTypeId(frame.manifest.id)}
    {@const schema = actionFormSchema(frame.manifest.modal?.schema ?? null, frame.manifest.id)}
    {@const readOnlyStores = readOnlyPresentationStores(frame.manifest.modal?.readOnlyPresentation)}
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
      {:else if frame.manifest.modal?.readOnlyPresentation}
        <div class="hp:grid hp:gap-4" data-read-only-presentation="infolist">
          {#each readOnlyStores as entryStore (entryStore.snapshot.id)}
            <EntryRenderer store={entryStore} {panelId} {registry} />
          {/each}
        </div>
      {:else}
        <form class="hp-panel-form hp:grid hp:gap-6" novalidate onsubmit={(event) => { event.preventDefault(); void submit() }}>
          {#if schema}
            <RenderHook hook={ActionsRenderHook.MODAL_SCHEMA_BEFORE} /><SchemaRenderer panelId={panelId ?? 'default'} registry={schemaRegistry} {schema}>
              {#snippet renderContent({ component })}
                {@const definition = actionFormField(component)}
                {#if definition && store.activeForm}<FieldRenderer definition={{ ...definition, helperText: definition.helperText ?? undefined, hint: definition.hint ?? undefined, placeholder: definition.placeholder ?? undefined }} form={store.activeForm} optionStore={store.optionStore(definition)} {panelId} {registry} />{/if}
              {/snippet}
            </SchemaRenderer><RenderHook hook={ActionsRenderHook.MODAL_SCHEMA_AFTER} />
          {/if}
          <Dialog.Footer><Button onclick={() => store.close()} type="button" variant="outline">{frame.manifest.modal?.cancelActionLabel ?? 'Close'}</Button>{#if frame.manifest.kind !== 'view'}<Button class="hp-action-trigger" data-action-id={frame.manifest.id} data-color={frame.manifest.color ?? undefined} variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'} disabled={frame.phase === 'submitting'} type="submit">{#if frame.manifest.icon}<Icon name={frame.manifest.icon} />{/if}<span>{frame.phase === 'submitting' ? 'Working…' : frame.manifest.modal?.submitActionLabel ?? 'Run action'}</span></Button>{/if}</Dialog.Footer>
          {#if $formState?.errors._root?.length}<ul data-form-errors="" role="alert">{#each $formState.errors._root as message}<li>{message}</li>{/each}</ul>{/if}
        </form>
      {/if}
      {#each frame.manifest.modal?.nestedActions ?? [] as id (id)}
        {@const nested = findAction(id)}
        {#if nested && nested.visible !== false}<Button class="hp-action-trigger" data-action-id={nested.id} data-color={nested.color ?? undefined} variant={nested.color === 'danger' ? 'destructive' : 'outline'} disabled={nested.disabled} onclick={() => activate(nested)} type="button">{#if nested.icon}<Icon name={nested.icon} />{/if}<span>{nested.label}</span></Button>{/if}
      {/each}
      <RenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_BEFORE} />
      {#if Footer}<Footer {...footerReference?.properties ?? {}} {frame} />{/if}
      <RenderHook hook={ActionsRenderHook.MODAL_CUSTOM_CONTENT_FOOTER_AFTER} />
    {/snippet}
    {#if frame.phase === 'confirming'}
      <AlertDialog.Root open>
        <AlertDialog.Content data-holo-panel data-panels-component="confirmation" onEscapeKeydown={(event) => { dismiss.onEscapeKeydown(event); if (!event.defaultPrevented) store.close() }} onInteractOutside={(event) => { dismiss.onInteractOutside(event); if (!event.defaultPrevented) store.close() }} onOpenAutoFocus={dismiss.onOpenAutoFocus}>
          <AlertDialog.Header><AlertDialog.Title id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</AlertDialog.Title><AlertDialog.Description>{frame.manifest.confirmation}</AlertDialog.Description></AlertDialog.Header>
          <AlertDialog.Footer><AlertDialog.Cancel onclick={() => store.close()}>{frame.manifest.modal?.cancelActionLabel ?? translate('actions.cancel')}</AlertDialog.Cancel><AlertDialog.Action variant={frame.manifest.color === 'danger' ? 'destructive' : 'default'} onclick={(event) => { event.preventDefault(); store.confirm(); if (!frame.manifest.modal) void submit() }}>{#if frame.manifest.icon}<Icon name={frame.manifest.icon} />{/if}{translate('actions.confirm')}</AlertDialog.Action></AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {:else if frame.manifest.modal?.slideOver}
      <Sheet.Root open onOpenChange={(open) => { if (!open) store.close() }}>
        <Sheet.Content {...dismiss} class={modalWidthClass(frame.manifest.modal?.width ?? 'medium')} data-holo-panel data-modal-width={frame.manifest.modal?.width ?? 'medium'} data-panels-component="slide-over">
          <Sheet.Header><Sheet.Title id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</Sheet.Title>{#if frame.manifest.modal?.description}<Sheet.Description>{frame.manifest.modal.description}</Sheet.Description>{/if}</Sheet.Header>
          <div class="hp:space-y-4 hp:p-4">{@render actionContent()}</div>
        </Sheet.Content>
      </Sheet.Root>
    {:else if frame.manifest.modal || frame.phase === 'ready' || frame.phase === 'collecting'}
      <Dialog.Root open onOpenChange={(open) => { if (!open) store.close() }}>
        <Dialog.Content {...dismiss} class={modalWidthClass(frame.manifest.modal?.width ?? 'medium')} data-holo-panel data-modal-width={frame.manifest.modal?.width ?? 'medium'} data-panels-component="modal">
          <Dialog.Header><Dialog.Title id={titleId}>{frame.manifest.modal?.heading ?? frame.manifest.label}</Dialog.Title>{#if frame.manifest.modal?.description}<Dialog.Description>{frame.manifest.modal.description}</Dialog.Description>{/if}</Dialog.Header>
          {@render actionContent()}
        </Dialog.Content>
      </Dialog.Root>
    {/if}
  {/each}
</div>
