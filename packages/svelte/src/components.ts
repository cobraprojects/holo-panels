import type { Component, Snippet } from 'svelte'
import RawErrorBoundary from './components/ErrorBoundary.svelte'
import RawPageActions from './components/PageActions.svelte'
import RawRenderHook from './components/RenderHook.svelte'

export interface PanelsErrorBoundaryProps {
  readonly children?: Snippet
  readonly error?: string
  readonly fallback?: string
  readonly onerror?: (error: unknown) => void
}

export interface PanelsPageActionsProps {
  readonly children?: Snippet
  readonly to?: HTMLElement
}

export const PanelsErrorBoundary: Component<PanelsErrorBoundaryProps> = RawErrorBoundary
export const PanelsPageActions: Component<PanelsPageActionsProps> = RawPageActions
export const PanelsRenderHookRenderer = RawRenderHook
