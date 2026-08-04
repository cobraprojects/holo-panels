import { createPanelPage } from '@holo-js/panels-next'
import { panelsRuntime } from '~/server/panels/runtime'

export default createPanelPage({ panelId: 'admin', runtime: panelsRuntime })
