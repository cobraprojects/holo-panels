import { ShadcnButton, ShadcnInput, ShadcnSelect, ShadcnTable, ShadcnTextarea } from '../internal-ui'
import { createClientRelationLayout, type ClientRelationManager, type ClientRelationRecord, type JsonValue, type RelationOperation } from '@holo-js/panels-client'
import { defineComponent, h, ref, watch, type PropType, type VNodeChild } from 'vue'
import { PanelsButton, PanelsModal } from '../primitives'
import type { VueRelationManagerRendererProps } from './types'

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

interface MountedOperation {
  readonly manager: ClientRelationManager
  readonly operation: RelationOperation
  readonly record?: ClientRelationRecord
}

function operationButton(
  manager: ClientRelationManager,
  operation: RelationOperation,
  mount: (operation: MountedOperation) => void,
  record?: ClientRelationRecord,
): VNodeChild {
  return h(ShadcnButton, { 'data-operation': operation, type: 'button', onClick: () => mount({ manager, operation, ...(record ? { record } : {}) }) }, operationLabel(operation))
}

function relationPanel(manager: ClientRelationManager, enabled: boolean, mount: (operation: MountedOperation) => void): VNodeChild {
  const managerActions = enabled ? managerOperations.filter(operation => manager.operations.includes(operation)) : []
  const recordActions = enabled ? recordOperations.filter(operation => manager.operations.includes(operation)) : []
  return h('section', { 'aria-label': manager.label, class: 'hp-relation-manager', 'data-relation-manager': manager.id }, [
    h('header', [h('h3', manager.label), manager.badge !== null ? h('span', { class: 'hp-relation-badge' }, String(manager.badge)) : null]),
    managerActions.length > 0 ? h('div', { class: 'hp-relation-actions' }, managerActions.map(operation => operationButton(manager, operation, mount))) : null,
    manager.records.length === 0
      ? h('p', { class: 'hp-relation-empty' }, manager.emptyMessage ?? `No ${manager.label.toLocaleLowerCase()} found.`)
      : h(ShadcnTable, [
          h('caption', manager.label),
          h('thead', h('tr', [...manager.columns.map(column => h('th', { scope: 'col' }, column.label)), ...(recordActions.length > 0 ? [h('th', { scope: 'col' }, 'Actions')] : [])])),
          h('tbody', manager.records.map(record => h('tr', { key: record.id }, [
            ...manager.columns.map(column => h('td', display(record.values[column.key]))),
            ...(recordActions.length > 0 ? [h('td', recordActions.map(operation => operationButton(manager, operation, mount, record)))] : []),
          ]))),
        ]),
  ])
}

