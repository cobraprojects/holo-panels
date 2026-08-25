import type { Component } from 'svelte'
import { SvelteComponentRegistry } from '@holo-js/panels-svelte'
import RawPanelPage from './PanelPage.svelte'
import RawLoginPage from './LoginPage.svelte'
import RawAuthPage from './AuthPage.svelte'
import RawMultiFactorPage from './MultiFactorPage.svelte'
import RawProfilePage from './ProfilePage.svelte'
import type { PanelPageProps } from './contracts'

export type { SvelteKitPanelAuthAppearance } from './auth-appearance'

type AuthPageProps = {
  panelId: string
}

export const PanelPage: Component<PanelPageProps> = RawPanelPage
export const PanelLoginPage: Component<AuthPageProps> = RawLoginPage
export const PanelAuthPage: Component<AuthPageProps & { type: 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration' }> = RawAuthPage
export const PanelMultiFactorPage: Component<AuthPageProps> = RawMultiFactorPage
export const PanelProfilePage: Component<AuthPageProps> = RawProfilePage

export function createSvelteKitPanelComponentRegistry(): SvelteComponentRegistry {
  return new SvelteComponentRegistry()
}

export * from './contracts'
