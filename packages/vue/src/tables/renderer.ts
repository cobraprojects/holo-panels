import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, Input, InputGroup, InputGroupAddon, InputGroupInput, NativeSelect, PanelsIcon, Popover, PopoverContent, PopoverTrigger, Progress } from '../internal-ui'
import { ClientTransferStore, createPanelTranslator, createTableActionHost, publishPanelError, publishPanelErrorTo, type ClientTransferManifest, type FilterCollectionPresentation, type JsonValue, type TableRecordId, type TableState } from '@holo-js/panels-client'
import { VueActionRenderer } from '../actions/renderer'
import { TablesRenderHook } from '@holo-js/panels-core'
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3, ListFilter, Search } from 'lucide-vue-next'
import {
  computed,
  defineComponent,
  Fragment,
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
import { usePanelsRenderHook } from '../render-hooks'
import { VueTableColumnPresentation, VueTablePresentation, type VueTablePresentationProps } from './presentation'
import type {
  VueTableAction,
  VueTableActionGroup,
  VueTableActionItem,
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
    const translate = createPanelTranslator(props.table.locale ?? 'en')
    const kind = translate(`transfers.${props.manifest.kind}`)
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
      h(Button, { class: 'hp-action-trigger', 'data-action': props.manifest.id, disabled: !store, type: 'button', variant: 'outline', onClick: () => { open.value = true } }, () => [PanelsIcon(props.manifest.kind === 'import' ? 'upload' : 'download'), h('span', props.manifest.label)]),
      h(Dialog, { open: open.value, 'onUpdate:open': (active: boolean) => { if (!active) { store?.cancel(); open.value = false } } }, () => h(DialogContent, { 'data-holo-panel': '', closeLabel: translate('actions.close') }, () => [
        h(DialogHeader, {}, () => [h(DialogTitle, {}, () => props.manifest.label), h(DialogDescription, {}, () => translate('transfers.configure', { kind }))]),
        h('label', [translate('transfers.format'), h(NativeSelect, { modelValue: formatId.value, onChange: (event: Event) => { formatId.value = eventTarget<HTMLSelectElement>(event).value } }, props.manifest.formatIds.map(id => h('option', { value: id }, id.toUpperCase()))) ]),
        props.manifest.kind === 'import' ? h('div', [
          h('label', [translate('transfers.csvFile'), h(Input, { accept: '.csv,text/csv', type: 'file', onChange: (event: Event) => { const file = eventTarget<HTMLInputElement>(event).files?.[0]; if (file && store) void store.inspect(file).catch(() => undefined) } })]),
          ...(state.value?.inspection ? props.manifest.columns.map(column => h('label', [column.label, h(NativeSelect, { required: column.required, modelValue: mappings.value[column.key] ?? '', onChange: (event: Event) => { mappings.value = { ...mappings.value, [column.key]: eventTarget<HTMLSelectElement>(event).value } } }, [h('option', { value: '' }, translate('transfers.doNotImport')), ...state.value!.inspection!.headers.map(header => h('option', { value: header }, header))])])) : []),
          state.value?.uploadProgress ? h(Progress, { 'aria-label': translate('transfers.uploadProgress'), max: 100, modelValue: state.value.uploadProgress }) : null,
        ]) : h('div', props.manifest.columns.map(column => h('label', [h(Checkbox, { modelValue: columns.value.has(column.id), 'onUpdate:modelValue': (checked: boolean | 'indeterminate') => { const next = new Set(columns.value); if (checked === true) next.add(column.id); else next.delete(column.id); columns.value = next } }), column.label]))),
        h(DialogFooter, {}, () => h(Button, { disabled: !store || (props.manifest.kind === 'import' && !state.value?.inspection), type: 'button', onClick: () => void submit().catch(() => undefined) }, () => translate('transfers.start', { kind }))),
        state.value?.progress ? h(Progress, { 'aria-label': translate('transfers.transferProgress'), max: 100, modelValue: (state.value.progress.completed / Math.max(1, state.value.progress.total)) * 100 }) : null,
        state.value?.error ? h('div', { role: 'alert' }, state.value.error) : null,
      ])),
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
        h(NativeSelect, { 'aria-label': 'Column', modelValue: columnId, onChange: (event: Event) => change(index, 'column', eventTarget<HTMLSelectElement>(event).value) }, columns.map(item => h('option', { key: String(item.id), value: String(item.id) }, String(item.id)))),
        h(NativeSelect, { 'aria-label': 'Operator', modelValue: operator, onChange: (event: Event) => change(index, 'operator', eventTarget<HTMLSelectElement>(event).value) }, operators.map(item => h('option', { key: item, value: item }, item))),
        ['null', 'not-null'].includes(operator) ? null : h(Input, { 'aria-label': 'Value', type: scalarType === 'number' ? 'number' : scalarType === 'date' ? 'date' : 'text', modelValue: inputValue, onInput: (event: Event) => change(index, 'value', advancedInputValue(eventTarget<HTMLInputElement>(event).value, scalarType, operator)) }),
        h(Button, { type: 'button', onClick: () => update({ conditions: conditions.filter((_, conditionIndex) => conditionIndex !== index) }) }, 'Remove condition'),
      ])
    }),
    h(Button, {
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

function reportTableError(table: RuntimeTable, title: string): void {
  if (table.notificationStore) {
    publishPanelErrorTo(table.notificationStore, title)
    return
  }
  publishPanelError(table.panelId ?? 'default', title)
}

function isActionGroup(action: VueTableActionItem): action is VueTableActionGroup {
  return 'kind' in action && action.kind === 'action-group'
}

const TableActionGroupButton = defineComponent({
  name: 'VueTableActions',
  props: {
    action: { type: Object as PropType<VueTableAction>, default: undefined },
    group: { type: Object as PropType<VueTableActionGroup>, default: undefined },
    record: { type: Object as PropType<RuntimeRecord>, default: undefined },
    table: { type: Object as PropType<object>, required: true },
  },
  setup(props) {
    const host = computed(() => {
      const table = runtimeTable(props.table)
      const group = props.group
      return createTableActionHost({
        actions: group?.actions ?? (props.action ? [props.action] : []),
        group: group ? { ...group, label: group.label ?? (group.scope === 'row' ? 'Row actions' : group.scope === 'bulk' ? 'Bulk actions' : 'Actions') } : undefined,
        recordId: props.record ? table.getRecordId(props.record) : undefined,
        selection: () => table.store.selectionPayload(),
        clearSelection: () => table.store.clearSelection(),
        execute: async (request, signal) => {
          try {
            if (!table.actionTransport) throw new Error('Table actions require an action transport')
            await table.actionTransport.execute(request, signal)
          } catch (cause) {
            const action = (group?.actions ?? (props.action ? [props.action] : [])).find(action => action.id === request.actionId)
            if (!signal.aborted) reportTableError(table, `${action?.label ?? 'Action'} failed`)
            throw cause
          }
        },
      })
    })
    const close = (value: typeof host.value): void => { while (value.store.activeFrame) value.store.close() }
    watch(host, (_value, previous) => close(previous))
    onScopeDispose(() => close(host.value))
    return (): VNodeChild => {
      const table = runtimeTable(props.table)
      const current = host.value
      return current.actions[0] ? h(VueActionRenderer, { ...current, action: current.actions[0], locale: table.locale, panelId: table.panelId, registry: table.registry }) : null
    }
  },
})

function tableActionNode(action: VueTableActionItem, table: RuntimeTable, record?: RuntimeRecord): VNode {
  return h(TableActionGroupButton, { ...(isActionGroup(action) ? { group: action } : { action }), key: action.id, record, table })
}

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
    const input = ref<HTMLInputElement | { $el?: HTMLInputElement }>()
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
      const element = input.value instanceof HTMLInputElement ? input.value : input.value?.$el
      element?.focus()
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
      if (!editing.value) return h(Button, { 'aria-label': `Edit ${column.manifest.label ?? column.manifest.path}`, type: 'button', onClick: begin }, () => [rendered])
      const label = column.manifest.label ?? column.manifest.path
      if (kind === 'checkbox' || kind === 'toggle') {
        return h('span', [
          h(Checkbox, {
            'aria-label': label,
            disabled: pending.value,
            modelValue: value.value === true,
            'onUpdate:modelValue': (checked: boolean | 'indeterminate') => {
              const next = checked === true
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
          h(NativeSelect, {
            'aria-label': label,
            disabled: pending.value,
            modelValue: String(value.value ?? ''),
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
        h(Input, {
          'aria-label': label,
          disabled: pending.value,
          ref: input,
          modelValue: String(value.value ?? ''),
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
  const translate = createPanelTranslator(table.locale ?? 'en')
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
        h('label', { for: `${id}-from` }, ['From', h(Input, {
          id: `${id}-from`,
          type: 'date',
          modelValue: from,
          onInput: (event: Event) => update({ from: eventTarget<HTMLInputElement>(event).value || null, to: to || null }),
        })]),
        h('label', { for: `${id}-to` }, ['To', h(Input, {
          id: `${id}-to`,
          type: 'date',
          modelValue: to,
          onInput: (event: Event) => update({ from: from || null, to: eventTarget<HTMLInputElement>(event).value || null }),
        })]),
      ]))
    }
    if (filter.manifest.type === 'ternary') {
      return wrap(h('label', { for: id }, [filter.manifest.label ?? filter.manifest.id, h(NativeSelect, {
        id,
        modelValue: typeof current === 'string' ? current : 'all',
        onChange: (event: Event) => update(eventTarget<HTMLSelectElement>(event).value),
      }, [h('option', { value: 'all' }, 'All'), h('option', { value: 'true' }, 'Yes'), h('option', { value: 'false' }, 'No')])]))
    }
    if (filter.manifest.type === 'trashed') {
      return wrap(h('label', { for: id }, [filter.manifest.label ?? filter.manifest.id, h(NativeSelect, {
        id,
        modelValue: typeof current === 'string' ? current : 'without',
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
      ? h(NativeSelect, {
          id,
          multiple,
          modelValue: multiple ? selectedValues : selectedValues[0],
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
        ? h(Checkbox, { id, modelValue: current === true, 'onUpdate:modelValue': (checked: boolean | 'indeterminate') => update(checked === true) })
        : h(Input, {
            id,
            type: 'search',
            modelValue: typeof current === 'number' || typeof current === 'string' ? String(current) : '',
            onInput: (event: Event) => update(eventTarget<HTMLInputElement>(event).value),
          })
    return wrap(h('label', { for: id }, [filter.manifest.label ?? filter.manifest.id, control]))
  }
  const content = h('form', {
    'aria-label': translate('tables.filterForm'),
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
    state.filters.mode === 'deferred' ? h(Button, { type: 'submit' }, translate('tables.applyFilters')) : null,
    h(Button, {
      type: 'button',
      onClick: () => {
        table.store.resetFilters()
        notifyQueryChange(table.onQueryChange)
      },
    }, translate('tables.resetFilters')),
    filterCollectionSlot(table, 'after'),
  ])
  if (placement === 'inline') return content
  const trigger = h(Button, {
    'aria-expanded': String(open.value),
    'aria-haspopup': 'dialog',
    type: 'button',
    variant: 'outline',
  }, [h(ListFilter, { 'aria-hidden': 'true' }), translate('tables.filters')])
  if (placement === 'dropdown') return h(Popover, { open: open.value, 'onUpdate:open': (active: boolean) => { open.value = active } }, () => [h(PopoverTrigger, { asChild: true }, () => trigger), h(PopoverContent, { 'data-holo-panel': '' }, () => content)])
  return [trigger, h(Dialog, { open: open.value, 'onUpdate:open': (active: boolean) => { open.value = active } }, () => h(DialogContent, { 'data-holo-panel': '', closeLabel: translate('actions.close') }, () => [h(DialogHeader, {}, () => [h(DialogTitle, {}, () => translate('tables.filters')), h(DialogDescription, {}, () => translate('tables.filterDescription'))]), content]))]
}

export const VueTableRenderer = defineComponent({
  name: 'VueTableRenderer',
  props: {
    table: { type: Object as PropType<object>, required: true },
  },
  setup(componentProps) {
    const renderHook = usePanelsRenderHook()
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
      const headerActions = table.actions?.filter(action => action.scope === 'header' && (!action.emptyStateOnly || snapshot.records.length === 0)) ?? []
      const bulkActions = table.actions?.filter(action => action.scope === 'bulk') ?? []
      const rowActions = table.actions?.filter(action => action.scope === 'row') ?? []
      const rowActionGroups = rowActions.filter(isActionGroup)
      const ungroupedRowActions = rowActions.filter((action): action is VueTableAction => !isActionGroup(action))
      const defaultRowActionGroup: VueTableActionGroup = { actions: ungroupedRowActions, id: 'row-actions', kind: 'action-group', scope: 'row' }
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
        emptyMessage: table.emptyMessage,
        error: snapshot.error?.message,
        loading: snapshot.loading,
        columns: columns.map(column => {
          const active = snapshot.sort.find(item => item.column === column.manifest.path)
          const label = column.manifest.label ?? column.manifest.path
          return {
            alignment: column.manifest.alignment,
            ariaSort: active?.direction === 'asc' ? 'ascending' : active?.direction === 'desc' ? 'descending' : 'none',
            header: column.manifest.sortable
              ? h(Button, {
                  class: 'hp-table-sort hp:-ml-3 hp:h-8 hp:px-3 hp:text-muted-foreground hp:data-[sorted]:text-foreground',
                  'data-sorted': active?.direction,
                  size: 'sm',
                  type: 'button',
                  variant: 'ghost',
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
          selection: selectable ? { checked: group.records.length > 0 && group.records.every(record => table.store.isSelected(table.getRecordId(record))), disabled: snapshot.loading, onChange: (checked: boolean) => table.store.selectGroup(group.records.map(table.getRecordId), group.key, checked) } : undefined,
        })) } : {}),
        ...(selectable ? { leading: {
          header: table.store.selectionSettings.groupsOnly ? null : h(Checkbox, {
            'aria-label': 'Select page',
            modelValue: selectedOnPage ? true : recordIds.some(id => table.store.isSelected(id)) ? 'indeterminate' : false,
            disabled: snapshot.loading,
            'onUpdate:modelValue': (checked: boolean | 'indeterminate') => table.store.selectPage(recordIds, checked === true),
          }),
          label: 'Select',
          render(record: RuntimeRecord): VNodeChild {
            const recordId = table.getRecordId(record)
            return h(Checkbox, {
              'aria-label': `Select record ${String(recordId)}`,
              modelValue: table.store.isSelected(recordId),
              disabled: snapshot.loading || !table.store.canSelectRecord(recordId),
              'onUpdate:modelValue': (checked: boolean | 'indeterminate') => table.store.selectRecord(recordId, checked === true, table.groups?.find(group => group.records.some(item => table.getRecordId(item) === recordId))?.key),
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
            return h('div', { class: 'hp:flex hp:items-center hp:justify-end hp:gap-1' }, [
              ungroupedRowActions.length > 0 ? h(TableActionGroupButton, { group: defaultRowActionGroup, record, table }) : null,
              h(Fragment, rowActionGroups.map(group => h(TableActionGroupButton, { group, key: group.id, record, table }))),
            ])
          },
        } } : {}),
      }
      const filtersNode = tableFilters(table, snapshot, filterPrefix, filtersOpen)
      const children: VNodeChild[] = [
        renderHook(TablesRenderHook.HEADER_BEFORE),
        h('h2', { class: 'hp:text-xl hp:font-semibold', id: captionId }, table.caption),
        renderHook(TablesRenderHook.HEADER_AFTER),
        renderHook(TablesRenderHook.TOOLBAR_BEFORE),
        h('div', { class: 'hp-table-toolbar hp:flex hp:flex-wrap hp:items-center hp:gap-2' }, [
          renderHook(TablesRenderHook.TOOLBAR_START),
          renderHook(TablesRenderHook.TOOLBAR_SEARCH_BEFORE),
          h('label', { class: 'hp:min-w-48 hp:flex-1' }, [h('span', { class: 'hp-visually-hidden' }, 'Search'), h(InputGroup, {}, () => [h(InputGroupAddon, {}, () => h(Search, { 'aria-hidden': 'true' })), h(InputGroupInput, {
            placeholder: 'Search records…',
            type: 'search',
            modelValue: snapshot.search,
            onInput: (event: Event) => {
              table.store.setSearch(eventTarget<HTMLInputElement>(event).value)
              notifyQueryChange(table.onQueryChange)
            },
          })])]),
          renderHook(TablesRenderHook.TOOLBAR_SEARCH_AFTER),
          renderHook(TablesRenderHook.TOOLBAR_COLUMN_MANAGER_TRIGGER_BEFORE),
          h(DropdownMenu, { open: columnsOpen.value, 'onUpdate:open': (open: boolean) => { columnsOpen.value = open } }, () => [
            h(DropdownMenuTrigger, { asChild: true }, () => h(Button, { 'aria-expanded': columnsOpen.value, 'aria-haspopup': 'menu', class: 'hp-column-manager', type: 'button', variant: 'outline' }, () => [h(Columns3, { 'aria-hidden': 'true' }), 'Columns'])),
            h(DropdownMenuContent, { align: 'end', 'aria-label': 'Visible columns' }, () => table.columns.filter(column => column.manifest.toggleable).map(column => h(DropdownMenuCheckboxItem, {
              modelValue: currentColumns.has(column.manifest.path),
              key: column.manifest.path,
              'onUpdate:modelValue': (checked: boolean) => {
                const next = new Set(currentColumns)
                if (checked) next.add(column.manifest.path)
                else next.delete(column.manifest.path)
                table.store.setVisibleColumns([...next])
                notifyQueryChange(table.onQueryChange)
              },
            }, () => column.manifest.label ?? column.manifest.path))),
          ]),
          renderHook(TablesRenderHook.TOOLBAR_COLUMN_MANAGER_TRIGGER_AFTER),
          filtersNode,
          ...headerActions.map(action => tableActionNode(action, table)),
          ...table.transfers?.map(manifest => h(VueTransferAction, { key: manifest.id, manifest, table })) ?? [],
          renderHook(TablesRenderHook.TOOLBAR_END),
        ]),
        renderHook(TablesRenderHook.TOOLBAR_AFTER),
        hasSelection ? h('div', { 'aria-live': 'polite', class: 'hp-table-bulk-actions hp:flex hp:flex-wrap hp:items-center hp:gap-2 hp:rounded-md hp:border hp:bg-muted/50 hp:p-3' }, [
          h('span', snapshot.selection.mode === 'all-matching'
            ? `All ${table.store.selectedCount} matching records selected`
            : `${table.store.selectedCount} records selected`),
          renderHook(TablesRenderHook.SELECTION_INDICATOR_ACTIONS_BEFORE),
          ...bulkActions.map(action => tableActionNode(action, table)),
          renderHook(TablesRenderHook.SELECTION_INDICATOR_ACTIONS_AFTER),
          h(Button, { type: 'button', onClick: () => table.store.clearSelection() }, 'Clear selection'),
        ]) : null,
        table.store.canSelectAllMatching && snapshot.selection.mode === 'explicit' && selectedOnPage && snapshot.total > recordIds.length
          ? h(Button, { type: 'button', onClick: () => table.store.selectAllMatching() }, `Select all ${snapshot.total} matching records`)
          : null,
        h(VueTablePresentation, { presentation: tablePresentation }),
        h('nav', { 'aria-label': 'Table pagination', class: 'hp-table-pagination hp:flex hp:flex-wrap hp:items-center hp:justify-between hp:gap-4 hp:text-sm hp:text-muted-foreground', 'data-slot': 'table-pagination' }, [
          h('span', { 'aria-live': 'polite', class: 'hp-table-pagination-info' }, [
            'Showing ', h('strong', String(paginationFrom)), ' to ', h('strong', String(paginationTo)), ' of ', h('strong', String(snapshot.total)), ' results',
          ]),
          typeof table.store.setPerPage === 'function' ? h('label', { class: 'hp-table-pagination-per-page hp:flex hp:items-center hp:gap-2' }, [
            h(NativeSelect, {
              'aria-label': 'Results per page',
              disabled: snapshot.loading,
              modelValue: String(snapshot.perPage),
              onChange: (event: Event) => {
                table.store.setPerPage?.(Number(eventTarget<HTMLSelectElement>(event).value))
                notifyQueryChange(table.onQueryChange)
              },
            }, () => perPageOptions(snapshot.perPage).map(value => h('option', { key: value, value: String(value) }, String(value)))),
            h('span', 'per page'),
          ]) : null,
          h('span', { class: 'hp-table-pagination-pages hp:flex hp:items-center hp:gap-1' }, [
            h(Button, {
              'aria-label': 'Previous page',
              disabled: snapshot.page <= 1 || snapshot.loading,
              size: 'icon',
              type: 'button',
              variant: 'outline',
              onClick: () => {
                table.store.setPage(snapshot.page - 1)
                notifyQueryChange(table.onQueryChange)
              },
            }, () => [h(ChevronLeft, { 'aria-hidden': 'true', class: 'hp:rtl:rotate-180' })]),
            ...paginationItems.map((item, index) => item === 'ellipsis'
              ? h('span', { 'aria-hidden': 'true', class: 'hp-table-pagination-ellipsis', key: `ellipsis-${index}` }, '…')
              : h(Button, {
                  'aria-current': item === snapshot.page ? 'page' : undefined,
                  'aria-label': `Page ${item}`,
                  'data-active': item === snapshot.page ? 'true' : undefined,
                  disabled: snapshot.loading,
                  key: item,
                  type: 'button',
                  variant: item === snapshot.page ? 'secondary' : 'ghost',
                  onClick: () => {
                    table.store.setPage(item)
                    notifyQueryChange(table.onQueryChange)
                  },
                }, () => [String(item)])),
            h(Button, {
              'aria-label': 'Next page',
              disabled: snapshot.page >= pageCount || snapshot.loading,
              size: 'icon',
              type: 'button',
              variant: 'outline',
              onClick: () => {
                table.store.setPage(snapshot.page + 1)
                notifyQueryChange(table.onQueryChange)
              },
            }, () => [h(ChevronRight, { 'aria-hidden': 'true', class: 'hp:rtl:rotate-180' })]),
          ]),
        ]),
      ]
      return h('section', {
        'aria-busy': snapshot.loading,
        'aria-labelledby': captionId,
        class: 'hp-table-view hp:min-w-0 hp:w-full hp:max-w-full hp:space-y-4',
        'data-panels-component': 'table',
        'data-state': snapshot.error ? 'error' : snapshot.loading ? 'loading' : snapshot.records.length === 0 ? 'empty' : 'ready',
      }, children)
    }
  },
})
