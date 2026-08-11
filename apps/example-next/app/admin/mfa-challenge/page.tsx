// @holo-panels-managed sha256:cbd073bac517d4b26f163732f22669e3f7415e7029c59d3b5bfa3ce5b093bbc0
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelAuthPage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelAuthPage brandName={"Holo Panels Admin"} loginPath="/admin/login" panelId="admin" simplePageMaxContentWidth="lg" theme="system" themeColors={{"primary":"#7c3aed"}} type="mfa-challenge" />
}
