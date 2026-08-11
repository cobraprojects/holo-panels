// @holo-panels-managed sha256:2b80160c76e79b445991f2b3a3b847f26c7f374eb25a1ae2df16b4295535db22
import { createGeneratedSvelteKitPanelsRegistry, createPanelPageLoad } from '@holo-js/panels-sveltekit/server'
import serverRegistry from '../../../../.holo-js/generated/panels/server-registry'

const registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)

export const load = createPanelPageLoad({ loginPath: '/admin/login', panelId: 'admin', registry })
