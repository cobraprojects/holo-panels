// @holo-panels-managed sha256:dc39e8e4c033bbdeff609a92c8268a171f9b67abc7547a5fc01d9e28b1a9ae7b
'use client'

import '../../../.holo-js/generated/panels/theme.css'
import { createNextPanelComponentRegistry, NextPanelClient, type NextPanelClientProps } from '@holo-js/panels-next/client'
import { registerPanelApplicationRenderers } from '../../../.holo-js/generated/panels/application-renderers'
import { registerPanelPluginRenderers } from '../../../.holo-js/generated/panels/plugin-renderers'

const registry = registerPanelApplicationRenderers(registerPanelPluginRenderers(createNextPanelComponentRegistry()))

export function PanelsClient(props: Pick<NextPanelClientProps, 'payload'>) {
  return <NextPanelClient {...props} registry={registry} />
}
