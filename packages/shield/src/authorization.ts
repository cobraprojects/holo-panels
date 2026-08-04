import type {
  ShieldAuthorizationCheck,
  ShieldAuthorizationComposition,
  ShieldAuthorizationLayer,
} from './contracts'

export class ShieldLayerAuthorizationError extends Error {
  readonly layer: ShieldAuthorizationLayer

  constructor(layer: ShieldAuthorizationLayer) {
    super(`Shield authorization failed at the ${layer} layer`)
    this.name = 'ShieldLayerAuthorizationError'
    this.layer = layer
  }
}

async function pass(layer: ShieldAuthorizationLayer, check: ShieldAuthorizationCheck): Promise<void> {
  if (await check() === false) throw new ShieldLayerAuthorizationError(layer)
}

export async function composeShieldAuthorization(composition: ShieldAuthorizationComposition): Promise<void> {
  await pass('panel', composition.panelAccess)
  if (composition.tenantAccess) await pass('tenant', composition.tenantAccess)
  await pass('shield', composition.shield)
  await pass('policy', composition.policy)
  await pass('invariant', composition.invariant)
}
