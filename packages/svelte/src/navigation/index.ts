import type { Component } from 'svelte'
import RawNavigationSearchRenderer from './NavigationSearchRenderer.svelte'
import RawTenantSwitcher from './TenantSwitcher.svelte'
import type { SvelteNavigationSearchRendererProps, SvelteTenantSwitcherProps } from './contracts'

export interface SvelteNavigationSearchRendererComponentProps {
  readonly shell: SvelteNavigationSearchRendererProps
}

export const SvelteNavigationSearchRenderer: Component<SvelteNavigationSearchRendererComponentProps> = RawNavigationSearchRenderer

export interface SvelteTenantSwitcherComponentProps {
  readonly shell: SvelteTenantSwitcherProps
}

export const SvelteTenantSwitcher: Component<SvelteTenantSwitcherComponentProps> = RawTenantSwitcher
export type { SvelteNavigationSearchRendererProps, SvelteTenantSwitcherProps } from './contracts'
