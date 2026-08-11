// @holo-panels-managed sha256:463073eb0f67d14d685ec9e9d34d4bac917d6661f90d10b82952cd1e36bbd850
import { createGeneratedNuxtPanelsRuntime, createPanelOperationHandler } from '@holo-js/panels-nuxt/server'
import serverRegistry from '../../../../../.holo-js/generated/panels/server-registry'

const runtime = createGeneratedNuxtPanelsRuntime(serverRegistry)

export default createPanelOperationHandler({ panelIds: ['admin'], runtime })
