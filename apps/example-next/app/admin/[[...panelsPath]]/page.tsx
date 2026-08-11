// @holo-panels-managed sha256:a5947f6552016f660cba3987b0538474289a99273d6558b64adc57a6d89b3faa
import { createGeneratedNextPanelsRuntime, createPanelPage } from '@holo-js/panels-next'
import serverRegistry from '../../../.holo-js/generated/panels/server-registry'
import { PanelsClient } from './panels-client'

const runtime = createGeneratedNextPanelsRuntime(serverRegistry)

export default createPanelPage({ client: PanelsClient, loginPath: '/admin/login', panelId: 'admin', runtime })
