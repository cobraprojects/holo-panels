import { createPanelTenantHandler } from '@holo-js/panels-nuxt/server'
import { panelsRuntime } from '../../../../../panels/runtime'

export default createPanelTenantHandler({ panelIds: ['admin'], runtime: panelsRuntime })
