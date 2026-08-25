<script lang="ts">
  import { Button } from '../ui/button'
  import { Checkbox } from '../ui/checkbox'
  import Icon from '../components/Icon.svelte'
  import { Input } from '../ui/input'
  import { NativeSelect as Select } from '../ui/native-select'
  import { Textarea } from '../ui/textarea'
  import { createClientRelationLayout, publishPanelError, type ClientRelationManager, type ClientRelationOption, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
  import { builtInActionPresentation } from '@holo-js/panels-core'
  import * as AlertDialog from '../ui/alert-dialog'
  import { Badge } from '../ui/badge'
  import * as Card from '../ui/card'
  import * as Dialog from '../ui/dialog'
  import * as Empty from '../ui/empty'
  import * as Tabs from '../ui/tabs'
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
  }

  $effect(() => {
    const current = mounted
    const search = optionSearch
    if (!current || !['associate', 'attach'].includes(current.operation) || !relations.loadOptions) return
    let active = true
    void relations.loadOptions(current.manager.id, search).then(result => { if (active) options = result }).catch(() => { if (active) publishPanelError(relations.panelId ?? 'default', 'Related records could not be loaded') })
    return () => { active = false }
  })

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const current = mounted
    if (!current || !relations.onOperation) return
    submitting = true
    const fields = ['attach', 'editPivot'].includes(current.operation) ? current.manager.pivotFields ?? [] : ['create', 'edit'].includes(current.operation) ? current.manager.fields ?? [] : []
    const selectsRecord = current.operation === 'associate' || current.operation === 'attach'
    try {
      const selectedId = selectsRecord ? typeof relatedId === 'string' ? relatedId.trim() : relatedId : current.record?.id
      const request: SvelteRelationOperationRequest = {
        managerId: current.manager.id,
        operation: current.operation,
        ...(current.operation === 'editPivot' || current.operation === 'attach' ? { pivot: values } : fields.length > 0 ? { values } : {}),
        ...(selectedId ? { recordId: selectedId } : {}),
      }
      await relations.onOperation(request)
      mounted = null
    } catch {
      publishPanelError(relations.panelId ?? 'default', `${operationLabel(current.operation)} failed`)
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
  <Card.Root aria-label={manager.label} class="hp-relation-manager" data-empty={manager.records.length === 0 || undefined} data-relation-manager={manager.id} role="region">
    <Card.Header class="hp:flex-row hp:items-center hp:gap-3" data-slot="relation-manager-header">
      <Card.Title class="hp:flex-1" data-slot="relation-manager-title">{manager.label}</Card.Title>
      {#if manager.badge !== null}<Badge aria-label={`${String(manager.badge)} ${manager.label.toLocaleLowerCase()}`} class="hp-relation-badge hp-relation-manager-count" data-slot="relation-manager-count" variant="secondary">{manager.badge}</Badge>{/if}
    </Card.Header>
    <Card.Content class="hp:space-y-4">
    {#if managerActions.length > 0}
      <div aria-label={`${manager.label} actions`} class="hp-relation-actions hp-relation-toolbar" data-slot="relation-toolbar" role="group">
        {#each managerActions as operation (operation)}
          {@const presentation = builtInActionPresentation(operation)}
          <Button class="hp-action-trigger" data-color={presentation?.color ?? undefined} data-operation={operation} variant={presentation?.destructive ? 'destructive' : 'outline'} type="button" onclick={() => mount(manager, operation)}>{#if presentation}<Icon name={presentation.icon} />{/if}<span>{operationLabel(operation)}</span></Button>
        {/each}
      </div>
    {/if}
    {#if manager.records.length === 0}
      <Empty.Root class="hp-relation-empty hp:min-h-40 hp:border" data-slot="table-empty"><Empty.Header><Empty.Title>No records</Empty.Title><Empty.Description>{manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`}</Empty.Description></Empty.Header></Empty.Root>
    {:else}
      {@const tableColumns = manager.columns.map(column => ({ key: column.key, label: column.label }))}
      {#snippet relationCell(record: Readonly<ClientRelationRecord>, column: { readonly key: string })}
        {display(record.values[column.key])}
      {/snippet}
      {#snippet relationTrailing(record: Readonly<ClientRelationRecord>)}
        <div aria-label={`Actions for ${manager.label.toLocaleLowerCase()} record ${String(record.id)}`} class="hp-relation-row-actions" data-slot="relation-row-actions" role="group">
          {#each recordActions as operation (operation)}
            {@const presentation = builtInActionPresentation(operation)}
            <Button class="hp-action-trigger" data-color={presentation?.color ?? undefined} data-operation={operation} variant={presentation?.destructive ? 'destructive' : 'outline'} type="button" onclick={() => mount(manager, operation, record)}>{#if presentation}<Icon name={presentation.icon} />{/if}<span>{operationLabel(operation)}</span></Button>
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
    </Card.Content>
  </Card.Root>
{/snippet}

<div class="hp-relations" data-panels-component="relation-managers">
  {#each layout.inline as manager (manager.id)}{@render panel(manager)}{/each}
  {#each layout.tabGroups as group (group.id)}
    <section aria-label={group.label ?? 'Related records'} class="hp-relation-tabs">
      {#if group.label}<h2>{group.label}</h2>{/if}
      <Tabs.Root value={group.activeId} onValueChange={(value) => select(group.id, value)}>
      <Tabs.List aria-label={group.label ?? 'Related records'}>
        {#each group.managers as manager (manager.id)}
          <Tabs.Trigger value={manager.id}>{manager.label}{#if manager.badge !== null}<Badge variant="secondary">{manager.badge}</Badge>{/if}</Tabs.Trigger>
        {/each}
      </Tabs.List>
      {#each group.managers as manager (manager.id)}
        <Tabs.Content value={manager.id}>{@render panel(manager)}</Tabs.Content>
      {/each}
      </Tabs.Root>
    </section>
  {/each}
  {#if layout.pages.length > 0}
    <nav aria-label="Related record pages" class="hp-relation-pages">
      {#each layout.pages as manager (manager.id)}<a href={manager.url ?? '/'}>{manager.label}{manager.badge !== null ? ` (${manager.badge})` : ''}</a>{/each}
    </nav>
  {/if}
  {#if mounted && relations.onOperation}
    {@const current = mounted}
    {@const fields = ['attach', 'editPivot'].includes(current.operation) ? current.manager.pivotFields ?? [] : ['create', 'edit'].includes(current.operation) ? current.manager.fields ?? [] : []}
    {@const selectsRecord = current.operation === 'associate' || current.operation === 'attach'}
    {@const destructive = ['delete', 'detach', 'dissociate'].includes(current.operation)}
    {@const presentation = builtInActionPresentation(current.operation)}
    {#snippet relationContent()}
      {#if current.operation === 'view'}
        <article class="hp-relation-dialog hp-relation-operation-form hp:space-y-4" data-slot="relation-dialog">
          <div class="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
            <dl class="hp-infolist">{#each current.manager.columns as column (column.key)}<div><dt>{column.label}</dt><dd>{display(current.record?.values[column.key])}</dd></div>{/each}</dl>
          </div>
          <Dialog.Footer data-slot="relation-dialog-footer"><Button onclick={() => { mounted = null }} type="button" variant="outline">Close</Button></Dialog.Footer>
        </article>
      {:else}<form aria-busy={submitting} class="hp-relation-dialog hp-relation-operation-form hp:space-y-4" data-pending={submitting || undefined} data-slot="relation-dialog" onsubmit={(event) => void submit(event)}>
        <div class="hp-relation-dialog-body hp-relation-operation-form" data-slot="relation-dialog-body">
          {#if selectsRecord}
            {#if relations.loadOptions}<label><span>Related record</span><Input aria-label="Search related records" bind:value={optionSearch} placeholder="Search…" /><Select aria-label="Related record" required value={String(relatedId)} onchange={(event) => { relatedId = options.find(option => String(option.value) === event.currentTarget.value)?.value ?? '' }}><option value="">Select a record</option>{#each options as option (option.value)}<option value={String(option.value)}>{option.label}</option>{/each}</Select></label>
            {:else}<label><span>Related record ID</span><Input bind:value={relatedId} required /></label>{/if}
          {/if}
          {#each fields as field (field.id)}
            <label><span>{field.label}</span>
              {#if field.type === 'textarea'}<Textarea required={field.required} value={String(values[field.id] ?? '')} oninput={(event) => { values = { ...values, [field.id]: event.currentTarget.value } }}></Textarea>
              {:else if field.type === 'toggle'}<Checkbox checked={values[field.id] === true} onCheckedChange={(checked) => { values = { ...values, [field.id]: checked } }} />
              {:else}<Input required={field.required} type={field.type === 'number' ? 'number' : field.type === 'date-time' ? 'datetime-local' : 'text'} value={String(values[field.id] ?? '')} oninput={(event) => { values = { ...values, [field.id]: field.type === 'number' ? event.currentTarget.valueAsNumber : event.currentTarget.value } }} />{/if}
            </label>
          {/each}
          {#if submitting}<p aria-live="polite" class="hp-relation-dialog-pending hp-visually-hidden" data-slot="relation-dialog-pending" role="status">{operationLabel(current.operation)} in progress</p>{/if}
        </div>
        <Dialog.Footer data-slot="relation-dialog-footer"><Button class="hp-action-trigger" disabled={submitting} onclick={() => { mounted = null }} type="button" variant="outline">Cancel</Button><Button aria-label={submitting ? `${operationLabel(current.operation)} in progress` : undefined} class="hp-action-trigger" data-color={presentation?.color ?? undefined} data-operation={current.operation} data-pending={submitting || undefined} variant={destructive ? 'destructive' : 'default'} disabled={submitting} type="submit">{#if presentation}<Icon name={presentation.icon} />{/if}<span>{submitting ? 'Working…' : operationLabel(current.operation)}</span></Button></Dialog.Footer>
      </form>{/if}
    {/snippet}
    {#if destructive}
      <AlertDialog.Root open onOpenChange={(open) => { if (!open) mounted = null }}>
        <AlertDialog.Content data-holo-panel><AlertDialog.Header data-slot="relation-dialog-header"><AlertDialog.Title id={`hp-relation-${current.manager.id}-${current.operation}`}>{operationLabel(current.operation)} {current.manager.label.toLocaleLowerCase()}</AlertDialog.Title><AlertDialog.Description>{presentation?.confirmation ?? 'Are you sure?'}</AlertDialog.Description></AlertDialog.Header>{@render relationContent()}</AlertDialog.Content>
      </AlertDialog.Root>
    {:else}
      <Dialog.Root open onOpenChange={(open) => { if (!open) mounted = null }}>
        <Dialog.Content data-holo-panel><Dialog.Header data-slot="relation-dialog-header"><Dialog.Title id={`hp-relation-${current.manager.id}-${current.operation}`}>{current.operation === 'view' ? 'View' : operationLabel(current.operation)} {current.manager.label.toLocaleLowerCase()}</Dialog.Title><Dialog.Description>{current.operation === 'view' ? `View this ${current.manager.label.toLocaleLowerCase()} record.` : `Complete the fields below to ${current.operation} this relationship.`}</Dialog.Description></Dialog.Header>{@render relationContent()}</Dialog.Content>
      </Dialog.Root>
    {/if}
  {/if}
</div>
