// @holo-panels-managed sha256:878d1c3a64d9cf25541a8f70e16ff3fa3707740a2fedbb125bd555fe3ad85705
import { createGeneratedNuxtPanelsRuntime, createPanelTenantHandler } from '@holo-js/panels-nuxt/server'
import serverRegistry from '../../../../../../.holo-js/generated/panels/server-registry'

const runtime = createGeneratedNuxtPanelsRuntime(serverRegistry)

export default createPanelTenantHandler({ panelIds: ['admin'], runtime })
