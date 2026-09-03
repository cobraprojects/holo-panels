<script lang="ts">
  import { usePanelLocale, usePanelTranslator } from '../localization'
  const locale = usePanelLocale()
  const translate = usePanelTranslator()
  import { Button } from '../ui/button'
  import { Input } from '../ui/input'
  import { Progress } from '../ui/progress'
  import type { ClientUploadFile } from '@holo-js/panels-client'
  import { toSvelteState } from '../stores'
  import type { SvelteFieldRendererProps } from './contracts'
  import FieldFrame from './FieldFrame.svelte'
  import { fieldInputId, fieldPresentation } from './helpers'

  let { definition, form, uploadStore }: SvelteFieldRendererProps = $props()
  const formState = $derived.by(() => toSvelteState(form))
  const uploadState = $derived.by(() => uploadStore ? toSvelteState(uploadStore) : undefined)
  const presentation = $derived(fieldPresentation(definition, $formState))
  const inputId = $derived(fieldInputId(definition.path))

  $effect(() => { uploadStore?.setLocale(locale()) })

  function choose(event: Event): void {
    const input = event.currentTarget as HTMLInputElement
    const files = Array.from(input.files ?? []) as ClientUploadFile[]
    if (files.length === 0 || !uploadStore) return
    uploadStore.add(files)
    input.value = ''
  }
</script>

{#if presentation.visible}
  <FieldFrame description={definition.helperText} errors={presentation.errors} hint={definition.hint} {inputId} label={definition.label} path={definition.path} required={presentation.required} type="file-upload">
    {#snippet children(attributes)}
      <Input {...attributes} type="file" multiple disabled={presentation.disabled || presentation.readOnly} required={presentation.required && ($uploadState?.items.length ?? 0) === 0} onchange={choose} />
      {#if $uploadState?.error}<p role="alert">{$uploadState.error}</p>{/if}
      <div aria-live="polite" data-panels-upload-list>
        {#each $uploadState?.items ?? [] as item, index (item.id)}
          <article data-upload-id={item.id}>
            {#if item.previewUrl}<img src={item.previewUrl} alt={translate('uploads.preview', { name: item.name })} />{/if}
            <span>{item.name}</span>
            <Progress max={1} value={item.progress} aria-label={translate('uploads.progress', { name: item.name })} />
            <span>{translate(`uploads.${item.status}`)}</span>
            {#if item.error}<span role="alert">{item.error}</span>{/if}
            <Button type="button" aria-label={translate('uploads.moveUp', { name: item.name })} disabled={presentation.disabled || presentation.readOnly || index === 0} onclick={() => uploadStore?.reorder(index, index - 1)}>{translate('uploads.up')}</Button>
            <Button type="button" aria-label={translate('uploads.moveDown', { name: item.name })} disabled={presentation.disabled || presentation.readOnly || index === ($uploadState?.items.length ?? 0) - 1} onclick={() => uploadStore?.reorder(index, index + 1)}>{translate('uploads.down')}</Button>
            <Button type="button" aria-label={translate(item.status === 'pending' || item.status === 'uploading' ? 'uploads.cancel' : 'uploads.remove', { name: item.name })} disabled={presentation.disabled || presentation.readOnly} onclick={() => void uploadStore?.remove(item.id)}>{item.status === 'pending' || item.status === 'uploading' ? translate('actions.cancel') : translate('fields.remove')}</Button>
          </article>
        {/each}
      </div>
    {/snippet}
  </FieldFrame>
{/if}
