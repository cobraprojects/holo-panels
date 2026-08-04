import { createPanelPageLoad } from '@holo-js/panels-sveltekit/server'
import { panelsRegistry } from '$lib/server/panels/registry'

export const load = createPanelPageLoad({ panelId: 'admin', registry: panelsRegistry })
