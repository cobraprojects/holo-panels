import { publishPanelError, registerPanelNotificationStore, type ClientToastStore } from '@holo-js/panels-client'
import { createContext, createElement, useContext, useEffect, useMemo, type ReactNode } from 'react'

export interface ReactFeedback {
  error(title: string, cause: unknown): void
}

const ReactFeedbackContext = createContext<ReactFeedback | null>(null)
const fallbackFeedback: ReactFeedback = {
  error() {},
}

export function ReactFeedbackProvider({ children, panelId, store }: { readonly children: ReactNode, readonly panelId: string, readonly store: ClientToastStore }): ReactNode {
  useEffect(() => registerPanelNotificationStore(panelId, store), [panelId, store])
  const feedback = useMemo<ReactFeedback>(() => ({
    error(title) {
      publishPanelError(panelId, title)
    },
  }), [panelId])
  return createElement(ReactFeedbackContext.Provider, { value: feedback }, children)
}

export function useReactFeedback(): ReactFeedback {
  return useContext(ReactFeedbackContext) ?? fallbackFeedback
}
