'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PanelsPortalProvider,
} from '@holo-js/panels-react'
import '@holo-js/panels-react/style.css'

type Theme = 'dark' | 'light'
type Overlay = 'dropdown' | 'modal'

interface PanelFixtureProps {
  readonly overlay: Overlay
  readonly theme: Theme
}

function PanelFixture({ overlay, theme }: PanelFixtureProps): ReactNode {
  const [modalOpen, setModalOpen] = useState(false)
  const portalContainer = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const container = globalThis.document.createElement('div')
    container.className = 'hp-panel-portal-host'
    container.dataset.e2ePortalHost = theme
    container.dataset.holoPanel = ''
    container.dataset.panel = `e2e-${theme}`
    container.dataset.theme = theme
    globalThis.document.body.append(container)
    portalContainer.current = container

    return () => {
      portalContainer.current = null
      container.remove()
    }
  }, [theme])

  return (
    <section
      className="hp-panel hp-section"
      data-e2e-panel={theme}
      data-holo-panel=""
      data-panel={`e2e-${theme}`}
      data-theme={theme}
    >
      <h2>{theme === 'light' ? 'Light panel' : 'Dark panel'}</h2>
      <PanelsPortalProvider container={portalContainer}>
        {overlay === 'dropdown' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Open light panel menu" variant="outline">Open light panel menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Light panel action</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button
              onClick={() => setModalOpen(true)}
              type="button"
            >
              Open dark panel modal
            </Button>
            <Dialog onOpenChange={setModalOpen} open={modalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dark panel modal</DialogTitle>
                  <DialogDescription>This dialog belongs to the dark panel.</DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </>
        )}
      </PanelsPortalProvider>
    </section>
  )
}

export default function PanelPortalThemePage(): ReactNode {
  return (
    <main className="hp-main" data-e2e-panel-portal-theme="">
      <h1>Panel portal theme isolation</h1>
      <PanelFixture overlay="dropdown" theme="light" />
      <PanelFixture overlay="modal" theme="dark" />
    </main>
  )
}
