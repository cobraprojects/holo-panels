import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NextPanelAuthPage } from '../src/auth-page'
import { NextPanelLoginPage } from '../src/login-page'
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

  it('applies complete appearance variables to every surface while preserving themeColors', () => {
    const appearance = {
      colors: { primary: '#123456' },
      density: 'compact',
      fontFamily: 'Panel Sans',
      monoFontFamily: 'Panel Mono',
      serifFontFamily: 'Panel Serif',
      tokens: { 'radius-lg': '1.25rem' },
    } as const
    const pages = [
      renderToString(<NextPanelAuthPage appearance={appearance} brandName="Control" panelId="cp" type="registration" />),
      renderToString(<NextPanelLoginPage appearance={appearance} brandName="Control" panelId="cp" />),
      renderToString(<NextPanelMultiFactorPage appearance={appearance} brandName="Control" panelId="cp" />),
      renderToString(<NextPanelProfilePage appearance={appearance} brandName="Control" panelId="cp" />),
    ]
    const legacy = renderToString(<NextPanelProfilePage brandName="Control" panelId="cp" themeColors={{ primary: '#654321' }} />)

    for (const page of pages) {
      expect(page).toContain('data-density="compact"')
      expect(page).toContain('--holo-color-primary:#123456')
      expect(page).toContain('--holo-radius-lg:1.25rem')
      expect(page).toContain('--holo-font-sans:Panel Sans')
      expect(page).toContain('--holo-font-mono:Panel Mono')
      expect(page).toContain('--holo-font-serif:Panel Serif')
    }
    expect(legacy).toContain('--holo-color-primary:#654321')
  })
})
