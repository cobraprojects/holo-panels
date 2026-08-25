// @holo-panels-managed sha256:c30ae40027b9ca8c50defaa0df398e19612fd5352af2d64dc017de9f937194c6
'use client'

import '../../../../../.holo-js/generated/panels/theme.css'
import { NextPanelMultiFactorPage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelMultiFactorPage panelId="admin" />
}
