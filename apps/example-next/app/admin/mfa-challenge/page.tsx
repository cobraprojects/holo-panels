// @holo-panels-managed sha256:93cf160400e86aa17837b87e235df1410fdcd37be7b519fe397ef424182e793b
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelAuthPage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelAuthPage brandName={"Holo Panels Admin"} loginPath="/admin/login" panelId="admin" simplePageMaxContentWidth="lg" theme="system" appearance={{"colors":{"primary":"#7c3aed"},"density":"comfortable","fontFamily":null,"monoFontFamily":null,"serifFontFamily":null,"tokens":{}}} type="mfa-challenge" />
}
