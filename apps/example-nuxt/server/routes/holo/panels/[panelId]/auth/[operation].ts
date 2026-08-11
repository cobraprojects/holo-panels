// @holo-panels-managed sha256:e296654bb62034b5e32a18da426c0158325a192b7ad1b1676348b846b8df4fab
import { createGeneratedNuxtPanelsRuntime, createPanelAuthHandler } from '@holo-js/panels-nuxt/server'
import serverRegistry from '../../../../../../.holo-js/generated/panels/server-registry'

const runtime = createGeneratedNuxtPanelsRuntime(serverRegistry)

export default createPanelAuthHandler({ panelIds: ['admin'], runtime })
