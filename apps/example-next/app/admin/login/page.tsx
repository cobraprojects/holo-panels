// @holo-panels-managed sha256:eaf2870ee8f7b71413e253bcb2fb98139bd3a13ce2845ab2e6ca611ec50614bf
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelLoginPage } from '@holo-js/panels-next/client'

export default function LoginPage() {
  return <NextPanelLoginPage brandName={"Holo Panels Admin"} panelId="admin" simplePageMaxContentWidth="lg" theme="system" appearance={{"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}}} />
}
