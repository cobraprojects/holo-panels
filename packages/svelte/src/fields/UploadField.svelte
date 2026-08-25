<script lang="ts">
  import { Button } from '../ui/button'
  import { Input } from '../ui/input'
  import { Progress } from '../ui/progress'
  import type { ClientUploadFile } from '@holo-js/panels-client'
  import { toSvelteState } from '../stores'
  import type { SvelteFieldRendererProps } from './contracts'
  import FieldFrame from './FieldFrame.svelte'
  import { fieldInputId, fieldPresentation, writeFieldValue } from './helpers'

  let { definition, form, uploadStore }: SvelteFieldRendererProps = $props()
  const formState = $derived.by(() => toSvelteState(form))
  const uploadState = $derived.by(() => uploadStore ? toSvelteState(uploadStore) : undefined)
  const presentation = $derived(fieldPresentation(definition, $formState))
  const inputId = $derived(fieldInputId(definition.path))

  function descriptors(): readonly Record<string, unknown>[] {
    return ($uploadState?.items ?? []).map(item => ({
      id: item.id,
      mimeType: item.mimeType,
      name: item.name,
      size: item.size,
      status: item.status,
      ...(item.token ? { token: item.token } : {}),
    }))
  }

  function sync(): void {
    writeFieldValue(form, definition.path, descriptors())
  }

  function choose(event: Event): void {
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []) as ClientUploadFile[]
    if (files.length === 0 || !uploadStore) return
    uploadStore.add(files)
    sync()
  }

  async function remove(id: string): Promise<void> {
    await uploadStore?.remove(id)
    sync()
  }

  function move(from: number, to: number): void {
    uploadStore?.reorder(from, to)
    sync()
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
            <Button type="button" disabled={presentation.disabled || presentation.readOnly || index === 0} onclick={() => move(index, index - 1)}>Move up</Button>
            <Button type="button" disabled={presentation.disabled || presentation.readOnly || index === ($uploadState?.items.length ?? 0) - 1} onclick={() => move(index, index + 1)}>Move down</Button>
            <Button type="button" disabled={presentation.disabled || presentation.readOnly} onclick={() => void remove(item.id)}>Remove</Button>
          </article>
        {/each}
      </div>
    {/snippet}
  </FieldFrame>
{/if}
