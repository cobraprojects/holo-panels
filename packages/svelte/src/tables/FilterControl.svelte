<script lang="ts">
  import Button from '../components/Button.svelte'
  import Input from '../components/Input.svelte'
  import Select from '../components/Select.svelte'
  import type { Component } from 'svelte'
  import type { JsonValue } from '@holo-js/panels-client'
  import type { SvelteComponentRegistry } from '../registry'
  import { filterLayoutStyle } from './helpers'
  import type { SvelteCustomFilterProps, SvelteTableFilter, SvelteTableFilterOption } from './types'

  let {
    filter,
    panelId,
    registry,
    update,
    value,
  }: {
    readonly filter: SvelteTableFilter
    readonly panelId?: string
    readonly registry?: SvelteComponentRegistry
    readonly update: (value: JsonValue) => void
    readonly value: JsonValue
  } = $props()

  const id = $props.id()
  const layout = $derived(filter.manifest.layout ?? {})
  const range = $derived(dateRange(value))
  const multiple = $derived(filter.manifest.properties.multiple === true)
  const selectedValues = $derived(Array.isArray(value) ? value.map(String) : [String(value ?? '')])
  const columns = $derived(Array.isArray(filter.manifest.properties.columns)
    ? filter.manifest.properties.columns.filter((column): column is Readonly<Record<string, unknown>> => typeof column === 'object' && column !== null && !Array.isArray(column))
    : [])
  const conditions = $derived(typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray(value.conditions) ? value.conditions : [])
  const CustomFilter = $derived.by((): Component<SvelteCustomFilterProps> | undefined => {
    if (filter.manifest.type !== 'custom' && !filter.manifest.type.includes(':filter:')) return undefined
    if (!registry) throw new Error(`[Holo Panels] A Svelte component registry is required for filter "${filter.manifest.id}".`)
    const name = filter.manifest.type === 'custom' ? 'filter.custom' : `filter.${filter.manifest.type.replaceAll(':', '.')}`
    return registry.resolve<SvelteCustomFilterProps>(name, panelId, `filter "${filter.manifest.id}"`)
  })

  function dateRange(input: JsonValue): { readonly from: string, readonly to: string } {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return { from: '', to: '' }
    return {
      from: typeof input.from === 'string' ? input.from : '',
      to: typeof input.to === 'string' ? input.to : '',
    }
  }

  function selectedOption(raw: string): SvelteTableFilterOption | undefined {
    return filter.options?.find(option => String(option.value ?? '') === raw)
  }

  function updateSelect(element: HTMLSelectElement): void {
    if (multiple) {
      update(Array.from(element.selectedOptions).map(option => selectedOption(option.value)?.value ?? null))
      return
    }
    update(selectedOption(element.value)?.value ?? null)
  }

  function changeCondition(index: number, name: 'column' | 'operator' | 'value', next: JsonValue): void {
    update({
      conditions: conditions.map((condition, conditionIndex) => conditionIndex === index && typeof condition === 'object' && condition !== null && !Array.isArray(condition)
        ? { ...condition, [name]: next }
        : condition),
    })
  }

  function removeCondition(index: number): void {
    update({ conditions: conditions.filter((_, conditionIndex) => conditionIndex !== index) })
  }

  function addCondition(): void {
    const column = columns[0]
    const operator = Array.isArray(column?.operators) ? column.operators.find(item => typeof item === 'string') : undefined
    if (typeof column?.id !== 'string' || typeof operator !== 'string') return
    update({ conditions: [...conditions, { column: column.id, operator, value: null }] })
  }

  function advancedInputValue(raw: string, scalarType: string, operator: string): JsonValue {
    const values = ['between', 'in', 'not-in'].includes(operator) ? raw.split(',').map(value => value.trim()).filter(Boolean) : [raw]
    const parsed = values.map(value => scalarType === 'number'
      ? Number.isFinite(Number(value)) ? Number(value) : value
      : scalarType === 'boolean' ? value === 'true' : value)
    return ['between', 'in', 'not-in'].includes(operator) ? parsed : parsed[0] ?? null
  }
</script>

<div
  data-filter-column-span={layout.columnSpan ? JSON.stringify(layout.columnSpan) : undefined}
  data-filter-column-start={layout.columnStart ? JSON.stringify(layout.columnStart) : undefined}
  style={filterLayoutStyle(layout)}
