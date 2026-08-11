// @holo-panels-managed sha256:540adc32f9485d0eddb1f55a5c4cc912f0afbe6778c2399fa0b0e39c99a4d719
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelMultiFactorPage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelMultiFactorPage brandName={"Holo Panels Admin"} panelId="admin" simplePageMaxContentWidth="lg" theme="system" themeColors={{"primary":"#7c3aed"}} />
}
