import type { PanelAuthorizationRequest, PanelPlugin } from '@holo-js/panels-core'
import type { ShieldActorIdentity, ShieldRepository, ShieldTenantId } from './contracts'
import { createShieldEvaluator } from './evaluator'
import { assertShieldActor, assertShieldIdentifier, assertShieldPermissionKey, assertShieldTenantId } from './validation'

export interface ShieldPluginOptions<TActor, TTenant = unknown> {
  readonly actor: (
    request: PanelAuthorizationRequest<TActor, TTenant>,
  ) => ShieldActorIdentity | Promise<ShieldActorIdentity>
  readonly directPermissions?: boolean
  readonly namespace?: string
  readonly repository: ShieldRepository
  readonly tenant: (
    request: PanelAuthorizationRequest<TActor, TTenant>,
  ) => ShieldTenantId | Promise<ShieldTenantId>
}

export interface ShieldPanelPlugin<TActor, TTenant = unknown> extends PanelPlugin<TActor, TTenant> {
  readonly id: 'shield'
}

function permissionKey(permission: string, namespace: string, panelId: string): string {
  assertShieldPermissionKey(permission)
  if (permission.startsWith(`${namespace}.`)) return permission
  const relative = permission.startsWith(`${panelId}.`) ? permission.slice(panelId.length + 1) : permission
  const resolved = `${namespace}.${relative}`
  assertShieldPermissionKey(resolved)
  return resolved
}

export function shield<TActor, TTenant = unknown>(
  options: ShieldPluginOptions<TActor, TTenant>,
): ShieldPanelPlugin<TActor, TTenant> {
  if (typeof options.actor !== 'function' || typeof options.tenant !== 'function') {
    throw new TypeError('Shield plugins require actor and tenant resolvers')
  }
  if (options.namespace !== undefined) assertShieldIdentifier(options.namespace, 'Shield namespaces')
  const actor = options.actor
  const evaluator = createShieldEvaluator({
    directPermissions: options.directPermissions,
    repository: options.repository,
  })
  const namespaceOption = options.namespace
  const tenant = options.tenant

  return Object.freeze({
    compatibility: Object.freeze({
      panels: Object.freeze({ minimum: '0.0.0' }),
      protocol: Object.freeze({ minimum: '1.0' }),
    }),
    id: 'shield',
    install(panel: { readonly guard: string, readonly id: string }) {
      const namespace = namespaceOption ?? panel.id
      assertShieldIdentifier(namespace, 'Shield namespaces')
      return Object.freeze({
        authorizationLayer: Object.freeze({
          id: 'shield',
          async authorize(request: PanelAuthorizationRequest<TActor, TTenant>): Promise<void> {
            request.signal.throwIfAborted()
            if (request.panelId !== panel.id || request.guard !== panel.guard) {
              throw new Error('Shield authorization requests must match the installed panel and guard')
            }
            const [identity, tenantId] = await Promise.all([actor(request), tenant(request)])
            assertShieldActor(identity)
            assertShieldTenantId(tenantId)
            request.signal.throwIfAborted()
            await evaluator.authorize({
              actor: Object.freeze({ ...identity }),
              permission: permissionKey(request.permission, namespace, panel.id),
              tenantId,
            })
          },
        }),
        contributions: Object.freeze([]),
        id: 'shield',
        permissionNamespace: namespace,
      })
    },
    packageName: '@holo-js/panels-shield',
  })
}
