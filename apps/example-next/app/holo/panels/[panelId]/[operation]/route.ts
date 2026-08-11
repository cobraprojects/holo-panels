// @holo-panels-managed sha256:86afb3516f574fa4eb5b520d486dd546d455f5dc71010ba550dd60964f48fcaa
import { createGeneratedNextPanelsRuntime, createPanelOperationRoute } from '@holo-js/panels-next'
import serverRegistry from '../../../../../.holo-js/generated/panels/server-registry'

const runtime = createGeneratedNextPanelsRuntime(serverRegistry)
const route = createPanelOperationRoute({ panelIds: ['admin'], runtime })

export const DELETE = route.DELETE
export const GET = route.GET
export const PATCH = route.PATCH
export const POST = route.POST
export const PUT = route.PUT
