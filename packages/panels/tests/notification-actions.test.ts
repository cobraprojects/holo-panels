import { column, defineGeneratedTable, defineModel } from '@holo-js/db'
import { definePolicy } from '@holo-js/authorization'
import { configureNotificationsRuntime, resetNotificationsRuntime, type NotificationRecord, type NotificationStore } from '@holo-js/notifications'
import { afterEach, describe, expect, it } from 'vitest'
import { configureSecurityRuntime, resetSecurityRuntime } from '@holo-js/security'
import { ClientToastStore, Notification, Resource, definePanel } from '../src'
import { databaseNotificationPayload, decodeResponseEnvelope, notificationPresentation, type PanelNotificationStore } from '@holo-js/panels-core'
import { executePanelDatabaseNotificationOperation, executePanelPipeline, takePanelNotificationEffects } from '@holo-js/panels-core/server'

const Post = defineModel(defineGeneratedTable('notification_posts', { id: column.id(), title: column.string() }), { fillable: ['title'] })
class Member {
  static readonly definition = { primaryKey: 'uuid' }
  readonly uuid = 'member-1'
}
definePolicy('notification-posts', Post, { class: { viewAny: () => true } })

afterEach(() => { resetNotificationsRuntime(); resetSecurityRuntime() })

function resource(allowed = true, execute = () => ({ attempt: 1, retried: true })) {
  return class PostResource extends Resource {
    protected static override model = Post
    static override slug = 'posts'
    static override isScopedToTenant = false
    static retry = this.action(({ Action }) => Action.make('retry').requiresConfirmation('Retry publishing?').authorize(() => allowed).action(execute))
  }
}

