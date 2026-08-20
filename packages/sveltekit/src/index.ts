import type { Component } from 'svelte'
import { SvelteComponentRegistry } from '@holo-js/panels-svelte'
import RawPanelPage from './PanelPage.svelte'
import RawLoginPage from './LoginPage.svelte'
import RawAuthPage from './AuthPage.svelte'
import RawMultiFactorPage from './MultiFactorPage.svelte'
import RawProfilePage from './ProfilePage.svelte'
import type { SvelteKitPanelAuthAppearance } from './auth-appearance'
import type { PanelPageProps } from './contracts'

export type { SvelteKitPanelAuthAppearance } from './auth-appearance'

type AuthAppearanceProps = {
  appearance?: SvelteKitPanelAuthAppearance
  brandName: string
  panelId: string
  simplePageMaxContentWidth?: string
  theme?: 'dark' | 'light' | 'system'
  themeColors?: Readonly<Record<string, string>>
}

export const PanelPage: Component<PanelPageProps> = RawPanelPage
export const PanelLoginPage: Component<AuthAppearanceProps & { forgotPasswordPath?: string, registrationPath?: string }> = RawLoginPage
export const PanelAuthPage: Component<AuthAppearanceProps & { loginPath?: string, type: 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration' }> = RawAuthPage
export const PanelMultiFactorPage: Component<AuthAppearanceProps> = RawMultiFactorPage
export const PanelProfilePage: Component<AuthAppearanceProps> = RawProfilePage

export function createSvelteKitPanelComponentRegistry(): SvelteComponentRegistry {
  return new SvelteComponentRegistry()
}

export * from './contracts'
