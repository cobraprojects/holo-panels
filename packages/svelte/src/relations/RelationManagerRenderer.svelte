<script lang="ts">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import Select from '../components/Select.svelte'
  import Textarea from '../components/Textarea.svelte'
  import { createClientRelationLayout, type ClientRelationManager, type ClientRelationOption, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
  import Dialog from '../components/Dialog.svelte'
  import TablePresentation from '../tables/TablePresentation.svelte'
  import type { SvelteRelationManagerRendererProps, SvelteRelationOperationRequest } from './contracts'

  interface MountedOperation {
    readonly manager: ClientRelationManager
    readonly operation: RelationOperation
    readonly record?: ClientRelationRecord
  }

  let { relations }: { readonly relations: SvelteRelationManagerRendererProps } = $props()
  let selection = $state<Record<string, string | undefined>>({})
  let mounted = $state<MountedOperation | null>(null)
  let values = $state<Record<string, JsonValue>>({})
  let relatedId = $state<number | string>('')
  let optionSearch = $state('')
  let options = $state<readonly ClientRelationOption[]>([])
  let error = $state<string | null>(null)
  let submitting = $state(false)
  const layout = $derived(createClientRelationLayout(relations.managers, { ...(relations.selection ?? {}), ...selection }))
  const managerOperations: readonly RelationOperation[] = ['create', 'associate', 'attach']
  const recordOperations: readonly RelationOperation[] = ['view', 'edit', 'delete', 'dissociate', 'detach', 'editPivot']

  function operationLabel(operation: RelationOperation): string {
    return operation === 'editPivot' ? 'Edit pivot' : `${operation[0]?.toUpperCase() ?? ''}${operation.slice(1)}`
  }

  function display(value: JsonValue | undefined): string {
    if (value === null || typeof value === 'undefined') return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  function mount(manager: ClientRelationManager, operation: RelationOperation, record?: ClientRelationRecord): void {
    mounted = { manager, operation, ...(record ? { record } : {}) }
    const fields = operation === 'editPivot' || operation === 'attach'
      ? manager.pivotFields ?? []
      : operation === 'create' || operation === 'edit' ? manager.fields ?? [] : []
    const pivot = record?.values.pivot
    const pivotValues = pivot && !Array.isArray(pivot) && typeof pivot === 'object' ? pivot : {}
    values = Object.fromEntries(fields.map(field => [field.id, operation === 'editPivot' ? pivotValues[field.id] ?? '' : record?.values[field.id] ?? (field.type === 'toggle' ? false : '')]))
    relatedId = ''
    optionSearch = ''
    options = []
    error = null
  }

  $effect(() => {
    const current = mounted
    const search = optionSearch
    if (!current || !['associate', 'attach'].includes(current.operation) || !relations.loadOptions) return
    let active = true
    void relations.loadOptions(current.manager.id, search).then(result => { if (active) options = result }).catch(cause => { if (active) error = cause instanceof Error ? cause.message : 'Related records could not be loaded.' })
    return () => { active = false }
  })

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!mounted || !relations.onOperation) return
    submitting = true
    error = null
    const fields = ['attach', 'editPivot'].includes(mounted.operation) ? mounted.manager.pivotFields ?? [] : ['create', 'edit'].includes(mounted.operation) ? mounted.manager.fields ?? [] : []
    const selectsRecord = mounted.operation === 'associate' || mounted.operation === 'attach'
    try {
      const selectedId = selectsRecord ? typeof relatedId === 'string' ? relatedId.trim() : relatedId : mounted.record?.id
      const request: SvelteRelationOperationRequest = {
        managerId: mounted.manager.id,
        operation: mounted.operation,
        ...(mounted.operation === 'editPivot' || mounted.operation === 'attach' ? { pivot: values } : fields.length > 0 ? { values } : {}),
        ...(selectedId ? { recordId: selectedId } : {}),
      }
      await relations.onOperation(request)
      mounted = null
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'The relation operation failed.'
    } finally {
      submitting = false
    }
  }

  function select(groupId: string, managerId: string): void {
    selection = { ...selection, [groupId]: managerId }
    relations.onSelectionChange?.(groupId, managerId)
  }
