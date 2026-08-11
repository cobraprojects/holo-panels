// @holo-panels-managed sha256:493479b059a66ad62e55b050e2ad9ed4f5da257b0f3a8f3c512601affb709a77
'use client'

import '@holo-js/panels-react/style.css'
import { createNextPanelComponentRegistry, NextPanelClient, type NextPanelClientProps } from '@holo-js/panels-next/client'
import { registerPanelPluginRenderers } from '../../../.holo-js/generated/panels/plugin-renderers'

const registry = registerPanelPluginRenderers(createNextPanelComponentRegistry())

export function PanelsClient(props: Pick<NextPanelClientProps, 'payload'>) {
  return <NextPanelClient {...props} registry={registry} />
}
