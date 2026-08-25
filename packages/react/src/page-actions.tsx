import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const PageActionsContext = createContext<HTMLElement | null | undefined>(undefined)

export interface PanelsPageActionsProviderProps {
  readonly children?: ReactNode
  readonly container: HTMLElement | null
}

export function PanelsPageActionsProvider({ children, container }: PanelsPageActionsProviderProps): ReactNode {
  return <PageActionsContext.Provider value={container}>{children}</PageActionsContext.Provider>
}

export function PanelsPageActions({ children }: { readonly children?: ReactNode }): ReactNode {
  const container = useContext(PageActionsContext)
  const actions = <div className="hp-page-actions hp:flex hp:flex-wrap hp:items-center hp:justify-end hp:gap-2" data-slot="page-actions">{children}</div>
  if (container === undefined) return actions
  return container ? createPortal(actions, container) : null
}
