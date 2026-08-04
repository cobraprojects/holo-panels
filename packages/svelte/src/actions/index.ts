import type { Component } from 'svelte'
import RawActionRenderer from './ActionRenderer.svelte'
import type { SvelteActionRendererProps } from './contracts'

export const SvelteActionRenderer: Component<SvelteActionRendererProps> = RawActionRenderer
export type { SvelteActionCustomProps, SvelteActionRendererProps, SvelteActionSlotProps } from './contracts'
