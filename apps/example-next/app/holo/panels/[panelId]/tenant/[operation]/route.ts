// @holo-panels-managed sha256:4fd86412251db69f71065065062f54cd183ebcca926c7a28a3cc4d4c49b78f08
import { createGeneratedNextPanelsRuntime, createPanelTenantRoute } from '@holo-js/panels-next/server'
import serverRegistry from '../../../../../../.holo-js/generated/panels/server-registry'

const runtime = createGeneratedNextPanelsRuntime(serverRegistry)
const route = createPanelTenantRoute({ panelIds: ['admin'], runtime })

export const GET = route.GET
export const POST = route.POST
