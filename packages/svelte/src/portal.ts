import { getContext, setContext } from 'svelte'

export type PanelsPortalTarget = () => Element | string | undefined

const PANELS_PORTAL_CONTEXT = Symbol.for('holo-panels-portal')
const defaultPortalTarget: PanelsPortalTarget = () => undefined

export function panelsPortalTarget(): PanelsPortalTarget {
  return getContext<PanelsPortalTarget>(PANELS_PORTAL_CONTEXT) ?? defaultPortalTarget
}

export function setPanelsPortalTarget(target: PanelsPortalTarget): void {
  setContext(PANELS_PORTAL_CONTEXT, target)
}
