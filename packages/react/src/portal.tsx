'use client'

import { createContext, useContext, useEffect, useState, type ReactNode, type RefObject } from 'react'

const PanelsPortalContext = createContext<HTMLElement | null | undefined>(undefined)

export function PanelsPortalProvider(props: {
  readonly children: ReactNode
  readonly container: RefObject<HTMLElement | null>
}): ReactNode {
  const [container, setContainer] = useState<HTMLElement | null>(() => props.container.current)

  useEffect(() => {
    setContainer(props.container.current)
    if (props.container.current) return
    const frame = requestAnimationFrame(() => setContainer(props.container.current))
    return () => cancelAnimationFrame(frame)
  }, [props.container])

  return <PanelsPortalContext.Provider value={container}>{props.children}</PanelsPortalContext.Provider>
}

export function usePanelsPortalContainer(): HTMLElement | null | undefined {
  return useContext(PanelsPortalContext)
}
