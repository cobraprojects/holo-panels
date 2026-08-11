import type { Component } from 'svelte'
import { SvelteComponentRegistry } from '@holo-js/panels-svelte'
import RawPanelPage from './PanelPage.svelte'
import RawLoginPage from './LoginPage.svelte'
import RawAuthPage from './AuthPage.svelte'
import RawMultiFactorPage from './MultiFactorPage.svelte'
import RawProfilePage from './ProfilePage.svelte'
import type { PanelPageProps } from './contracts'

export const PanelPage: Component<PanelPageProps> = RawPanelPage
export const PanelLoginPage: Component<{ brandName: string, forgotPasswordPath?: string, panelId: string, registrationPath?: string, simplePageMaxContentWidth?: string, theme?: 'dark' | 'light' | 'system', themeColors?: Readonly<Record<string, string>> }> = RawLoginPage
export const PanelAuthPage: Component<{ brandName: string, loginPath?: string, panelId: string, simplePageMaxContentWidth?: string, theme?: 'dark' | 'light' | 'system', themeColors?: Readonly<Record<string, string>>, type: 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration' }> = RawAuthPage
export const PanelMultiFactorPage: Component<{ brandName: string, panelId: string, simplePageMaxContentWidth?: string, theme?: 'dark' | 'light' | 'system', themeColors?: Readonly<Record<string, string>> }> = RawMultiFactorPage
export const PanelProfilePage: Component<{ brandName: string, panelId: string, simplePageMaxContentWidth?: string, theme?: 'dark' | 'light' | 'system', themeColors?: Readonly<Record<string, string>> }> = RawProfilePage

export function createSvelteKitPanelComponentRegistry(): SvelteComponentRegistry {
  return new SvelteComponentRegistry()
}

export * from './contracts'
