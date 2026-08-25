'use client'

import { loadPanelAuthPresentation, type PanelAuthPresentation } from '@holo-js/panels-react'
import { useEffect, useState } from 'react'

export function useNextPanelAuthPresentation(panelId: string): PanelAuthPresentation | null {
  const [presentation, setPresentation] = useState<PanelAuthPresentation | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadPanelAuthPresentation(panelId, (input, init) => fetch(input, { ...init, signal: controller.signal }))
      .then(setPresentation)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) throw error
      })
    return () => controller.abort()
  }, [panelId])

  return presentation
}
