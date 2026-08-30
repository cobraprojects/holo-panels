import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { PanelsIcon } from '../internal-ui'
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from '../ui'
import { ReactNotificationInbox } from './renderer'
import type { ReactNotificationInboxTriggerProps } from './types'

export function ReactNotificationInboxTrigger({
  emptyMessage,
  label = 'Notifications',
  lazy = false,
  locale,
  navigate,
  panelId,
  placement,
  registry,
  store,
}: ReactNotificationInboxTriggerProps): ReactNode {
  const [open, setOpen] = useState(false)
  const [activated, setActivated] = useState(!lazy)
  const trigger = useRef<HTMLButtonElement>(null)
  const reactId = useId()
  const inboxId = `hp-notification-inbox-${reactId.replaceAll(':', '')}`
  const state = useSyncExternalStore(
    listener => store.subscribe(listener),
    () => store.state,
    () => store.state,
  )
  const resolvedLabel = label.trim() || 'Notifications'
  const accessibleLabel = state.unread > 0 ? `${resolvedLabel}, ${state.unread} unread` : resolvedLabel
  const inboxPlacement = placement === 'topbar' ? 'dropdown' : 'sidebar'

  return <Popover onOpenChange={nextOpen => {
    setOpen(nextOpen)
    if (nextOpen) setActivated(true)
  }} open={open}>
    <PopoverTrigger asChild>
      <Button aria-controls={inboxId} aria-label={accessibleLabel} className="hp-notification-inbox-trigger-button hp:relative" ref={trigger} size="icon" title={resolvedLabel} type="button" variant="ghost">
        <PanelsIcon name="bell" />
        {state.unread > 0 ? <Badge aria-hidden="true" className="hp-notification-inbox-trigger-badge hp:absolute hp:-right-1 hp:-top-1 hp:min-w-5 hp:px-1 hp:text-[10px]" variant="destructive">{state.unread}</Badge> : null}
      </Button>
    </PopoverTrigger>
    <PopoverContent align={placement === 'topbar' ? 'end' : 'start'} className="hp-notification-inbox-trigger-content hp:w-[min(28rem,calc(100vw-2rem))] hp:p-0 hp:data-[state=closed]:hidden" data-holo-panel forceMount id={inboxId} onEscapeKeyDown={() => { globalThis.queueMicrotask(() => trigger.current?.focus()) }}>
      {activated ? <ReactNotificationInbox emptyMessage={emptyMessage} locale={locale} navigate={navigate} panelId={panelId} placement={inboxPlacement} registry={registry} store={store} /> : null}
    </PopoverContent>
  </Popover>
}
