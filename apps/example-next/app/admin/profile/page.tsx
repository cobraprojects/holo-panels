// @holo-panels-managed sha256:873e6e8fe722fe4a3bfe38196e3c8b57700aa90a0210a7ef4063fe32e028b03f
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelProfilePage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelProfilePage brandName={"Holo Panels Admin"} panelId="admin" simplePageMaxContentWidth="lg" theme="system" appearance={{"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}}} />
}
