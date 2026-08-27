import type { JsonObject, ResponseEnvelope } from '@holo-js/panels-core'
import { publishPanelActionFailure } from '../notifications/feedback'
import type { PanelsTransport } from '../transport'
import { ClientActionStore } from './store'

export function createWidgetActionStore(options: {
  readonly applyEffects: (response: Readonly<ResponseEnvelope>) => Promise<void>
  readonly panelId: string
  readonly resourceId?: string
  readonly signal?: AbortSignal
  readonly transport: PanelsTransport
  readonly widgetId: string
}): ClientActionStore<JsonObject> {
  return new ClientActionStore<JsonObject>({
    createIdempotencyKey: () => crypto.randomUUID(),
    transport: {
      async execute(request, signal) {
        const response = await options.transport.execute<JsonObject, JsonObject>({ kind: 'mutation', name: 'action', supportsIdempotency: true }, {
          endpoint: `/holo/panels/${encodeURIComponent(options.panelId)}/action`,
          idempotencyKey: request.idempotencyKey,
          panelId: options.panelId,
          payload: {
            actionId: request.actionId,
            idempotencyKey: request.idempotencyKey,
            input: request.input,
            mount: request.mount,
            ...(options.resourceId ? { resourceId: options.resourceId } : {}),
            widgetId: options.widgetId,
          },
          signal: options.signal ? AbortSignal.any([options.signal, signal]) : signal,
        }).catch((cause: unknown) => {
          if (!signal.aborted && !options.signal?.aborted) publishPanelActionFailure(options.panelId)
          throw cause
        })
        try {
          await options.applyEffects(response)
        } catch (cause: unknown) {
          publishPanelActionFailure(options.panelId, response.effects)
          throw cause
        }
        if (!response.ok) {
          publishPanelActionFailure(options.panelId, response.effects)
          throw new Error(response.error.message)
        }
        return { effects: [], items: [], result: response.data, status: 'succeeded' }
      },
    },
  })
}
