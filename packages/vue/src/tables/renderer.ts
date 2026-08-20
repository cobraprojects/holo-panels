import { ShadcnButton, ShadcnIcon, ShadcnInput, ShadcnSelect } from '../internal-ui'
import { ClientTransferStore, type ClientTransferManifest, type FilterCollectionPresentation, type JsonValue, type TableRecordId, type TableState } from '@holo-js/panels-client'
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3, ListFilter, Search } from 'lucide-vue-next'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onScopeDispose,
  ref,
  shallowRef,
  useId,
  watch,
  type Component,
  type PropType,
  type Ref,
  type VNode,
  type VNodeChild,
} from 'vue'
import { displayValue, pages, paginationRange, perPageOptions, recordValue, visibleColumns } from './helpers'
import { PanelsModal } from '../primitives'
import { VueTableColumnPresentation, VueTablePresentation, type VueTablePresentationProps } from './presentation'
import type {
  VueTableAction,
  VueTableColumn,
  VueCustomFilterProps,
  VueTableFilter,
  VueTableRendererProps,
  VueFilterCollectionSlotProps,
} from './types'

type RuntimeRecord = Readonly<Record<string, unknown>>
type RuntimeTable = VueTableRendererProps<Record<string, unknown>, TableRecordId>

const filterBreakpoints = ['default', 'sm', 'md', 'lg', 'xl', '2xl'] as const

function filterCollectionStyle(columns: FilterCollectionPresentation['columns']): Record<string, number> {
  const style: Record<string, number> = {}
  for (const breakpoint of filterBreakpoints) {
    const value = columns[breakpoint]
    if (value !== undefined) style[`--hp-filter-columns-${breakpoint}`] = value
  }
  return style
}

function filterLayoutStyle(layout: NonNullable<VueTableFilter['manifest']['layout']>): Record<string, number | string> {
  const style: Record<string, number | string> = {}
  for (const breakpoint of filterBreakpoints) {
    const span = layout.columnSpan?.[breakpoint]
    const start = layout.columnStart?.[breakpoint]
    if (span !== undefined) style[`--hp-filter-column-span-${breakpoint}`] = span === 'full' ? '-1' : `span ${span}`
    if (start !== undefined) style[`--hp-filter-column-start-${breakpoint}`] = start
  }
  const defaultSpan = layout.columnSpan?.default
  if (defaultSpan !== undefined) style['--hp-filter-column-span'] = defaultSpan === 'full' ? '-1' : `span ${defaultSpan}`
  if (layout.columnStart?.default !== undefined) style['--hp-filter-column-start'] = layout.columnStart.default
  return style
}

function orderedFilters(filters: readonly VueTableFilter[], presentation: FilterCollectionPresentation | undefined): readonly VueTableFilter[] {
  const ids = presentation?.schema.components.flatMap(component => {
    const id = component.properties.leaf?.definition.id
    return typeof id === 'string' ? [id] : []
  }) ?? []
  if (ids.length === 0) return filters
  const byId = new Map(filters.map(filter => [filter.manifest.id, filter]))
  return [...ids.flatMap(id => byId.get(id) ? [byId.get(id) as VueTableFilter] : []), ...filters.filter(filter => !ids.includes(filter.manifest.id))]
}

function filterCollectionSlot(table: RuntimeTable, placement: VueFilterCollectionSlotProps['placement']): VNodeChild {
  const presentation = table.filterPresentation
  const references = presentation?.slots[placement] ?? []
  if (references.length === 0) return null
  if (!table.registry || !presentation) throw new Error(`[Holo Panels] A Vue component registry is required for table filter ${placement} content.`)
  return references.map(reference => h(table.registry?.resolve(reference.component, table.panelId, `table filter ${placement} content`) as Component, {
    ...reference.properties,
    key: `${reference.source}:${reference.order}:${reference.component}`,
    placement,
    presentation,
  }))
}

