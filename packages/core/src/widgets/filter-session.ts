import { authRuntimeInternals } from '@holo-js/auth'
import { actionCacheIdentity } from '../actions/identity'
import type { JsonObject } from '../protocol/json'
import type { WidgetContext } from './contracts'

export async function dashboardFilterSession(context: WidgetContext<unknown, unknown, unknown>, dashboardId: string, guard: string) {
  const runtime = authRuntimeInternals.getRuntimeBindings()
  const sessionId = runtime.context.getSessionId(guard)
  if (!sessionId || !runtime.session.write) throw new Error('Persisted dashboard filters require an authenticated Holo session')
  if (runtime.config.guards[guard]?.driver !== 'session') throw new Error('Dashboard persistence requires a session guard')
  const key = `panels.dashboard.filters:${JSON.stringify([context.panelId, dashboardId, actionCacheIdentity(context.actor), actionCacheIdentity(context.tenant)])}`
  const session = await runtime.session.read(sessionId)
  if (!session) throw new Error('The dashboard session is no longer active')
  return {
    read(): JsonObject {
      const value = session.data[key]
      return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
    },
    async write(value: JsonObject | null): Promise<void> {
      const current = await runtime.session.read(sessionId, { store: session.store })
      if (!current) throw new Error('The dashboard session is no longer active')
      const data = { ...current.data }
      if (value === null) delete data[key]
      else data[key] = value
      await runtime.session.write!({ ...current, data })
    },
  }
}