</script>

{#snippet panel(manager: ClientRelationManager)}
  {@const managerActions = relations.onOperation ? managerOperations.filter(operation => manager.operations.includes(operation)) : []}
  {@const recordActions = relations.onOperation ? recordOperations.filter(operation => manager.operations.includes(operation)) : []}
  <section aria-label={manager.label} class="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id}>
    <header class="hp-relation-manager-header" data-slot="relation-manager-header">
      <h3 class="hp-relation-manager-title" data-slot="relation-manager-title">{manager.label}</h3>
      {#if manager.badge !== null}<span aria-label={`${String(manager.badge)} ${manager.label.toLocaleLowerCase()}`} class="hp-relation-badge hp-relation-manager-count" data-slot="relation-manager-count">{manager.badge}</span>{/if}
    </header>
    {#if managerActions.length > 0}
      <div aria-label={`${manager.label} actions`} class="hp-relation-actions hp-relation-toolbar" data-slot="relation-toolbar" role="group">
        {#each managerActions as operation (operation)}
          <Button data-operation={operation} type="button" onclick={() => mount(manager, operation)}>{operationLabel(operation)}</Button>
        {/each}
      </div>
    {/if}
    {#if manager.records.length === 0}
      <p class="hp-relation-empty hp-relation-loading-empty" data-slot="relation-loading-empty" role="status">{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</p>
    {:else}
      {@const tableColumns = manager.columns.map(column => ({ key: column.key, label: column.label }))}
      {#snippet relationCell(record: Readonly<ClientRelationRecord>, column: { readonly key: string })}
        {display(record.values[column.key])}
      {/snippet}
      {#snippet relationTrailing(record: Readonly<ClientRelationRecord>)}
        <div aria-label={`Actions for ${manager.label.toLocaleLowerCase()} record ${String(record.id)}`} class="hp-relation-row-actions" data-slot="relation-row-actions" role="group">
          {#each recordActions as operation (operation)}
            <Button data-operation={operation} type="button" onclick={() => mount(manager, operation, record)}>{operationLabel(operation)}</Button>
          {/each}
        </div>
      {/snippet}
      <TablePresentation
        caption={manager.label}
        cell={relationCell}
        columns={tableColumns}
        containerClass="hp-relation-table-overflow"
        getRecordId={(record) => record.id}
        records={manager.records}
        trailing={recordActions.length > 0 ? { cell: relationTrailing, label: 'Actions' } : undefined}
      />
    {/if}
  </section>
{/snippet}

<div class="hp-relations" data-panels-component="relation-managers">
  {#each layout.inline as manager (manager.id)}{@render panel(manager)}{/each}
  {#each layout.tabGroups as group (group.id)}
    <section aria-label={group.label ?? 'Related records'} class="hp-relation-tabs">
      {#if group.label}<h2>{group.label}</h2>{/if}
      <div aria-label={group.label ?? 'Related records'} role="tablist">
        {#each group.managers as manager (manager.id)}
          <Button aria-controls={`${group.id}-${manager.id}`} aria-selected={group.activeId === manager.id} id={`${group.id}-${manager.id}-tab`} onclick={() => select(group.id, manager.id)} role="tab" type="button">{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</Button>
        {/each}
      </div>
      {#each group.managers as manager (manager.id)}
        <div aria-labelledby={`${group.id}-${manager.id}-tab`} hidden={group.activeId !== manager.id} id={`${group.id}-${manager.id}`} role="tabpanel">{@render panel(manager)}</div>
      {/each}
    </section>
  {/each}
  {#if layout.pages.length > 0}
    <nav aria-label="Related record pages" class="hp-relation-pages">
      {#each layout.pages as manager (manager.id)}<a href={manager.url ?? '/'}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>{/each}
    </nav>
  {/if}
  {#if mounted && relations.onOperation}
    {@const fields = ['attach', 'editPivot'].includes(mounted.operation) ? mounted.manager.pivotFields ?? [] : ['create', 'edit'].includes(mounted.operation) ? mounted.manager.fields ?? [] : []}
    {@const selectsRecord = mounted.operation === 'associate' || mounted.operation === 'attach'}
    {@const destructive = ['delete', 'detach', 'dissociate'].includes(mounted.operation)}
    <Dialog labelledBy={`hp-relation-${mounted.manager.id}-${mounted.operation}`} onclose={() => { mounted = null }} open={true}>
      {#if mounted.operation === 'view'}
        <article class="hp-relation-dialog hp-relation-operation-form" data-slot="relation-dialog">
          <header class="hp-relation-dialog-header" data-slot="relation-dialog-header"><h2 id={`hp-relation-${mounted.manager.id}-${mounted.operation}`}>View {mounted.manager.label.toLocaleLowerCase()}</h2></header>
          <div class="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
            <dl class="hp-infolist">{#each mounted.manager.columns as column (column.key)}<div><dt>{column.label}</dt><dd>{display(mounted.record?.values[column.key])}</dd></div>{/each}</dl>
          </div>
          <footer class="hp-relation-dialog-footer" data-slot="relation-dialog-footer"><Button class="hp-button" onclick={() => { mounted = null }} type="button">Close</Button></footer>
        </article>
      {:else}<form aria-busy={submitting} class="hp-relation-dialog hp-relation-operation-form" data-pending={submitting || undefined} data-slot="relation-dialog" onsubmit={(event) => void submit(event)}>
        <header class="hp-relation-dialog-header" data-slot="relation-dialog-header"><h2 id={`hp-relation-${mounted.manager.id}-${mounted.operation}`}>{operationLabel(mounted.operation)} {mounted.manager.label.toLocaleLowerCase()}</h2><p>{destructive ? 'This action changes the relationship immediately.' : `Complete the fields below to ${mounted.operation} this relationship.`}</p></header>
        <div class="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
          {#if selectsRecord}
            {#if relations.loadOptions}<label><span>Related record</span><Input aria-label="Search related records" bind:value={optionSearch} placeholder="Search…" /><Select aria-label="Related record" required value={String(relatedId)} onchange={(event) => { relatedId = options.find(option => String(option.value) === event.currentTarget.value)?.value ?? '' }}><option value="">Select a record</option>{#each options as option (option.value)}<option value={String(option.value)}>{option.label}</option>{/each}</Select></label>
            {:else}<label><span>Related record ID</span><Input bind:value={relatedId} required /></label>{/if}
          {/if}
          {#each fields as field (field.id)}
            <label><span>{field.label}</span>
              {#if field.type === 'textarea'}<Textarea required={field.required} value={String(values[field.id] ?? '')} oninput={(event) => { values = { ...values, [field.id]: event.currentTarget.value } }}></Textarea>
              {:else if field.type === 'toggle'}<Input checked={values[field.id] === true} type="checkbox" onchange={(event) => { values = { ...values, [field.id]: event.currentTarget.checked } }} />
              {:else}<Input required={field.required} type={field.type === 'number' ? 'number' : field.type === 'date-time' ? 'datetime-local' : 'text'} value={String(values[field.id] ?? '')} oninput={(event) => { values = { ...values, [field.id]: field.type === 'number' ? event.currentTarget.valueAsNumber : event.currentTarget.value } }} />{/if}
            </label>
          {/each}
          {#if submitting}<p aria-live="polite" class="hp-relation-dialog-pending hp-visually-hidden" data-slot="relation-dialog-pending" role="status">{operationLabel(mounted.operation)} in progress</p>{/if}
          {#if error}<p class="hp-relation-dialog-error" data-slot="relation-dialog-error" role="alert">{error}</p>{/if}
        </div>
        <footer class="hp-relation-dialog-footer" data-slot="relation-dialog-footer"><Button disabled={submitting} onclick={() => { mounted = null }} type="button">Cancel</Button><Button aria-label={submitting ? `${operationLabel(mounted.operation)} in progress` : undefined} data-pending={submitting || undefined} disabled={submitting} type="submit">{submitting ? 'Working…' : operationLabel(mounted.operation)}</Button></footer>
      </form>{/if}
    </Dialog>
  {/if}
</div>