const VueTransferAction = defineComponent({
  props: {
    manifest: { type: Object as PropType<ClientTransferManifest>, required: true },
    table: { type: Object as PropType<RuntimeTable>, required: true },
  },
  setup(props) {
    const open = ref(false)
    const formatId = ref(props.manifest.formatIds[0] ?? '')
    const mappings = ref<Readonly<Record<string, string>>>({})
    const columns = ref(new Set(props.manifest.kind === 'export' ? props.manifest.columns.filter(column => column.visibleByDefault).map(column => column.id) : []))
    const store = props.table.transferTransport ? new ClientTransferStore(props.manifest, props.table.transferTransport) : null
    const state = shallowRef(store?.state)
    if (store) onScopeDispose(store.subscribe(next => { state.value = next }))
    async function submit(): Promise<void> {
      if (!store) return
      if (props.manifest.kind === 'import') await store.startImport(formatId.value, Object.entries(mappings.value).flatMap(([column, header]) => header ? [{ column, header }] : []))
      else await store.startExport(formatId.value, [...columns.value], props.table.store.selectionPayload())
    }
    return () => h('span', { class: 'hp-transfer-action' }, [
      h(ShadcnButton, { disabled: !store, type: 'button', onClick: () => { open.value = true } }, props.manifest.label),
      h(PanelsModal, { open: open.value, title: props.manifest.label, onClose: () => { store?.cancel(); open.value = false } }, { default: () => [
        h('label', ['Format', h(ShadcnSelect, { value: formatId.value, onChange: (event: Event) => { formatId.value = eventTarget<HTMLSelectElement>(event).value } }, props.manifest.formatIds.map(id => h('option', { value: id }, id.toUpperCase()))) ]),
        props.manifest.kind === 'import' ? h('div', [
          h('label', ['CSV file', h(ShadcnInput, { accept: '.csv,text/csv', type: 'file', onChange: (event: Event) => { const file = eventTarget<HTMLInputElement>(event).files?.[0]; if (file && store) void store.inspect(file).catch(() => undefined) } })]),
          ...(state.value?.inspection ? props.manifest.columns.map(column => h('label', [column.label, h(ShadcnSelect, { required: column.required, value: mappings.value[column.key] ?? '', onChange: (event: Event) => { mappings.value = { ...mappings.value, [column.key]: eventTarget<HTMLSelectElement>(event).value } } }, [h('option', { value: '' }, 'Do not import'), ...state.value!.inspection!.headers.map(header => h('option', { value: header }, header))])])) : []),
          state.value?.uploadProgress ? h('progress', { 'aria-label': 'Upload progress', max: 100, value: state.value.uploadProgress }) : null,
        ]) : h('div', props.manifest.columns.map(column => h('label', [h(ShadcnInput, { checked: columns.value.has(column.id), type: 'checkbox', onChange: (event: Event) => { const next = new Set(columns.value); if (eventTarget<HTMLInputElement>(event).checked) next.add(column.id); else next.delete(column.id); columns.value = next } }), column.label]))),
        h(ShadcnButton, { disabled: !store || (props.manifest.kind === 'import' && !state.value?.inspection), type: 'button', onClick: () => void submit().catch(() => undefined) }, `Start ${props.manifest.kind}`),
        state.value?.progress ? h('progress', { 'aria-label': 'Transfer progress', max: Math.max(1, state.value.progress.total), value: state.value.progress.completed }) : null,
        state.value?.error ? h('div', { role: 'alert' }, state.value.error) : null,
      ] }),
    ])
  },
})

function advancedFilter(filter: VueTableFilter, value: JsonValue, update: (value: JsonValue) => void): VNode {
  const columns = Array.isArray(filter.manifest.properties.columns)
    ? filter.manifest.properties.columns.filter((column): column is Readonly<Record<string, unknown>> => typeof column === 'object' && column !== null && !Array.isArray(column))
    : []
  const conditions = typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray(value.conditions) ? value.conditions : []
  const change = (index: number, name: 'column' | 'operator' | 'value', next: JsonValue): void => update({
    conditions: conditions.map((condition, conditionIndex) => conditionIndex === index && typeof condition === 'object' && condition !== null && !Array.isArray(condition)
      ? { ...condition, [name]: next }
      : condition),
  })
  return h('fieldset', [
    h('legend', filter.manifest.label ?? filter.manifest.id),
    ...conditions.map((condition, index) => {
      if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) return null
      const columnId = typeof condition.column === 'string' ? condition.column : ''
      const column = columns.find(item => item.id === columnId)
      const operators = Array.isArray(column?.operators) ? column.operators.filter((item): item is string => typeof item === 'string') : []
      const operator = typeof condition.operator === 'string' ? condition.operator : ''
      const scalarType = typeof column?.scalarType === 'string' ? column.scalarType : 'string'
      const inputValue = Array.isArray(condition.value) ? condition.value.join(', ') : typeof condition.value === 'string' || typeof condition.value === 'number' ? String(condition.value) : ''
      return h('div', { 'data-advanced-condition': '', key: index }, [
        h(ShadcnSelect, { 'aria-label': 'Column', value: columnId, onChange: (event: Event) => change(index, 'column', eventTarget<HTMLSelectElement>(event).value) }, columns.map(item => h('option', { key: String(item.id), value: String(item.id) }, String(item.id)))),
        h(ShadcnSelect, { 'aria-label': 'Operator', value: operator, onChange: (event: Event) => change(index, 'operator', eventTarget<HTMLSelectElement>(event).value) }, operators.map(item => h('option', { key: item, value: item }, item))),
        ['null', 'not-null'].includes(operator) ? null : h(ShadcnInput, { 'aria-label': 'Value', type: scalarType === 'number' ? 'number' : scalarType === 'date' ? 'date' : 'text', value: inputValue, onInput: (event: Event) => change(index, 'value', advancedInputValue(eventTarget<HTMLInputElement>(event).value, scalarType, operator)) }),
        h(ShadcnButton, { type: 'button', onClick: () => update({ conditions: conditions.filter((_, conditionIndex) => conditionIndex !== index) }) }, 'Remove condition'),
      ])
    }),
    h(ShadcnButton, {
      disabled: columns.length === 0,
      type: 'button',
      onClick: () => {
        const column = columns[0]
        const operator = Array.isArray(column?.operators) ? column.operators.find(item => typeof item === 'string') : undefined
        if (typeof column?.id !== 'string' || typeof operator !== 'string') return
        update({ conditions: [...conditions, { column: column.id, operator, value: null }] })
      },
    }, 'Add condition'),
  ])
}

