// @holo-panels-managed sha256:b7f940a69a6b9c0f85100ee1d58df8f6f72a24b7b477df7c6e4e00e29b8c7872
import { createGeneratedSvelteKitPanelsRegistry, createPanelTenantHandler } from '@holo-js/panels-sveltekit/server'
import serverRegistry from '../../../../../../../.holo-js/generated/panels/server-registry'

const registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)
const handler = createPanelTenantHandler({ panelIds: ['admin'], registry })

export const GET = handler.GET
export const POST = handler.POST
