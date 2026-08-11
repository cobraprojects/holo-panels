// @holo-panels-managed sha256:69ff6f3c9e0a1a5ab930d962cca23886898477ad69b0ef4f6d10546e4ec2aee4
import { createGeneratedSvelteKitPanelsRegistry, createPanelAuthHandler } from '@holo-js/panels-sveltekit/server'
import serverRegistry from '../../../../../../../.holo-js/generated/panels/server-registry'

const registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)
const handler = createPanelAuthHandler({ panelIds: ['admin'], registry })

export const GET = handler.GET
export const POST = handler.POST
