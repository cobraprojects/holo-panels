<script lang="ts">
  import { actionFormField, type DashboardFilterStore } from '@holo-js/panels-client'
  import { Button } from '../ui/button'
  import { type SvelteComponentRegistry } from '../registry'
  import { toSvelteState } from '../stores'
  import SchemaRenderer from '../schemas/SchemaRenderer.svelte'
  import FieldRenderer from '../fields/FieldRenderer.svelte'

  let { store, panelId, registry }: { readonly store: DashboardFilterStore, readonly panelId: string, readonly registry: SvelteComponentRegistry } = $props()
  const filterState = $derived.by(() => toSvelteState(store.form))
</script>

<form aria-label="Dashboard filters" class="hp-dashboard-filters hp:grid hp:gap-4" novalidate onsubmit={event => { event.preventDefault(); void store.submit() }}>
  <SchemaRenderer {panelId} {registry} schema={store.schema}>
    {#snippet renderContent({ component })}
      {@const definition = actionFormField(component)}
      {#if definition}<FieldRenderer definition={{ ...definition, helperText: definition.helperText ?? undefined, hint: definition.hint ?? undefined, placeholder: definition.placeholder ?? undefined }} form={store.form} optionStore={store.optionStore(definition)} {panelId} {registry} />{/if}
    {/snippet}
  </SchemaRenderer>
  <div class="hp:flex hp:gap-2"><Button disabled={$filterState.submitting} type="submit">Apply filters</Button><Button disabled={$filterState.submitting} onclick={() => void store.submit(true)} type="button" variant="outline">Reset filters</Button></div>
  {#each $filterState.errors._root ?? [] as message}<p role="alert">{message}</p>{/each}
</form>
