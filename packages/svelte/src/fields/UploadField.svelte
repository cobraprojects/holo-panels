<script lang="ts">
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
      <div aria-live="polite" data-panels-upload-list>
        {#each $uploadState?.items ?? [] as item, index (item.id)}
          <article data-upload-id={item.id}>
            {#if item.previewUrl}<img src={item.previewUrl} alt="Preview of {item.name}" />{/if}
            <span>{item.name}</span>
            <Progress max={1} value={item.progress} aria-label="Upload progress for {item.name}" />
            <span>{item.status}</span>
            {#if item.error}<span role="alert">{item.error}</span>{/if}
            <Button type="button" aria-label="Move {item.name} up" disabled={presentation.disabled || presentation.readOnly || index === 0} onclick={() => uploadStore?.reorder(index, index - 1)}>Move up</Button>
            <Button type="button" aria-label="Move {item.name} down" disabled={presentation.disabled || presentation.readOnly || index === ($uploadState?.items.length ?? 0) - 1} onclick={() => uploadStore?.reorder(index, index + 1)}>Move down</Button>
            <Button type="button" aria-label="{item.status === 'pending' || item.status === 'uploading' ? 'Cancel' : 'Remove'} {item.name}" disabled={presentation.disabled || presentation.readOnly} onclick={() => void uploadStore?.remove(item.id)}>{item.status === 'pending' || item.status === 'uploading' ? 'Cancel' : 'Remove'}</Button>
          </article>
        {/each}
      </div>
    {/snippet}
  </FieldFrame>
{/if}