function advancedInputValue(raw: string, scalarType: string, operator: string): JsonValue {
  const values = ['between', 'in', 'not-in'].includes(operator) ? raw.split(',').map(value => value.trim()).filter(Boolean) : [raw]
  const parsed = values.map(value => scalarType === 'number'
    ? Number.isFinite(Number(value)) ? Number(value) : value
    : scalarType === 'boolean' ? value === 'true' : value)
  return ['between', 'in', 'not-in'].includes(operator) ? parsed : parsed[0] ?? null
}

function runtimeTable(value: object): RuntimeTable {
  return value as RuntimeTable
}

function eventTarget<TElement extends EventTarget>(event: Event): TElement {
  return event.currentTarget as TElement
}

function notifyQueryChange(callback: (() => void) | undefined): void {
  callback?.()
}

const TableActionButton = defineComponent({
  name: 'VueTableActionButton',
  props: {
    action: { type: Object as PropType<VueTableAction>, required: true },
    record: { type: Object as PropType<RuntimeRecord>, default: undefined },
    table: { type: Object as PropType<object>, required: true },
  },
  setup(componentProps) {
    const pending = ref(false)
    const error = ref<string | null>(null)
    const run = async (): Promise<void> => {
      const table = runtimeTable(componentProps.table)
      if (!table.actionTransport) {
        error.value = '[Holo Panels] Vue table actions require an action transport.'
        return
      }
      if (componentProps.action.confirmation && typeof globalThis.confirm === 'function' && !globalThis.confirm(componentProps.action.confirmation)) return
      pending.value = true
      error.value = null
      try {
        await table.actionTransport.execute({
          actionId: componentProps.action.id,
          ...(componentProps.record ? { recordId: table.getRecordId(componentProps.record) } : {}),
          ...(componentProps.action.scope === 'bulk' ? { selection: table.store.selectionPayload() } : {}),
        }, new AbortController().signal)
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Action failed'
      } finally {
        pending.value = false
      }
    }
    return (): VNode => {
      const action = componentProps.action
      const inferredIcon = action.id.includes('delete') ? 'delete' : action.id.includes('edit') ? 'edit' : action.id.includes('view') ? 'view' : null
      const icon = action.icon ?? inferredIcon
      return h('span', [
      h(ShadcnButton, { class: 'hp-table-action', 'data-action': action.id, 'data-color': action.color ?? undefined, disabled: pending.value, type: 'button', onClick: () => void run() }, () => [icon ? ShadcnIcon(icon) : null, h('span', pending.value ? 'Working…' : action.label)]),
      error.value ? h('span', { role: 'alert' }, error.value) : null,
      ])
    }
  },
})

function optionValue(option: unknown): boolean | number | string | null | undefined {
  if (typeof option !== 'object' || option === null || Array.isArray(option)) return undefined
  const value: unknown = Reflect.get(option, 'value')
  return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value === null ? value : undefined
}

