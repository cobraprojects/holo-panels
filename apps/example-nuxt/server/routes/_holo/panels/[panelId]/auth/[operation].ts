import { createPanelAuthHandler } from '@holo-js/panels-nuxt/server'
import { panelsRuntime } from '../../../../../panels/runtime'

export default createPanelAuthHandler({ panelIds: ['admin'], runtime: panelsRuntime })
