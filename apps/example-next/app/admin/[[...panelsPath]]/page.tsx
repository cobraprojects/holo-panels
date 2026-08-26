// @holo-panels-managed sha256:d1a7d6837b91439e7ca7ac6ef179454254d57fc981679ded7e9fd4ec1e14b507
import { createGeneratedNextPanelsRuntime, createPanelPage } from '@holo-js/panels-next'
import serverRegistry from '../../../.holo-js/generated/panels/server-registry'
import { PanelsClient } from './panels-client'

const runtime = createGeneratedNextPanelsRuntime(serverRegistry)

export default createPanelPage({ client: PanelsClient, panelId: 'admin', runtime })
