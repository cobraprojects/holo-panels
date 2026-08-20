'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  PanelsDropdown,
  PanelsModal,
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
  const [portalContainer, setPortalContainer] =
    useState<HTMLElement | null>(null)

  useEffect(() => {
    const container = globalThis.document.createElement('div')
    container.className = 'hp-panel-portal-host'
    container.dataset.e2ePortalHost = theme
    container.dataset.holoPanel = ''
    container.dataset.panel = `e2e-${theme}`
    container.dataset.theme = theme
    globalThis.document.body.append(container)
    setPortalContainer(container)

    return () => container.remove()
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
          <PanelsDropdown
            ariaLabel="Open light panel menu"
            items={[
              {
                id: 'light-action',
                label: 'Light panel action',
                onSelect: () => undefined,
              },
            ]}
            label="Open light panel menu"
          />
        ) : (
          <>
            <button
              className="hp-button"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              Open dark panel modal
            </button>
            <PanelsModal
              labelledBy="dark-panel-modal-title"
              onClose={() => setModalOpen(false)}
              open={modalOpen}
            >
              <h2 id="dark-panel-modal-title">Dark panel modal</h2>
              <p>This dialog belongs to the dark panel.</p>
            </PanelsModal>
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