>
  {#if filter.manifest.type === 'date-range'}
    <fieldset>
      <legend>{filter.manifest.label ?? filter.manifest.id}</legend>
      <label for={`${id}-from`}>From<Input id={`${id}-from`} type="date" value={range.from} oninput={(event) => update({ from: event.currentTarget.value || null, to: range.to || null })} /></label>
      <label for={`${id}-to`}>To<Input id={`${id}-to`} type="date" value={range.to} oninput={(event) => update({ from: range.from || null, to: event.currentTarget.value || null })} /></label>
    </fieldset>
  {:else if filter.manifest.type === 'ternary'}
    <label for={id}>{filter.manifest.label ?? filter.manifest.id}</label>
    <Select {id} value={typeof value === 'string' ? value : 'all'} onchange={(event) => update(event.currentTarget.value)}>
      <option value="all">All</option><option value="true">Yes</option><option value="false">No</option>
    </Select>
  {:else if filter.manifest.type === 'trashed'}
    <label for={id}>{filter.manifest.label ?? filter.manifest.id}</label>
    <Select {id} value={typeof value === 'string' ? value : 'without'} onchange={(event) => update(event.currentTarget.value)}>
      <option value="without">Without trashed</option><option value="with">With trashed</option><option value="only">Only trashed</option>
    </Select>
  {:else if filter.manifest.type === 'advanced-query'}
    <fieldset>
      <legend>{filter.manifest.label ?? filter.manifest.id}</legend>
      {#each conditions as condition, index (index)}
        {#if typeof condition === 'object' && condition !== null && !Array.isArray(condition)}
          {@const columnId = typeof condition.column === 'string' ? condition.column : ''}
          {@const column = columns.find(item => item.id === columnId)}
          {@const operators = Array.isArray(column?.operators) ? column.operators.filter((item): item is string => typeof item === 'string') : []}
          {@const operator = typeof condition.operator === 'string' ? condition.operator : ''}
          {@const scalarType = typeof column?.scalarType === 'string' ? column.scalarType : 'string'}
          {@const inputValue = Array.isArray(condition.value) ? condition.value.join(', ') : typeof condition.value === 'string' || typeof condition.value === 'number' ? String(condition.value) : ''}
          <div data-advanced-condition>
            <Select aria-label="Column" value={columnId} onchange={(event) => changeCondition(index, 'column', event.currentTarget.value)}>{#each columns as item (String(item.id))}<option value={String(item.id)}>{String(item.id)}</option>{/each}</Select>
            <Select aria-label="Operator" value={operator} onchange={(event) => changeCondition(index, 'operator', event.currentTarget.value)}>{#each operators as item (item)}<option value={item}>{item}</option>{/each}</Select>
            {#if !['null', 'not-null'].includes(operator)}<Input aria-label="Value" type={scalarType === 'number' ? 'number' : scalarType === 'date' ? 'date' : 'text'} value={inputValue} oninput={(event) => changeCondition(index, 'value', advancedInputValue(event.currentTarget.value, scalarType, operator))} />{/if}
            <Button type="button" onclick={() => removeCondition(index)}>Remove condition</Button>
          </div>
        {/if}
      {/each}
      <Button type="button" disabled={columns.length === 0} onclick={addCondition}>Add condition</Button>
    </fieldset>
  {:else if CustomFilter}
    <CustomFilter {filter} {update} {value} />
  {:else if filter.options}
    <label for={id}>{filter.manifest.label ?? filter.manifest.id}</label>
    <Select {id} {multiple} value={multiple ? selectedValues : selectedValues[0]} onchange={(event) => updateSelect(event.currentTarget)}>
      {#if !multiple}<option value="">All</option>{/if}
      {#each filter.options as option (String(option.value))}<option value={String(option.value ?? '')} disabled={option.disabled}>{option.label}</option>{/each}
    </Select>
  {:else if filter.manifest.type.includes('boolean') || typeof value === 'boolean'}
    <label for={id}>{filter.manifest.label ?? filter.manifest.id}</label>
    <Input {id} type="checkbox" checked={value === true} onchange={(event) => update(event.currentTarget.checked)} />
  {:else}
    <label for={id}>{filter.manifest.label ?? filter.manifest.id}</label>
    <Input {id} type="search" value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''} oninput={(event) => update(event.currentTarget.value)} />
  {/if}
</div>
