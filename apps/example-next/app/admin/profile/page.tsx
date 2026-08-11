// @holo-panels-managed sha256:654d422c8cfa97ee9612a6d7ae38f6f7cfd001e7e8b8eed84a8bbe330c452ea6
'use client'

import '@holo-js/panels-react/style.css'
import { NextPanelProfilePage } from '@holo-js/panels-next/client'

export default function AuthPage() {
  return <NextPanelProfilePage brandName={"Holo Panels Admin"} panelId="admin" simplePageMaxContentWidth="lg" theme="system" themeColors={{"primary":"#7c3aed"}} />
}
