import { createPanelAuthRoute } from '@holo-js/panels-next/server'
import { panelsRuntime } from '~/server/panels/runtime'

const route = createPanelAuthRoute({ panelIds: ['admin'], runtime: panelsRuntime })

export const GET = route.GET
export const POST = route.POST
