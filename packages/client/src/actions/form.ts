import type { JsonObject, JsonValue, SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-core'
import { FormStore } from '../forms/store'
import { parseFormPath } from '../forms/paths'
import { OptionStore } from '../options/store'

export interface ActionFormField {
  readonly disabled: boolean
  readonly helperText: string | null
  readonly hint: string | null
  readonly label: string
  readonly path: string
  readonly placeholder: string | null
  readonly properties: JsonObject
  readonly readOnly: boolean
  readonly required: boolean
  readonly type: string
  readonly visible: boolean
}

function object(value: JsonValue | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function components(values: readonly JsonValue[], parent: string): readonly SchemaComponentManifest[] {
  return values.map((value, index) => {
    const definition = object(value)
    const key = typeof definition.key === 'string' ? definition.key : String(index)
    const id = `${parent}.${key}`
    const field = definition.kind === 'field'
    const kind = field ? 'group' : String(definition.kind)
    if (!['grid', 'group', 'section', 'fieldset', 'tabs', 'tab', 'wizard', 'step', 'split', 'callout', 'empty-state'].includes(kind)) throw new Error('Unsupported action schema component')
    return {
      children: components(Array.isArray(definition.children) ? definition.children : [], id),
      dynamicVisibility: false,
      extraAttributes: object(definition.extraAttributes),
      id,
      key,
      kind: kind as SchemaComponentManifest['kind'],
      layout: {
        ...(typeof definition.columnSpan === 'number' || definition.columnSpan === 'full' ? { columnSpan: { default: definition.columnSpan } } : {}),
        ...(typeof definition.columns === 'number' ? { columns: { default: definition.columns } } : {}),
      },
      properties: field ? { customProperties: { actionField: definition } } : {
        ...(typeof definition.heading === 'string' ? { heading: definition.heading } : {}),
        ...(typeof definition.label === 'string' ? { label: definition.label } : {}),
        ...(typeof definition.description === 'string' ? { description: definition.description } : {}),
      },
      slots: {},
      type: field ? 'group' : kind,
      visible: definition.hidden !== true,
    }
  })
}

export function actionFormSchema(value: JsonObject | null, id: string): SchemaManifest<JsonObject> | null {
  if (!value) return null
  if (value.kind === 'schema' && typeof value.id === 'string' && Array.isArray(value.components)) return value as JsonObject & SchemaManifest<JsonObject>
  if (!Array.isArray(value.fields)) return null
  return { components: components(value.fields, id), id, kind: 'schema' }
}

export function actionFormField(component: SchemaComponentManifest): ActionFormField | null {
  const definition = object(component.properties.customProperties?.actionField)
  if (typeof definition.path !== 'string' || typeof definition.type !== 'string') return null
  parseFormPath(definition.path)
  return {
    disabled: definition.disabled === true,
    helperText: typeof definition.helperText === 'string' ? definition.helperText : null,
    hint: typeof definition.hint === 'string' ? definition.hint : null,
    label: typeof definition.label === 'string' ? definition.label : definition.path,
    path: definition.path,
    placeholder: typeof definition.placeholder === 'string' ? definition.placeholder : null,
    properties: object(definition.properties),
    readOnly: definition.readOnly === true,
    required: definition.required === true,
    type: definition.type,
    visible: definition.hidden !== true,
  }
}

function initializeFields(nodes: readonly SchemaComponentManifest[], values: JsonObject): void {
  for (const node of nodes) {
    const definition = object(node.properties.customProperties?.actionField)
    if (typeof definition.path === 'string') {
      const segments = parseFormPath(definition.path)
      const name = segments.at(-1)
      let target = values
      for (const segment of segments.slice(0, -1)) {
        const current = target[segment]
        if (current === undefined) target[segment] = {}
        else if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('Action form paths cannot traverse a scalar value')
        target = object(target[segment])
      }
      if (name && target[name] === undefined) target[name] = definition.defaultValue ?? ''
    }
    initializeFields(node.children, values)
  }
}

export function createActionForm(schema: SchemaManifest<JsonObject>, input: Readonly<JsonObject>): FormStore<JsonObject> {
  const values = structuredClone(input)
  initializeFields(schema.components, values)
  return new FormStore<JsonObject>(values)
}

export function createActionOptions(field: ActionFormField, actionId: string): OptionStore<number | string> | undefined {
  if (!['select', 'multiselect', 'checkbox-list', 'toggle-buttons'].includes(field.type)) return undefined
  const configured = field.properties.options
  const values = Array.isArray(configured) ? configured : Object.entries(object(configured)).map(([value, label]) => ({ label, value }))
  const options = values.flatMap(value => {
    const option = object(value)
    return typeof option.label === 'string' && (typeof option.value === 'number' || typeof option.value === 'string') ? [{ label: option.label, value: option.value }] : []
  })
  return new OptionStore({
    fieldId: field.path, locale: 'en', panelId: 'action', resourceId: actionId, tenantKey: crypto.randomUUID(),
    transport: {
      list: async request => ({ hasMore: false, options: options.filter(option => option.label.toLocaleLowerCase().includes(request.search.toLocaleLowerCase())), page: request.page, perPage: request.perPage }),
      hydrateSelected: async (_request, values) => options.filter(option => values.includes(option.value)),
      validateSelection: async (_request, values) => values.every(value => options.some(option => option.value === value)),
    },
  })
}