export const VueRelationManagerRenderer = defineComponent({
  name: 'VueRelationManagerRenderer',
  props: {
    relations: { type: Object as PropType<VueRelationManagerRendererProps>, required: true },
  },
  setup(componentProps) {
    const selection = ref({ ...(componentProps.relations.selection ?? {}) })
    const mounted = ref<MountedOperation | null>(null)
    const values = ref<Readonly<Record<string, JsonValue>>>({})
    const relatedId = ref<number | string>('')
    const optionSearch = ref('')
    const options = ref<readonly { readonly label: string, readonly value: number | string }[]>([])
    const error = ref<string | null>(null)
    const submitting = ref(false)
    const mount = (operation: MountedOperation): void => {
      mounted.value = operation
      const fields = operation.operation === 'editPivot' || operation.operation === 'attach'
        ? operation.manager.pivotFields ?? []
        : operation.operation === 'create' || operation.operation === 'edit' ? operation.manager.fields ?? [] : []
      const pivot = operation.record?.values.pivot
      const pivotValues = pivot && !Array.isArray(pivot) && typeof pivot === 'object' ? pivot : {}
      values.value = Object.freeze(Object.fromEntries(fields.map(field => [field.id, operation.operation === 'editPivot' ? pivotValues[field.id] ?? '' : operation.record?.values[field.id] ?? (field.type === 'toggle' ? false : '')])))
      relatedId.value = ''
      optionSearch.value = ''
      options.value = []
      error.value = null
    }
    watch([mounted, optionSearch], async ([current, search], _previous, onCleanup) => {
      if (!current || !['associate', 'attach'].includes(current.operation) || !componentProps.relations.loadOptions) return
      let active = true
      onCleanup(() => { active = false })
      try {
        const result = await componentProps.relations.loadOptions(current.manager.id, search)
        if (active) options.value = result
      } catch (cause) {
        if (active) error.value = cause instanceof Error ? cause.message : 'Related records could not be loaded.'
      }
    })
    const operationModal = (callback: NonNullable<VueRelationManagerRendererProps['onOperation']>): VNodeChild => {
      const current = mounted.value
      if (!current) return null
      const fields = ['attach', 'editPivot'].includes(current.operation) ? current.manager.pivotFields ?? [] : ['create', 'edit'].includes(current.operation) ? current.manager.fields ?? [] : []
      const selectsRecord = current.operation === 'associate' || current.operation === 'attach'
      const destructive = ['delete', 'detach', 'dissociate'].includes(current.operation)
      if (current.operation === 'view') {
        return h(PanelsModal, { open: true, title: `View ${current.manager.label.toLocaleLowerCase()}`, onClose: () => { mounted.value = null } }, {
          default: () => h('article', { class: 'hp-relation-operation-form' }, [
            h('dl', { class: 'hp-infolist' }, current.manager.columns.map(column => h('div', { key: column.key }, [h('dt', column.label), h('dd', display(current.record?.values[column.key]))]))),
            h('footer', [h(PanelsButton, { type: 'button', onClick: () => { mounted.value = null } }, () => 'Close')]),
          ]),
        })
      }
      const submit = async (event: Event): Promise<void> => {
        event.preventDefault()
        submitting.value = true
        error.value = null
        try {
          const selectedId = selectsRecord ? typeof relatedId.value === 'string' ? relatedId.value.trim() : relatedId.value : current.record?.id
          await callback({
            managerId: current.manager.id,
            operation: current.operation,
            ...(current.operation === 'editPivot' || current.operation === 'attach' ? { pivot: values.value } : fields.length > 0 ? { values: values.value } : {}),
            ...(selectedId ? { recordId: selectedId } : {}),
          })
          mounted.value = null
        } catch (cause) {
          error.value = cause instanceof Error ? cause.message : 'The relation operation failed.'
        } finally {
          submitting.value = false
        }
      }
      return h(PanelsModal, { open: true, title: `${operationLabel(current.operation)} ${current.manager.label.toLocaleLowerCase()}`, onClose: () => { mounted.value = null } }, {
        default: () => h('form', { class: 'hp-relation-operation-form', onSubmit: (event: Event) => void submit(event) }, [
          h('p', destructive ? 'This action changes the relationship immediately.' : `Complete the fields below to ${current.operation} this relationship.`),
          selectsRecord ? componentProps.relations.loadOptions
            ? h('label', [h('span', 'Related record'), h(ShadcnInput, { 'aria-label': 'Search related records', autofocus: true, placeholder: 'Search…', value: optionSearch.value, onInput: (event: Event) => { optionSearch.value = (event.currentTarget as HTMLInputElement).value } }), h(ShadcnSelect, { 'aria-label': 'Related record', required: true, value: String(relatedId.value), onChange: (event: Event) => { const value = (event.currentTarget as HTMLSelectElement).value; relatedId.value = options.value.find(option => String(option.value) === value)?.value ?? '' } }, [h('option', { value: '' }, 'Select a record'), ...options.value.map(option => h('option', { key: option.value, value: String(option.value) }, option.label))])])
            : h('label', [h('span', 'Related record ID'), h(ShadcnInput, { autofocus: true, required: true, value: relatedId.value, onInput: (event: Event) => { relatedId.value = (event.currentTarget as HTMLInputElement).value } })]) : null,
          ...fields.map(field => h('label', { key: field.id }, [
            h('span', field.label),
            field.type === 'textarea'
              ? h(ShadcnTextarea, { required: field.required, value: String(values.value[field.id] ?? ''), onInput: (event: Event) => { values.value = { ...values.value, [field.id]: (event.currentTarget as HTMLTextAreaElement).value } } })
              : h(ShadcnInput, {
                  checked: field.type === 'toggle' ? values.value[field.id] === true : undefined,
                  required: field.required,
                  type: field.type === 'toggle' ? 'checkbox' : field.type === 'number' ? 'number' : field.type === 'date-time' ? 'datetime-local' : 'text',
                  value: field.type === 'toggle' ? undefined : String(values.value[field.id] ?? ''),
                  onInput: (event: Event) => { const input = event.currentTarget as HTMLInputElement; values.value = { ...values.value, [field.id]: field.type === 'toggle' ? input.checked : field.type === 'number' ? input.valueAsNumber : input.value } },
                }),
          ])),
          error.value ? h('p', { role: 'alert' }, error.value) : null,
          h('footer', [h(PanelsButton, { disabled: submitting.value, type: 'button', onClick: () => { mounted.value = null } }, () => 'Cancel'), h(PanelsButton, { disabled: submitting.value, type: 'submit', variant: destructive ? 'danger' : 'primary' }, () => submitting.value ? 'Working…' : operationLabel(current.operation))]),
        ]),
      })
    }
    return (): VNodeChild => {
      const props = componentProps.relations
      const layout = createClientRelationLayout(props.managers, selection.value)
      const select = (groupId: string, managerId: string): void => {
        selection.value = { ...selection.value, [groupId]: managerId }
        props.onSelectionChange?.(groupId, managerId)
      }
      return h('div', { class: 'hp-relations', 'data-panels-component': 'relation-managers' }, [
        ...layout.inline.map(manager => relationPanel(manager, !!props.onOperation, mount)),
        ...layout.tabGroups.map(group => h('section', { 'aria-label': group.label ?? 'Related records', class: 'hp-relation-tabs', key: group.id }, [
          group.label ? h('h2', group.label) : null,
          h('div', { 'aria-label': group.label ?? 'Related records', role: 'tablist' }, group.managers.map(manager => h(ShadcnButton, {
            'aria-controls': `${group.id}-${manager.id}`,
            'aria-selected': group.activeId === manager.id,
            id: `${group.id}-${manager.id}-tab`,
            key: manager.id,
            role: 'tab',
            type: 'button',
            onClick: () => select(group.id, manager.id),
          }, `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))),
          ...group.managers.map(manager => h('div', {
            'aria-labelledby': `${group.id}-${manager.id}-tab`,
            hidden: group.activeId !== manager.id,
            id: `${group.id}-${manager.id}`,
            key: manager.id,
            role: 'tabpanel',
          }, [relationPanel(manager, !!props.onOperation, mount)])),
        ])),
        layout.pages.length > 0 ? h('nav', { 'aria-label': 'Related record pages', class: 'hp-relation-pages' }, layout.pages.map(manager => h('a', { href: manager.url!, key: manager.id }, `${manager.label}${manager.badge !== null ? ` (${manager.badge})` : ''}`))) : null,
        props.onOperation ? operationModal(props.onOperation) : null,
      ])
    }
  },
})
