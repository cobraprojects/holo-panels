import {
  AuthorizationPolicyNotFoundError,
  forUser,
  type AuthorizationPolicyTarget,
  type PolicyActionFor,
} from '@holo-js/authorization'

export function isHoloPolicyMissingError(error: unknown): boolean {
  return error instanceof AuthorizationPolicyNotFoundError
}

export async function canHoloPolicy<TTarget extends AuthorizationPolicyTarget | object>(
  actor: object | null,
  action: string,
  target: TTarget,
  strict = false,
): Promise<boolean> {
  try {
    return await forUser(actor).can(action as PolicyActionFor<TTarget>, target)
  } catch (error) {
    if (error instanceof AuthorizationPolicyNotFoundError && !strict) return true
    throw error
  }
}

export async function authorizeHoloPolicy<TTarget extends AuthorizationPolicyTarget | object>(
  actor: object | null,
  action: string,
  target: TTarget,
  strict = false,
): Promise<void> {
  try {
    await forUser(actor).authorize(action as PolicyActionFor<TTarget>, target)
  } catch (error) {
    if (error instanceof AuthorizationPolicyNotFoundError && !strict) return
    throw error
  }
}
