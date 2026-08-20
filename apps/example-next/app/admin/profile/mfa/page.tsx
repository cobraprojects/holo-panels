// @holo-panels-managed sha256:2883700186c7385b8b0a77491fbe8a4c102b0d28e7c970a3a714031097e14776
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelMultiFactorPage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelMultiFactorPage brandName={"Holo Panels Admin"} panelId="admin" simplePageMaxContentWidth="lg" theme="system" appearance={{"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}}} />
}
