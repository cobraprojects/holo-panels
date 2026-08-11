import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import PanelAuthPage from '../src/AuthPage.svelte'
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
})
