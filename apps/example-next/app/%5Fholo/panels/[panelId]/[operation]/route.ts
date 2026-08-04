import { createPanelOperationRoute } from '@holo-js/panels-next'
import { panelsRuntime } from '~/server/panels/runtime'

const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: panelsRuntime })

export const GET = route.GET
export const POST = route.POST
