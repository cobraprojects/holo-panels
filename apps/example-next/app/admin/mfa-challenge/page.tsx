// @holo-panels-managed sha256:a60896c0c940cb20b140d3cf35c4973f757de7dde70f49eff29429669f762234
'use client'

import '../../../.holo-js/generated/panels/theme.css'
import { NextPanelAuthPage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelAuthPage panelId="admin" type="mfa-challenge" />
}
