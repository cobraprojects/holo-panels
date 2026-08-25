'use client'

import { createContext, useContext, type ReactNode, type RefObject } from 'react'

const PanelsPortalContext = createContext<RefObject<HTMLElement | null> | null>(null)

export function PanelsPortalProvider(props: {
  readonly children: ReactNode
  readonly container: RefObject<HTMLElement | null>
}): ReactNode {
  return <PanelsPortalContext.Provider value={props.container}>{props.children}</PanelsPortalContext.Provider>
}

export function usePanelsPortalContainer(): HTMLElement | null | undefined {
  return useContext(PanelsPortalContext)?.current
}