describe('resource-owned notification actions', () => {
  it('confirms nested toast actions, reauthorizes their parent, and submits only once', async () => {
    configureSecurityRuntime({ config: {}, csrfSigningKey: 'nested-notification-action-test-key' })
    let allowed = true
    let attempts = 0
    class PostResource extends Resource {
      protected static override model = Post
      static override isScopedToTenant = false
      static retry = this.action(({ Action }) => Action.make('retry').authorize(() => allowed).registerModalActions([
        Action.make('retry-later').requiresConfirmation('Schedule another attempt?').action(() => ({ attempt: ++attempts })),
      ]))
    }
    const panel = definePanel('admin').compile()
    const scope = { actor: { id: 1 }, guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }
    const effects = await executePanelPipeline(panel, scope, 'action', async () => {
      await Notification.make('nested-toast').title('Publishing failed').persistent().actions([PostResource.retry]).send()
      return takePanelNotificationEffects()
    })
    const response = decodeResponseEnvelope(JSON.parse(JSON.stringify({ data: null, effects, id: 'nested-toast', ok: true, protocolVersion: '1.0' })))
    const effect = response.effects[0]
    if (effect?.kind !== 'toast' || !('presentation' in effect)) throw new Error('Expected a toast')
    const registry = { 'admin:resource:notification-posts': async () => PostResource }
    const store = new ClientToastStore()
    store.connectActions({ executeToastAction: async (token, request) => {
      const result = await executePanelDatabaseNotificationOperation({
        panel,
        payload: { action: 'execute-toast', actionId: request.actionId, idempotencyKey: request.idempotencyKey, input: request.input, token },
        registry,
        scope,
        transaction: { run: operation => operation() },
      })
      if (!('status' in result)) throw new Error('Expected an action result')
      return result
    } })
    try {
      store.push(effect.presentation)
      const host = store.actionHost('nested-toast')
      const parent = host?.actions[0]
      const child = parent?.modal?.actions?.[0]
      if (!host || !parent || !child) throw new Error('Expected nested toast actions')
      host.store.mount(parent)
      host.store.mount(child)
      expect(() => host.store.submit()).toThrow('must be confirmed')
      expect(attempts).toBe(0)
      host.store.confirm()
      allowed = false
      await expect(host.store.submit()).rejects.toThrow('not authorized')
      expect(host.store.activeFrame?.manifest.id).toBe('retry')
      expect(host.store.activeFrame?.error).toBeNull()
      expect(attempts).toBe(0)
      allowed = true
      host.store.mount(child)
      host.store.confirm()
      const first = host.store.submit()
      expect(host.store.submit()).toBe(first)
      await expect(first).resolves.toMatchObject({ result: { attempt: 1 }, status: 'succeeded' })
      host.store.close()
      expect(host.store.activeFrame?.manifest.id).toBe('retry')
      store.dismiss('nested-toast')
      expect(host.store.activeFrame).toBeNull()
      expect(store.state.items).toEqual([])
    } finally {
      store.dispose()
    }
  })

  it('sends executable toasts without an inbox and reauthorizes signed actions against the current resource', async () => {
    configureSecurityRuntime({ config: {}, csrfSigningKey: 'notification-action-test-key' })
    let allowed = true
    let attempts = 0
    const Original = resource()
    const panel = definePanel('admin').compile()
    const scope = { actor: { id: 1 }, guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }
    const effects = await executePanelPipeline(panel, scope, 'action', async () => {
      await Notification.make('toast-1').title('Publishing failed').actions([Original.retry]).send()
      return takePanelNotificationEffects()
    })
    expect(effects).toMatchObject([{ kind: 'toast', presentation: { actions: [{ actionManifest: { confirmation: 'Retry publishing?', mount: 'notification' }, token: expect.any(String) }] } }])
    const effect = decodeResponseEnvelope(JSON.parse(JSON.stringify({ data: null, effects, id: 'send-toast', ok: true, protocolVersion: '1.0' }))).effects[0]
    if (effect?.kind !== 'toast' || !('presentation' in effect)) throw new Error('Expected a toast')
    const action = effect.presentation.actions[0]
    if (!action || typeof action !== 'object' || Array.isArray(action) || typeof action.token !== 'string') throw new Error('Expected an executable action')
    const registry = { 'admin:resource:notification-posts': async () => resource(allowed, () => ({ attempt: ++attempts, retried: true })) }
    const options = { panel, registry, scope, transaction: { run: <TResult>(operation: () => Promise<TResult>) => operation() } }
    const payload = { action: 'execute-toast', actionId: 'retry', idempotencyKey: 'toast-retry', input: {}, token: action.token }
    expect(await executePanelDatabaseNotificationOperation({ ...options, payload })).toMatchObject({ result: { attempt: 1 }, status: 'succeeded' })
    expect(await executePanelDatabaseNotificationOperation({ ...options, payload, scope: { ...scope, actor: { id: 1 } } })).toMatchObject({ effects: [], result: { attempt: 1 } })
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload, scope: { ...scope, actor: { id: 2 } } })).rejects.toThrow()
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload: { ...payload, token: `${action.token}x` } })).rejects.toThrow()
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload: { ...payload, actionId: 'unattached' } })).rejects.toThrow()
    allowed = false
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload })).rejects.toThrow('not authorized')
  })
  it('executes only children registered under an attached notification action', async () => {
    let allowed = true
    const makeResource = () => class PostResource extends Resource {
      protected static override model = Post
      static override isScopedToTenant = false
      static retry = this.action(({ Action }) => Action.make('retry').authorize(() => allowed).registerModalActions([
        Action.make('retry-later').action(() => 'scheduled'),
      ]))
    }
    const Original = makeResource()
    const presentation = notificationPresentation(Notification.make('notice').title('Retry').actions([Original.retry]).toPayload())
    const data = databaseNotificationPayload(presentation, { guard: 'web', panelId: 'admin', tenantId: null })
    const store: PanelNotificationStore = {
      delete: async () => 0,
      list: async (_query, pagination) => ({ ...pagination, records: [{ createdAt: new Date(), data, id: 'saved-1', notifiableId: 1, notifiableType: 'User', updatedAt: new Date() }], total: 1, unread: 1 }),
      markAsRead: async () => 0,
      markAsUnread: async () => 0,
    }
    const panel = definePanel('admin').databaseNotifications().databaseNotificationInbox({ authorize: () => true, resolve: () => ({ realtimeChannel: null, recipient: { id: 1, type: 'User' }, tenantId: null }) }).compile()
    const options = { panel, registry: { 'admin:resource:notification-posts': async () => makeResource() }, scope: { actor: { id: 1 }, guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }, store, transaction: { run: <TResult>(operation: () => Promise<TResult>) => operation() } }
    const payload = { action: 'execute', actionId: 'retry-later', idempotencyKey: 'nested-retry', input: {}, notificationId: 'saved-1' }
    expect(await executePanelDatabaseNotificationOperation({ ...options, payload })).toMatchObject({ result: 'scheduled', status: 'succeeded' })
    allowed = false
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload })).rejects.toThrow('not authorized')
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload: { ...payload, actionId: 'unattached' } })).rejects.toThrow()
  })
  it('sends through Holo Notifications in the active panel without application registration', async () => {
    const records: NotificationRecord[] = []
    const store: NotificationStore = {
      create: async record => { records.push(record) },
      delete: async () => 0,
      list: async (_query, pagination) => ({ ...pagination, records, total: records.length, unread: records.length }),
      markAsRead: async () => 0,
      markAsUnread: async () => 0,
      unread: async (_query, pagination) => ({ ...pagination, records, total: records.length, unread: records.length }),
    }
    configureNotificationsRuntime({ store })
    class User { readonly id = 1 }
    const actor = new User()
    const panel = definePanel('admin').databaseNotifications().databaseNotificationInbox({ authorize: () => true, resolve: () => ({ realtimeChannel: null, recipient: { id: 1, type: 'User' }, tenantId: null }) }).compile()
    const scope = { actor, guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }
    const Original = resource()
    const effects = await executePanelPipeline(panel, scope, 'action', async () => {
      await Notification.make().title('Publishing failed').actions([Original.retry]).sendToDatabase(actor)
      await Notification.make().title('Notification sent').success().send()
      return takePanelNotificationEffects()
    })
    expect(effects).toMatchObject([{ kind: 'toast', presentation: { status: 'success', title: 'Notification sent' } }])
    const page = await executePanelDatabaseNotificationOperation({ panel, payload: { action: 'list', page: 1, pageSize: 20 }, registry: { 'admin:resource:notification-posts': async () => resource() }, scope })
    expect(page).toMatchObject({ items: [{ presentation: { actions: [{ actionManifest: { id: 'retry', mount: 'notification' } }], title: 'Publishing failed' } }] })
    expect(takePanelNotificationEffects()).toEqual([])
    await expect(Notification.make().title('Outside request').send()).rejects.toThrow('active server panel request')
  })

  it.each([() => ({ id: 1 }), () => new Member()])('resolves and reauthorizes saved notification actions for actor identity %#', async (createActor) => {
    const Original = resource()
    const presentation = notificationPresentation(Notification.make('notice').title('Publishing failed').actions([Original.retry]).toPayload())
    const data = JSON.parse(JSON.stringify(databaseNotificationPayload(presentation, { guard: 'web', panelId: 'admin', tenantId: null })))
    const store: PanelNotificationStore = {
      delete: async () => 0,
      list: async (_query, pagination) => ({ ...pagination, records: [{ createdAt: new Date(), data, id: 'saved-1', notifiableId: 1, notifiableType: 'User', updatedAt: new Date() }], total: 1, unread: 1 }),
      markAsRead: async () => 0,
      markAsUnread: async () => 0,
    }
    const panel = definePanel('admin').databaseNotifications().databaseNotificationInbox({ authorize: () => true, resolve: () => ({ realtimeChannel: null, recipient: { id: 1, type: 'User' }, tenantId: null }) }).compile()
    const scope = { actor: createActor(), guard: 'web', panelId: 'admin', provider: 'users', signal: new AbortController().signal }
    let allowed = true
    let disabled = false
    let removed = false
    let attempts = 0
    const registry = { 'admin:resource:notification-posts': async () => {
      const definition = resource(allowed, () => ({ attempt: ++attempts, retried: true }))
      definition.retry.disabled(disabled)
      if (removed) Reflect.deleteProperty(definition, 'retry')
      return definition
    } }
    const options = { panel, registry, scope, store, transaction: { run: <TResult>(operation: () => Promise<TResult>) => operation() } }
    const payload = { action: 'execute', actionId: 'retry', idempotencyKey: 'retry-1', input: {}, notificationId: 'saved-1' }
    expect(await executePanelDatabaseNotificationOperation({ ...options, payload: { action: 'list', page: 1, pageSize: 20 } })).toMatchObject({ items: [{ presentation: { actions: [{ actionManifest: { confirmation: 'Retry publishing?', id: 'retry', mount: 'notification' } }] } }] })
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload: { ...payload, notificationId: 'foreign' } })).rejects.toThrow('denied')
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload: { ...payload, actionId: 'unattached' } })).rejects.toThrow('denied')
    expect(await executePanelDatabaseNotificationOperation({ ...options, payload })).toMatchObject({ result: { attempt: 1, retried: true }, status: 'succeeded' })
    expect(await executePanelDatabaseNotificationOperation({ ...options, payload, scope: { ...scope, actor: createActor() } })).toMatchObject({ effects: [], result: { attempt: 1 }, status: 'succeeded' })
    disabled = true
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload })).rejects.toThrow('not available')
    disabled = false
    allowed = false
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload })).rejects.toThrow('not authorized')
    allowed = true
    removed = true
    await expect(executePanelDatabaseNotificationOperation({ ...options, payload })).rejects.toThrow('no longer registered')
    expect(await executePanelDatabaseNotificationOperation({ ...options, payload: { action: 'list', page: 1, pageSize: 20 } })).toMatchObject({ items: [{ presentation: { actions: [] } }] })
  })
})
