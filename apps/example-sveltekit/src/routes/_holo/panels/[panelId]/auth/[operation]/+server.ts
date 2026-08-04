import { createPanelAuthHandler } from '@holo-js/panels-sveltekit/server'
import { panelsRegistry } from '$lib/server/panels/registry'

const handler = createPanelAuthHandler({ panelIds: ['admin'], registry: panelsRegistry })

export const GET = handler.GET
export const POST = handler.POST
