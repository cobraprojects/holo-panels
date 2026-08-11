// @holo-panels-managed sha256:bbfcb13c54843917fbd0255160060cce3afa3fac6ede468dc6ecd319ef1312b2
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelLoginPage } from '@holo-js/panels-next/client'

export default function LoginPage() {
  return <NextPanelLoginPage brandName={"Holo Panels Admin"} panelId="admin" simplePageMaxContentWidth="lg" theme="system" themeColors={{"primary":"#7c3aed"}} />
}
