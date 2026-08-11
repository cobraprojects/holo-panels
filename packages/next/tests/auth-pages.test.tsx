import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NextPanelAuthPage } from '../src/auth-page'
import { NextPanelMultiFactorPage } from '../src/multi-factor-page'
import { NextPanelProfilePage } from '../src/profile-page'

describe('Next panel authentication pages', () => {
  it('renders isolated framework-owned registration, MFA, and profile pages from panel configuration', () => {
    const registration = renderToString(<NextPanelAuthPage brandName="Control" loginPath="/cp/login" panelId="cp" type="registration" />)
    const multiFactor = renderToString(<NextPanelMultiFactorPage brandName="Control" panelId="cp" />)
    const profile = renderToString(<NextPanelProfilePage brandName="Control" panelId="cp" />)

    expect(registration).toContain('Create an account')
    expect(registration).toContain('data-slot="input"')
    expect(registration).toContain('/cp/login')
    expect(multiFactor).toContain('Begin enrollment')
    expect(profile).toContain('Manage your account information')
  })
})
