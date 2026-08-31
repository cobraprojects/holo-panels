import { PanelsTransportError, type JsonObject, type JsonValue, type ResponseEnvelope } from '@holo-js/panels-core'
import type { PanelsTransport } from '../transport'
import type { WidgetClientManifest, WidgetLoadResult } from './contracts'
import { WidgetStore } from './store'
import { WidgetTableController } from './table'
import { createWidgetLoader } from './transport'

export function createWidgetRuntime(options: {
  readonly applyEffects: (response: ResponseEnvelope<JsonObject>) => void | Promise<void>
  readonly dashboardFilters?: () => JsonObject
  readonly panelId: string
  readonly transport: PanelsTransport
  readonly widget: {
    readonly data: JsonValue | null
    readonly manifest: WidgetClientManifest
    readonly request?: JsonObject
    readonly status: WidgetLoadResult['status']
  }
}) {
  const { widget } = options
  let controller = new AbortController()
  const store: WidgetStore = new WidgetStore(widget.manifest, createWidgetLoader(options.transport, options.panelId, widget.request ?? {}, options.dashboardFilters, widget.manifest.family === 'table' ? () => table?.query ?? {} : undefined), {
    initialResult: widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status },
  })
  const table: WidgetTableController | undefined = widget.manifest.family === 'table' ? new WidgetTableController(store, {
    panelId: options.panelId,
    request: () => ({ ...widget.request, widgetId: widget.manifest.id, filters: { ...store.snapshot.filters }, ...(options.dashboardFilters ? { dashboardFilters: options.dashboardFilters() } : {}) }),
    async execute(operation, payload, signal) {
      const ownedSignal = AbortSignal.any([signal, controller.signal])
      const response = await options.transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: operation, supportsIdempotency: true }, {
        endpoint: `/holo/panels/${encodeURIComponent(options.panelId)}/${operation}`, idempotencyKey: String(payload.idempotencyKey), panelId: options.panelId, payload, signal: ownedSignal,
      })
      if (ownedSignal.aborted) throw new DOMException('The widget request was aborted', 'AbortError')
      await options.applyEffects(response)
      if (!response.ok) throw new PanelsTransportError(response.error)
      return response.data
    },
  }) : undefined
  return { store, table, start: () => { if (controller.signal.aborted) controller = new AbortController(); table?.start() }, dispose: () => { controller.abort(); store.stop(); table?.dispose() } }
}
