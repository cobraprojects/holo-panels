import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import PanelAuthPage from '../src/AuthPage.svelte'
import PanelLoginPage from '../src/LoginPage.svelte'
import PanelMultiFactorPage from '../src/MultiFactorPage.svelte'
import PanelProfilePage from '../src/ProfilePage.svelte'

describe('SvelteKit panel authentication pages', () => {
  it('renders isolated framework-owned registration, MFA, and profile pages from panel configuration', () => {
    const registration = render(PanelAuthPage, { props: { brandName: 'Control', loginPath: '/cp/login', panelId: 'cp', type: 'registration' } }).body
    const multiFactor = render(PanelMultiFactorPage, { props: { brandName: 'Control', panelId: 'cp' } }).body
    const profile = render(PanelProfilePage, { props: { brandName: 'Control', panelId: 'cp' } }).body

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
      render(PanelAuthPage, { props: { appearance, brandName: 'Control', panelId: 'cp', type: 'registration' } }).body,
      render(PanelLoginPage, { props: { appearance, brandName: 'Control', panelId: 'cp' } }).body,
      render(PanelMultiFactorPage, { props: { appearance, brandName: 'Control', panelId: 'cp' } }).body,
      render(PanelProfilePage, { props: { appearance, brandName: 'Control', panelId: 'cp' } }).body,
    ]
    const legacy = render(PanelProfilePage, { props: { brandName: 'Control', panelId: 'cp', themeColors: { primary: '#654321' } } }).body

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
