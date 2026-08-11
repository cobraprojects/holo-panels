// @holo-panels-managed sha256:632af60a0575ce7d39df5cab7b606021354c00cd80d1738441a6b73ca1ef2588
import { createGeneratedSvelteKitPanelsRegistry, createPanelOperationHandler } from '@holo-js/panels-sveltekit/server'
import serverRegistry from '../../../../../../.holo-js/generated/panels/server-registry'

const registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)
const handler = createPanelOperationHandler({ panelIds: ['admin'], registry })

export const GET = handler.GET
export const POST = handler.POST