const InlineTableCell = defineComponent({
  name: 'VueInlineTableCell',
  props: {
    column: { type: Object as PropType<VueTableColumn<Record<string, unknown>>>, required: true },
    record: { type: Object as PropType<RuntimeRecord>, required: true },
    table: { type: Object as PropType<object>, required: true },
  },
  setup(componentProps) {
    const original = computed(() => recordValue(componentProps.record, componentProps.column.manifest.path))
    const editing = ref(false)
    const value = ref<boolean | number | string | null>(null)
    const pending = ref(false)
    const error = ref<string | null>(null)
    const input = ref<HTMLInputElement>()
    const begin = (): void => {
      const current = original.value
      value.value = typeof current === 'boolean' || typeof current === 'number' || typeof current === 'string' || current === null
        ? current
        : displayValue(current) === '—' ? '' : displayValue(current)
      error.value = null
      editing.value = true
    }
    watch(editing, async active => {
      if (!active) return
      await nextTick()
      input.value?.focus()
    })
    const save = async (next = value.value): Promise<void> => {
      const table = runtimeTable(componentProps.table)
      const editor = componentProps.column.manifest.inlineEditor
      const action = editor?.action
      if (typeof action !== 'string' || !table.inlineEditTransport) {
        error.value = '[Holo Panels] Inline editing requires a compiled action transport.'
        return
      }
      pending.value = true
      error.value = null
      try {
        await table.inlineEditTransport.execute({
          action,
          columnPath: componentProps.column.manifest.path,
          expectedVersion: table.getRecordVersion?.(componentProps.record) ?? null,
          recordId: table.getRecordId(componentProps.record),
          value: next,
        }, new AbortController().signal)
        editing.value = false
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Inline edit failed'
      } finally {
        pending.value = false
      }
    }
    return (): VNodeChild => {
      const column = componentProps.column
      const editor = column.manifest.inlineEditor
      const kind = editor?.kind
      const valid = typeof editor?.action === 'string' && ['checkbox', 'select', 'text-input', 'toggle'].includes(String(kind))
      const table = runtimeTable(componentProps.table)
      const rendered = h(VueTableColumnPresentation, { presentation: {
        column,
        panelId: table.panelId,
        record: componentProps.record,
        registry: table.registry,
        value: original.value,
      } })
      if (!valid) return rendered
      if (!editing.value) return h(ShadcnButton, { 'aria-label': `Edit ${column.manifest.label ?? column.manifest.path}`, type: 'button', onClick: begin }, () => [rendered])
      const label = column.manifest.label ?? column.manifest.path
      if (kind === 'checkbox' || kind === 'toggle') {
        return h('span', [
          h(ShadcnInput, {
            'aria-label': label,
            checked: value.value === true,
            disabled: pending.value,
            type: 'checkbox',
            onChange: (event: Event) => {
              const next = eventTarget<HTMLInputElement>(event).checked
              value.value = next
              void save(next)
            },
          }),
          error.value ? h('span', { role: 'alert' }, error.value) : null,
        ])
      }
      if (kind === 'select') {
        const options: readonly unknown[] = Array.isArray(editor.options) ? editor.options : []
        return h('span', [
          h(ShadcnSelect, {
            'aria-label': label,
            disabled: pending.value,
            value: String(value.value ?? ''),
            onChange: (event: Event) => {
              const raw = eventTarget<HTMLSelectElement>(event).value
              const next = options.map(optionValue).find(option => typeof option !== 'undefined' && String(option) === raw)
              if (typeof next === 'undefined') return
              value.value = next
              void save(next)
            },
          }, options.map((option, index) => {
            const next = optionValue(option)
            if (typeof next === 'undefined') return null
            const labelValue = typeof option === 'object' && option !== null ? Reflect.get(option, 'label') : null
            return h('option', {
              disabled: typeof option === 'object' && option !== null && Reflect.get(option, 'disabled') === true,
              key: String(next),
              value: String(next ?? ''),
            }, typeof labelValue === 'string' ? labelValue : `Option ${index + 1}`)
          })),
          error.value ? h('span', { role: 'alert' }, error.value) : null,
        ])
      }
      return h('span', [
        h(ShadcnInput, {
          'aria-label': label,
          disabled: pending.value,
          ref: input,
          value: String(value.value ?? ''),
          onInput: (event: Event) => {
            value.value = eventTarget<HTMLInputElement>(event).value
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
              editing.value = false
              error.value = null
            } else if (event.key === 'Enter') {
              event.preventDefault()
              void save()
            }
          },
        }),
        error.value ? h('span', { role: 'alert' }, error.value) : null,
      ])
    }
  },
})

