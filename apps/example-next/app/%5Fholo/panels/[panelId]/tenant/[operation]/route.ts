import { createPanelTenantRoute } from '@holo-js/panels-next/server'
import { panelsRuntime } from '~/server/panels/runtime'

const route = createPanelTenantRoute({ panelIds: ['admin'], runtime: panelsRuntime })

export const GET = route.GET
export const POST = route.POST
