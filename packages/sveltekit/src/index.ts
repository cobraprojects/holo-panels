import type { Component } from 'svelte'
import { SvelteComponentRegistry } from '@holo-js/panels-svelte'
import RawPanelPage from './PanelPage.svelte'
import type { PanelPageProps } from './contracts'

export const PanelPage: Component<PanelPageProps> = RawPanelPage

export function createSvelteKitPanelComponentRegistry(): SvelteComponentRegistry {
  return new SvelteComponentRegistry()
}

export * from './contracts'