function tableFilters(
  table: RuntimeTable,
  state: TableState<Record<string, unknown>, TableRecordId>,
  idPrefix: string,
  open: Ref<boolean>,
): VNodeChild {
  const filters = table.filters ?? []
  if (filters.length === 0) return null
  const presentation = table.filterPresentation
  const placement = presentation?.placement ?? 'inline'
  const field = (filter: VueTableFilter): VNode => {
    const id = `${idPrefix}-${filter.manifest.id}`
    const current = state.filters.draft[filter.manifest.id] ?? filter.manifest.defaultValue
    const update = (next: JsonValue): void => {
      const setFilter: unknown = Reflect.get(table.store, 'setFilter')
      if (typeof setFilter !== 'function') throw new Error('[Holo Panels] Vue table filters require a compatible table store.')
      Reflect.apply(setFilter, table.store, [filter.manifest.id, next])
      if (state.filters.mode === 'live') notifyQueryChange(table.onQueryChange)
    }
    const layout = filter.manifest.layout ?? {}
    const wrap = (control: VNodeChild): VNode => h('div', {
      'data-filter-column-span': layout.columnSpan ? JSON.stringify(layout.columnSpan) : undefined,
      'data-filter-column-start': layout.columnStart ? JSON.stringify(layout.columnStart) : undefined,
      key: filter.manifest.id,
      style: filterLayoutStyle(layout),
    }, [control])
    if (filter.manifest.type === 'date-range') {
      const range = typeof current === 'object' && current !== null && !Array.isArray(current) ? current : {}
      const from = typeof Reflect.get(range, 'from') === 'string' ? String(Reflect.get(range, 'from')) : ''
      const to = typeof Reflect.get(range, 'to') === 'string' ? String(Reflect.get(range, 'to')) : ''
      return wrap(h('fieldset', [
        h('legend', filter.manifest.label ?? filter.manifest.id),
        h('label', { for: `${id}-from` }, ['From', h(ShadcnInput, {
          id: `${id}-from`,
          type: 'date',
          value: from,
          onInput: (event: Event) => update({ from: eventTarget<HTMLInputElement>(event).value || null, to: to || null }),
        })]),
        h('label', { for: `${id}-to` }, ['To', h(ShadcnInput, {
          id: `${id}-to`,
          type: 'date',
          value: to,
          onInput: (event: Event) => update({ from: from || null, to: eventTarget<HTMLInputElement>(event).value || null }),
        })]),
      ]))
    }
    if (filter.manifest.type === 'ternary') {
      return wrap(h('label', { for: id }, [filter.manifest.label ?? filter.manifest.id, h(ShadcnSelect, {
        id,
        value: typeof current === 'string' ? current : 'all',
        onChange: (event: Event) => update(eventTarget<HTMLSelectElement>(event).value),
      }, [h('option', { value: 'all' }, 'All'), h('option', { value: 'true' }, 'Yes'), h('option', { value: 'false' }, 'No')])]))
    }
    if (filter.manifest.type === 'trashed') {
      return wrap(h('label', { for: id }, [filter.manifest.label ?? filter.manifest.id, h(ShadcnSelect, {
        id,
        value: typeof current === 'string' ? current : 'without',
        onChange: (event: Event) => update(eventTarget<HTMLSelectElement>(event).value),
      }, [h('option', { value: 'without' }, 'Without trashed'), h('option', { value: 'with' }, 'With trashed'), h('option', { value: 'only' }, 'Only trashed')])]))
    }
    if (filter.manifest.type === 'advanced-query') return wrap(advancedFilter(filter, current, update))
    if (filter.manifest.type === 'custom' || filter.manifest.type.includes(':filter:')) {
      if (!table.registry) throw new Error(`[Holo Panels] A Vue component registry is required for filter "${filter.manifest.id}".`)
      const name = filter.manifest.type === 'custom' ? 'filter.custom' : `filter.${filter.manifest.type.replaceAll(':', '.')}`
      const Renderer = table.registry.resolve(name, table.panelId, `filter "${filter.manifest.id}"`)
      const customProps: VueCustomFilterProps = { filter, update, value: current }
      return wrap(h(Renderer, customProps))
    }
    const multiple = filter.manifest.properties.multiple === true
    const selectedValues = Array.isArray(current) ? current.map(String) : [String(current ?? '')]
    const control = filter.options
      ? h(ShadcnSelect, {
          id,
          multiple,
          value: multiple ? selectedValues : selectedValues[0],
          onChange: (event: Event) => {
            const select = eventTarget<HTMLSelectElement>(event)
            if (multiple) {
              update(Array.from(select.selectedOptions).map(selected => filter.options?.find(option => String(option.value ?? '') === selected.value)?.value ?? null))
              return
            }
            update(filter.options?.find(option => String(option.value ?? '') === select.value)?.value ?? null)
          },
        }, [
          ...(!multiple ? [h('option', { key: 'all', value: '' }, 'All')] : []),
          ...filter.options.map(option => h('option', { disabled: option.disabled, key: String(option.value), value: String(option.value ?? '') }, option.label)),
        ])
      : filter.manifest.type.includes('boolean') || typeof current === 'boolean'
        ? h(ShadcnInput, { checked: current === true, id, type: 'checkbox', onChange: (event: Event) => update(eventTarget<HTMLInputElement>(event).checked) })
        : h(ShadcnInput, {
            id,
            type: 'search',
            value: typeof current === 'number' || typeof current === 'string' ? String(current) : '',
            onInput: (event: Event) => update(eventTarget<HTMLInputElement>(event).value),
          })
    return wrap(h('label', { for: id }, [filter.manifest.label ?? filter.manifest.id, control]))
  }
  const content = h('form', {
    'aria-label': 'Table filters',
    class: 'hp-table-filters',
    'data-filter-placement': placement,
    style: filterCollectionStyle(presentation?.columns ?? { default: 1 }),
    onSubmit: (event: Event) => {
      event.preventDefault()
      table.store.applyDeferredFilters()
      notifyQueryChange(table.onQueryChange)
    },
  }, [
    filterCollectionSlot(table, 'before'),
    ...orderedFilters(filters, presentation).map(field),
    state.filters.mode === 'deferred' ? h(ShadcnButton, { type: 'submit' }, 'Apply filters') : null,
    h(ShadcnButton, {
      type: 'button',
      onClick: () => {
        table.store.resetFilters()
        notifyQueryChange(table.onQueryChange)
      },
    }, 'Reset filters'),
    filterCollectionSlot(table, 'after'),
  ])
  if (placement === 'inline') return content
  const trigger = h(ShadcnButton, {
    'aria-expanded': String(open.value),
    'aria-haspopup': 'dialog',
    type: 'button',
    onClick: () => { open.value = !open.value },
  }, [h(ListFilter, { 'aria-hidden': 'true' }), 'Filters'])
  if (placement === 'dropdown') return h('div', { class: 'hp-table-filters-dropdown' }, [trigger, open.value ? h('div', { role: 'dialog' }, [content]) : null])
  return [trigger, h(PanelsModal, { open: open.value, title: 'Filters', onClose: () => { open.value = false } }, { default: () => [content] })]
}

