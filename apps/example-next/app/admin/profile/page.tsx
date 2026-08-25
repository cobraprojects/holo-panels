// @holo-panels-managed sha256:5b72c96f49660266b042dd4b81c441e0b908115a0e89b1e29c7e0d66805358db
'use client'

import '../../../.holo-js/generated/panels/theme.css'
import { NextPanelProfilePage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelProfilePage panelId="admin" />
}
