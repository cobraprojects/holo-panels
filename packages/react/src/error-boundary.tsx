import { Component, createElement, type ErrorInfo, type ReactNode } from 'react'

export interface PanelsErrorBoundaryProps {
  readonly children?: ReactNode
  readonly fallback: ReactNode | ((error: Error) => ReactNode)
  readonly onError?: (error: Error, info: ErrorInfo) => void
}

interface PanelsErrorBoundaryState {
  readonly error?: Error
}

export class PanelsErrorBoundary extends Component<PanelsErrorBoundaryProps, PanelsErrorBoundaryState> {
  override state: PanelsErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): PanelsErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return createElement('div', { 'data-panels-component': 'error-boundary', role: 'alert' },
      typeof this.props.fallback === 'function' ? this.props.fallback(error) : this.props.fallback)
  }
}
