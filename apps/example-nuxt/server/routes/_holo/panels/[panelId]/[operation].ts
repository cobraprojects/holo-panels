import { createPanelOperationHandler } from '@holo-js/panels-nuxt/server'
import { panelsRuntime } from '../../../../panels/runtime'

export default createPanelOperationHandler({ panelIds: ['admin'], runtime: panelsRuntime })