export const VueTableRenderer = defineComponent({
  name: 'VueTableRenderer',
  props: {
    table: { type: Object as PropType<object>, required: true },
  },
  setup(componentProps) {
    const table = runtimeTable(componentProps.table)
    const state = shallowRef(table.store.snapshot)
    onScopeDispose(table.store.subscribe(next => {
      state.value = next
    }))
    const captionId = useId()
    const filterPrefix = `${captionId}-filter`
    const columnsOpen = ref(false)
    const filtersOpen = ref(false)
    const collapsedGroups = ref<ReadonlySet<string>>(new Set(table.groups?.filter(group => group.collapsed).map(group => group.key)))
    const toggleGroup = (key: string): void => {
      const next = new Set(collapsedGroups.value)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      collapsedGroups.value = next
    }
    return (): VNode => {
      const snapshot = state.value
      const columns = visibleColumns(table, snapshot.visibleColumns)
      const recordIds = snapshot.records.map(table.getRecordId)
      const selectedOnPage = recordIds.length > 0 && recordIds.every(recordId => table.store.isSelected(recordId))
      const pageCount = pages(snapshot.total, snapshot.perPage)
      const paginationItems = paginationRange(snapshot.page, pageCount)
      const paginationFrom = snapshot.total === 0 ? 0 : (snapshot.page - 1) * snapshot.perPage + 1
      const paginationTo = Math.min(snapshot.page * snapshot.perPage, snapshot.total)
      const headerActions = table.actions?.filter(action => action.scope === 'header') ?? []
      const bulkActions = table.actions?.filter(action => action.scope === 'bulk') ?? []
      const rowActions = table.actions?.filter(action => action.scope === 'row') ?? []
      const selectable = bulkActions.length > 0 || (table.transfers?.some(transfer => transfer.kind === 'export') ?? false)
      const hasSelection = selectable && (snapshot.selection.mode === 'all-matching' || snapshot.selection.selectedRecordIds.length > 0)
      const currentColumns = snapshot.visibleColumns.length > 0
        ? new Set(snapshot.visibleColumns)
        : new Set(table.columns.filter(column => !column.manifest.hidden).map(column => column.manifest.path))
      const sort = (column: VueTableColumn<Record<string, unknown>>): void => {
        if (!column.manifest.sortable) return
        const active = snapshot.sort.find(item => item.column === column.manifest.path)
        table.store.setSort([{ column: column.manifest.path, direction: active?.direction === 'asc' ? 'desc' : 'asc' }])
        notifyQueryChange(table.onQueryChange)
      }
      const tablePresentation: VueTablePresentationProps<RuntimeRecord> = {
        ariaLabel: `${table.caption} data`,
        caption: table.caption,
        columns: columns.map(column => {
          const active = snapshot.sort.find(item => item.column === column.manifest.path)
          const label = column.manifest.label ?? column.manifest.path
          return {
            alignment: column.manifest.alignment,
            ariaSort: active?.direction === 'asc' ? 'ascending' : active?.direction === 'desc' ? 'descending' : 'none',
            header: column.manifest.sortable
              ? h(ShadcnButton, {
                  class: 'hp-table-sort',
                  'data-sorted': active?.direction,
                  type: 'button',
                  onClick: () => sort(column),
                }, () => [label, h(active?.direction === 'asc' ? ChevronUp : active?.direction === 'desc' ? ChevronDown : ArrowUpDown, {
                  'aria-hidden': 'true',
                  'data-icon': active?.direction === 'asc' ? 'chevron-up' : active?.direction === 'desc' ? 'chevron-down' : 'sort',
                  'data-slot': 'icon',
                })])
              : label,
            key: column.manifest.path,
            label,
            width: column.manifest.width,
            wrap: column.manifest.wrap,
            render(record: RuntimeRecord): VNodeChild {
              return h(InlineTableCell, { column, record, table })
            },
          }
        }),
        ...(table.groups && table.groups.length > 0 ? { groups: table.groups.map(group => ({
          collapsed: collapsedGroups.value.has(group.key),
          collapsible: group.collapsible,
          description: group.description ?? undefined,
          key: group.key,
          onToggle: () => toggleGroup(group.key),
          records: group.records,
          summaries: group.summaries,
          title: group.title,
        })) } : {}),
        ...(selectable ? { leading: {
          header: h(ShadcnInput, {
            'aria-label': 'Select page',
            checked: selectedOnPage,
            type: 'checkbox',
            onChange: (event: Event) => table.store.selectPage(recordIds, eventTarget<HTMLInputElement>(event).checked),
          }),
          label: 'Select',
          render(record: RuntimeRecord): VNodeChild {
            const recordId = table.getRecordId(record)
            return h(ShadcnInput, {
              'aria-label': `Select record ${String(recordId)}`,
              checked: table.store.isSelected(recordId),
              type: 'checkbox',
              onChange: (event: Event) => table.store.selectRecord(recordId, eventTarget<HTMLInputElement>(event).checked),
            })
          },
        } } : {}),
        records: snapshot.records,
        rowKey: record => table.getRecordId(record),
        summaries: table.summaries,
        ...(rowActions.length > 0 ? { trailing: {
          header: 'Actions',
          label: 'Actions',
          render(record: RuntimeRecord): VNodeChild {
            return rowActions.map(action => h(TableActionButton, { action, key: action.id, record, table }))
          },
        } } : {}),
      }
      const filtersNode = tableFilters(table, snapshot, filterPrefix, filtersOpen)
      const children: VNodeChild[] = [
        h('h2', { id: captionId }, table.caption),
        h('div', { class: 'hp-table-toolbar' }, [
          h('label', [h(Search, { 'aria-hidden': 'true' }), h('span', { class: 'hp-visually-hidden' }, 'Search'), h(ShadcnInput, {
            placeholder: 'Search records…',
            type: 'search',
            value: snapshot.search,
            onInput: (event: Event) => {
              table.store.setSearch(eventTarget<HTMLInputElement>(event).value)
              notifyQueryChange(table.onQueryChange)
            },
          })]),
          h('div', { class: 'hp-column-manager' }, [
            h(ShadcnButton, { 'aria-expanded': columnsOpen.value, 'aria-haspopup': 'menu', type: 'button', onClick: () => { columnsOpen.value = !columnsOpen.value } }, () => [h(Columns3, { 'aria-hidden': 'true' }), 'Columns']),
            columnsOpen.value ? h('div', { 'aria-label': 'Visible columns', role: 'menu' }, table.columns.filter(column => column.manifest.toggleable).map(column => h('label', {
              'aria-checked': currentColumns.has(column.manifest.path),
              key: column.manifest.path,
              role: 'menuitemcheckbox',
            }, [
              h(ShadcnInput, {
                checked: currentColumns.has(column.manifest.path),
                type: 'checkbox',
                onChange: (event: Event) => {
                  const next = new Set(currentColumns)
                  if (eventTarget<HTMLInputElement>(event).checked) next.add(column.manifest.path)
                  else next.delete(column.manifest.path)
                  table.store.setVisibleColumns([...next])
                  notifyQueryChange(table.onQueryChange)
                },
              }),
              column.manifest.label ?? column.manifest.path,
            ]))) : null,
          ]),
          filtersNode,
          ...headerActions.map(action => h(TableActionButton, { action, key: action.id, table })),
          ...table.transfers?.map(manifest => h(VueTransferAction, { key: manifest.id, manifest, table })) ?? [],
        ]),
        hasSelection ? h('div', { 'aria-live': 'polite', class: 'hp-table-bulk-actions' }, [
          h('span', snapshot.selection.mode === 'all-matching'
            ? `All ${snapshot.total} matching records selected`
            : `${snapshot.selection.selectedRecordIds.length} records selected`),
          ...bulkActions.map(action => h(TableActionButton, { action, key: action.id, table })),
          h(ShadcnButton, { type: 'button', onClick: () => table.store.clearSelection() }, 'Clear selection'),
        ]) : null,
        snapshot.selection.mode === 'explicit' && selectedOnPage && snapshot.total > recordIds.length
          ? h(ShadcnButton, { type: 'button', onClick: () => table.store.selectAllMatching() }, `Select all ${snapshot.total} matching records`)
          : null,
        snapshot.error ? h('div', { class: 'hp-table-error', 'data-slot': 'table-error', role: 'alert' }, [h('strong', 'Unable to load table'), h('span', snapshot.error.message)]) : null,
        snapshot.loading ? h('div', { 'aria-live': 'polite', class: 'hp-table-loading', 'data-slot': 'table-loading', role: 'status' }, 'Loading records…') : null,
        !snapshot.loading && !snapshot.error && snapshot.records.length === 0
          ? h('div', { class: 'hp-table-empty', 'data-slot': 'table-empty' }, table.emptyMessage ?? 'No records found.')
          : null,
        snapshot.records.length > 0 ? h(VueTablePresentation, { presentation: tablePresentation }) : null,
        h('nav', { 'aria-label': 'Table pagination', class: 'hp-table-pagination', 'data-slot': 'table-pagination' }, [
          h('span', { 'aria-live': 'polite', class: 'hp-table-pagination-info' }, [
            'Showing ', h('strong', String(paginationFrom)), ' to ', h('strong', String(paginationTo)), ' of ', h('strong', String(snapshot.total)), ' results',
          ]),
          typeof table.store.setPerPage === 'function' ? h('label', { class: 'hp-table-pagination-per-page' }, [
            h(ShadcnSelect, {
              'aria-label': 'Results per page',
              disabled: snapshot.loading,
              value: String(snapshot.perPage),
              onChange: (event: Event) => {
                table.store.setPerPage?.(Number(eventTarget<HTMLSelectElement>(event).value))
                notifyQueryChange(table.onQueryChange)
              },
            }, () => perPageOptions(snapshot.perPage).map(value => h('option', { key: value, value: String(value) }, String(value)))),
            h('span', 'per page'),
          ]) : null,
          h('span', { class: 'hp-table-pagination-pages' }, [
            h(ShadcnButton, {
              'aria-label': 'Previous page',
              disabled: snapshot.page <= 1 || snapshot.loading,
              type: 'button',
              onClick: () => {
                table.store.setPage(snapshot.page - 1)
                notifyQueryChange(table.onQueryChange)
              },
            }, () => [h(ChevronLeft, { 'aria-hidden': 'true' })]),
            ...paginationItems.map((item, index) => item === 'ellipsis'
              ? h('span', { 'aria-hidden': 'true', class: 'hp-table-pagination-ellipsis', key: `ellipsis-${index}` }, '…')
              : h(ShadcnButton, {
                  'aria-current': item === snapshot.page ? 'page' : undefined,
                  'aria-label': `Page ${item}`,
                  'data-active': item === snapshot.page ? 'true' : undefined,
                  disabled: snapshot.loading,
                  key: item,
                  type: 'button',
                  onClick: () => {
                    table.store.setPage(item)
                    notifyQueryChange(table.onQueryChange)
                  },
                }, () => [String(item)])),
            h(ShadcnButton, {
              'aria-label': 'Next page',
              disabled: snapshot.page >= pageCount || snapshot.loading,
              type: 'button',
              onClick: () => {
                table.store.setPage(snapshot.page + 1)
                notifyQueryChange(table.onQueryChange)
              },
            }, () => [h(ChevronRight, { 'aria-hidden': 'true' })]),
          ]),
        ]),
      ]
      return h('section', {
        'aria-busy': snapshot.loading,
        'aria-labelledby': captionId,
        class: 'hp-table-view',
        'data-panels-component': 'table',
        'data-state': snapshot.error ? 'error' : snapshot.loading ? 'loading' : snapshot.records.length === 0 ? 'empty' : 'ready',
      }, children)
    }
  },
})
