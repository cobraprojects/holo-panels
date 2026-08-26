// @holo-panels-managed sha256:d83bc6730f8c69cf015bc7e1eb631588f2cca489e621b478a79b85942216b8dc
import { createGeneratedSvelteKitPanelsRegistry, createPanelPageLoad } from '@holo-js/panels-sveltekit/server'
import serverRegistry from '../../../../.holo-js/generated/panels/server-registry'

const registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)

export const load = createPanelPageLoad({ panelId: 'admin', registry })
