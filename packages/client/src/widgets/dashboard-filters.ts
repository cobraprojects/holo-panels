import type { JsonObject, SchemaManifest } from '@holo-js/panels-core'
import { actionFormSchema, createActionForm, createActionOptions, type ActionFormField } from '../actions/form'
import type { FormStore } from '../forms/store'
import type { FormServerPatch } from '../forms/types'
import type { PanelsTransport } from '../transport'
import { createPanelTranslator } from '../locales/presentation'

interface DashboardFilterOptions {
  readonly locale?: string
  readonly filters: JsonObject
  readonly panelId: string
  readonly pageId: string
  readonly schema: JsonObject
  readonly transport: PanelsTransport
}

export class DashboardFilterStore {
  readonly form: FormStore<JsonObject>
  readonly schema: SchemaManifest<JsonObject>
  readonly #options: DashboardFilterOptions
  readonly #listeners = new Set<() => void | Promise<void>>()
  readonly #optionsByPath = new Map<string, ReturnType<typeof createActionOptions>>()
  #applied: JsonObject

  constructor(options: DashboardFilterOptions) {
    const schema = actionFormSchema(options.schema, `${options.pageId}-filters`)
    if (!schema) throw new Error('Dashboard filters require a shared form schema')
    this.#options = options
    this.#applied = options.filters
    this.schema = schema
    this.form = createActionForm(schema, options.filters)
    this.form.setLocale(options.locale ?? 'en')
  }

  get applied(): JsonObject { return this.#applied }

  optionStore(field: ActionFormField): ReturnType<typeof createActionOptions> {
    if (!this.#optionsByPath.has(field.path)) this.#optionsByPath.set(field.path, createActionOptions(field, this.#options.pageId))
    return this.#optionsByPath.get(field.path)
  }

  subscribe(listener: () => void | Promise<void>): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async submit(reset = false): Promise<void> {
    const translate = createPanelTranslator(this.#options.locale ?? 'en')
    const execute = async (signal: AbortSignal, values: JsonObject): Promise<FormServerPatch> => {
      const response = await this.#options.transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'page-data' }, {
        endpoint: `/holo/panels/${encodeURIComponent(this.#options.panelId)}/page-data`,
        panelId: this.#options.panelId,
        payload: { pageId: this.#options.pageId, ...(reset ? { resetFilters: true } : { dashboardFilters: values }) },
        signal,
      })
      if (signal.aborted) return {}
      if (!response.ok) return { errors: { _root: [translate('widgets.filtersFailed')] } }
      const data = response.data
      if (data?.status === 'invalid' && data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
        return { errors: Object.fromEntries(Object.entries(data.errors).map(([key, value]) => [key, Array.isArray(value) ? value.filter((message): message is string => typeof message === 'string') : []])), focusFirstError: true }
      }
      if (!data?.filters || typeof data.filters !== 'object' || Array.isArray(data.filters)) return { errors: { _root: [translate('widgets.filtersInvalid')] } }
      this.#applied = data.filters
      await Promise.all([...this.#listeners].map(listener => listener()))
      return { errors: {}, commitValues: true, operations: Object.entries(data.filters).map(([path, value]) => ({ kind: 'set' as const, path, value })) }
    }
    await this.form.submit(({ signal, values }) => execute(signal, values), { validate: !reset }).catch(() => {
      this.form.applyServerPatch({ errors: { _root: [translate('widgets.filtersFailed')] } })
    })
  }

  stop(): void {
    this.form.cancelRequests()
    this.#listeners.clear()
  }
}

export function createDashboardFilterStore(transport: PanelsTransport, panelId: string, page: { readonly manifest: { readonly id: string, readonly body: { readonly properties: JsonObject } | null }, readonly data: JsonObject }, locale = 'en'): DashboardFilterStore | null {
  const dashboard = page.manifest.body?.properties.dashboard
  const schema = dashboard && typeof dashboard === 'object' && !Array.isArray(dashboard) ? dashboard.filters : null
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null
  const filters = page.data.filters
  return new DashboardFilterStore({ transport, panelId, pageId: page.manifest.id, schema, locale, filters: filters && typeof filters === 'object' && !Array.isArray(filters) ? filters : {} })
}
