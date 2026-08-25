// @holo-panels-managed sha256:9288356956421c600df8ba66cf9e81076c2a8c275a581b1348c4c1479b2deb75
'use client'

import '../../../../.holo-js/generated/panels/theme.css'
import { NextPanelMultiFactorPage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelMultiFactorPage panelId="admin" />
}
