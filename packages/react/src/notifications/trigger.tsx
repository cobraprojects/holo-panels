import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ShadcnButton, ShadcnIcon } from '../internal-ui'
import { ReactNotificationInbox } from './renderer'
import type { ReactNotificationInboxTriggerProps } from './types'

export function ReactNotificationInboxTrigger({
  emptyMessage,
  label = 'Notifications',
  lazy = false,
  navigate,
  panelId,
  placement,
  registry,
  store,
}: ReactNotificationInboxTriggerProps): ReactNode {
  const [open, setOpen] = useState(false)
  const [activated, setActivated] = useState(!lazy)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const reactId = useId()
  const inboxId = `hp-notification-inbox-${reactId.replaceAll(':', '')}`
  const state = useSyncExternalStore(
    listener => store.subscribe(listener),
    () => store.state,
    () => store.state,
  )

  useEffect(() => {
    if (!open) return
    const closeAndRestoreFocus = (): void => {
      setOpen(false)
      trigger.current?.focus()
    }
    const onDocumentClick = (event: MouseEvent): void => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) closeAndRestoreFocus()
    }
    const onDocumentKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeAndRestoreFocus()
    }
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onDocumentKeyDown)
    return () => {
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [open])

  const resolvedLabel = label.trim() || 'Notifications'
  const accessibleLabel = state.unread > 0 ? `${resolvedLabel}, ${state.unread} unread` : resolvedLabel
  const inboxPlacement = placement === 'topbar' ? 'dropdown' : 'sidebar'
  return <div className="hp-notification-inbox-trigger" data-placement={placement} ref={container}>
    <ShadcnButton
      aria-controls={inboxId}
      aria-expanded={open}
      aria-label={accessibleLabel}
      className="hp-notification-inbox-trigger-button"
      onClick={() => {
        setActivated(true)
        setOpen(current => !current)
      }}
      ref={trigger}
      title={resolvedLabel}
      type="button"
    >
      <ShadcnIcon name="bell" />
      {state.unread > 0 ? <span aria-hidden="true" className="hp-notification-inbox-trigger-badge">{state.unread}</span> : null}
    </ShadcnButton>
    <div className="hp-notification-inbox-trigger-content" hidden={!open} id={inboxId}>
      {activated ? <ReactNotificationInbox
        emptyMessage={emptyMessage}
        navigate={navigate}
        panelId={panelId}
        placement={inboxPlacement}
        registry={registry}
        store={store}
      /> : null}
    </div>
  </div>
}
