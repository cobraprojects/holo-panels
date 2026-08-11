// @holo-panels-managed sha256:bf1b1b900352be8e48a619e6a7b9ef9f2d0110a4440d153ed70d907e5c21a288
import { createGeneratedNextPanelsRuntime, createPanelAuthRoute } from '@holo-js/panels-next/server'
import serverRegistry from '../../../../../../.holo-js/generated/panels/server-registry'

const runtime = createGeneratedNextPanelsRuntime(serverRegistry)
const route = createPanelAuthRoute({ panelIds: ['admin'], runtime })

export const GET = route.GET
export const POST = route.POST
