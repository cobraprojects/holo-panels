import {
  Component,
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ErrorInfo,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

type Tone = 'danger' | 'info' | 'neutral' | 'success' | 'warning'

function classes(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

export interface PanelsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tone?: Tone
}

export function PanelsButton({ className, tone = 'neutral', type = 'button', ...props }: PanelsButtonProps): ReactNode {
  return <button {...props} type={type} className={classes('hp-button', `hp-tone-${tone}`, className)} data-panels-component="button" />
}

export interface PanelsLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly disabled?: boolean
}

export function PanelsLink({ className, disabled = false, onClick, ...props }: PanelsLinkProps): ReactNode {
  return <a
    {...props}
    aria-disabled={disabled || undefined}
    className={classes('hp-link', className)}
    data-panels-component="link"
    onClick={event => {
      if (disabled) event.preventDefault()
      else onClick?.(event)
    }}
    tabIndex={disabled ? -1 : props.tabIndex}
  />
}

export interface PanelsBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone
}

export function PanelsBadge({ className, tone = 'neutral', ...props }: PanelsBadgeProps): ReactNode {
  return <span {...props} className={classes('hp-badge', `hp-tone-${tone}`, className)} data-panels-component="badge" />
}

export interface PanelsAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  readonly alt: string
  readonly fallback?: string
  readonly src?: string
}

export function PanelsAvatar({ alt, className, fallback, src, ...props }: PanelsAvatarProps): ReactNode {
  return <span {...props} className={classes('hp-avatar', className)} data-panels-component="avatar">
    {src ? <img alt={alt} src={src} /> : <span aria-label={alt}>{fallback ?? alt.slice(0, 1).toUpperCase()}</span>}
  </span>
}

export interface PanelsIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string
}

export function PanelsIconButton({ className, label, type = 'button', ...props }: PanelsIconButtonProps): ReactNode {
  return <button {...props} aria-label={label} className={classes('hp-icon-button', className)} data-panels-component="icon-button" type={type} />
}

export interface PanelsInputWrapperProps extends HTMLAttributes<HTMLDivElement> {
  readonly description?: ReactNode
  readonly errors?: readonly string[]
  readonly inputId: string
  readonly label: ReactNode
  readonly required?: boolean
}

export function PanelsInputWrapper({ children, className, description, errors = [], inputId, label, required, ...props }: PanelsInputWrapperProps): ReactNode {
  const descriptionId = `${inputId}-description`
  const errorsId = `${inputId}-errors`
  const describedBy = [description ? descriptionId : undefined, errors.length > 0 ? errorsId : undefined].filter(Boolean).join(' ') || undefined
  const input = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, { 'aria-describedby': describedBy, 'aria-invalid': errors.length > 0 || undefined, id: inputId })
    : children
  return <div {...props} className={classes('hp-input-wrapper', className)} data-panels-component="input-wrapper">
    <label htmlFor={inputId}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
    {description ? <div id={descriptionId}>{description}</div> : null}
    {input}
    {errors.length > 0 ? <ul id={errorsId} role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul> : null}
  </div>
}

export interface PanelsLoadingIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  readonly label?: string
}

export function PanelsLoadingIndicator({ className, label = 'Loading', ...props }: PanelsLoadingIndicatorProps): ReactNode {
  return <span {...props} aria-label={label} className={classes('hp-loading', className)} data-panels-component="loading-indicator" role="status" />
}

export interface PanelsDropdownItem {
  readonly disabled?: boolean
  readonly id: string
  readonly label: ReactNode
  readonly onSelect: () => void
}

export interface PanelsDropdownProps {
  readonly items: readonly PanelsDropdownItem[]
  readonly label: ReactNode
}

export function PanelsDropdown({ items, label }: PanelsDropdownProps): ReactNode {
  const [open, setOpen] = useState(false)
  const enabled = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled)
  const [activeIndex, setActiveIndex] = useState(enabled[0]?.index ?? 0)
  const move = (direction: 1 | -1): void => {
    if (enabled.length === 0) return
    const current = enabled.findIndex(entry => entry.index === activeIndex)
    const next = enabled[(current + direction + enabled.length) % enabled.length]
    if (next) setActiveIndex(next.index)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      const item = items[activeIndex]
      if (item && !item.disabled) {
        event.preventDefault()
        item.onSelect()
        setOpen(false)
      }
    }
  }
  return <div className="hp-dropdown" data-panels-component="dropdown" onKeyDown={onKeyDown}>
    <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)} type="button">{label}</button>
    {open ? <div role="menu">{items.map((item, index) => <button
      aria-disabled={item.disabled || undefined}
      className={index === activeIndex ? 'hp-active' : undefined}
      key={item.id}
      onClick={() => {
        if (!item.disabled) item.onSelect()
        setOpen(false)
      }}
      role="menuitem"
      tabIndex={index === activeIndex ? 0 : -1}
      type="button"
    >{item.label}</button>)}</div> : null}
  </div>
}

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  readonly labelledBy: string
  readonly onClose: () => void
  readonly open: boolean
}

function DialogSurface({ children, className, labelledBy, onClose, open, ...props }: DialogProps): ReactNode {
  const surfaceRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    surfaceRef.current?.querySelector<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()
  }, [open])
  if (!open) return null
  return <div
    {...props}
    aria-labelledby={labelledBy}
    aria-modal="true"
    className={className}
    onKeyDown={event => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = surfaceRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }}
    ref={surfaceRef}
    role="dialog"
  >{children}</div>
}

export function PanelsModal(props: DialogProps): ReactNode {
  return <DialogSurface {...props} className={classes('hp-modal', props.className)} data-panels-component="modal" />
}

export function PanelsSlideOver(props: DialogProps): ReactNode {
  return <DialogSurface {...props} className={classes('hp-slide-over', props.className)} data-panels-component="slide-over" />
}

interface TabsContextValue {
  readonly active: string
  readonly select: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export interface PanelsTabsProps {
  readonly children?: ReactNode
  readonly defaultValue: string
  readonly label: string
}

export function PanelsTabs({ children, defaultValue, label }: PanelsTabsProps): ReactNode {
  const [active, select] = useState(defaultValue)
  return <TabsContext value={{ active, select }}><div aria-label={label} className="hp-tabs" data-panels-component="tabs" role="tablist">{children}</div></TabsContext>
}

export interface PanelsTabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly value: string
}

export function PanelsTab({ children, value, ...props }: PanelsTabProps): ReactNode {
  const context = useContext(TabsContext)
  if (!context) throw new Error('[Holo Panels] PanelsTab must be rendered inside PanelsTabs.')
  return <button
    {...props}
    aria-selected={context.active === value}
    onClick={() => context.select(value)}
    onKeyDown={event => {
      props.onKeyDown?.(event)
      if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const tabs = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
      const current = tabs.indexOf(event.currentTarget)
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
      event.preventDefault()
      tabs[nextIndex]?.focus()
      tabs[nextIndex]?.click()
    }}
    role="tab"
    tabIndex={context.active === value ? 0 : -1}
    type="button"
  >{children}</button>
}

export interface PanelsTabPanelProps extends HTMLAttributes<HTMLDivElement> {
  readonly value: string
}

export function PanelsTabPanel({ children, value, ...props }: PanelsTabPanelProps): ReactNode {
  const context = useContext(TabsContext)
  if (!context) throw new Error('[Holo Panels] PanelsTabPanel must be rendered inside PanelsTabs.')
  return <div {...props} hidden={context.active !== value} role="tabpanel">{children}</div>
}

export interface PanelsSectionProps extends HTMLAttributes<HTMLElement> {
  readonly heading: ReactNode
}

export function PanelsSection({ children, className, heading, ...props }: PanelsSectionProps): ReactNode {
  const headingId = useId()
  return <section {...props} aria-labelledby={headingId} className={classes('hp-section', className)} data-panels-component="section"><h2 id={headingId}>{heading}</h2>{children}</section>
}

export interface PanelsEmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  readonly title: ReactNode
}

export function PanelsEmptyState({ children, className, title, ...props }: PanelsEmptyStateProps): ReactNode {
  return <div {...props} className={classes('hp-empty-state', className)} data-panels-component="empty-state"><h2>{title}</h2>{children}</div>
}

export interface PanelsPaginationProps extends HTMLAttributes<HTMLElement> {
  readonly label?: string
  readonly onPageChange: (page: number) => void
  readonly page: number
  readonly pages: number
}

export function PanelsPagination({ label = 'Pagination', onPageChange, page, pages, ...props }: PanelsPaginationProps): ReactNode {
  const validPages = Number.isSafeInteger(pages) && pages > 0 ? pages : 1
  const current = Math.min(Math.max(1, page), validPages)
  return <nav {...props} aria-label={label} className="hp-pagination" data-panels-component="pagination">
    <button aria-label="Previous page" disabled={current <= 1} onClick={() => onPageChange(current - 1)} type="button">Previous</button>
    <span aria-live="polite">Page {current} of {validPages}</span>
    <button aria-label="Next page" disabled={current >= validPages} onClick={() => onPageChange(current + 1)} type="button">Next</button>
  </nav>
}

export interface PanelsToast {
  readonly id: string
  readonly message: ReactNode
  readonly tone?: Tone
}

export interface PanelsToastViewportProps extends HTMLAttributes<HTMLDivElement> {
  readonly toasts: readonly PanelsToast[]
}

export function PanelsToastViewport({ className, toasts, ...props }: PanelsToastViewportProps): ReactNode {
  return <div {...props} aria-label="Notifications" className={classes('hp-toast-viewport', className)} data-panels-component="toast-viewport" role="region">
    {toasts.map(toast => <div aria-atomic="true" className={`hp-tone-${toast.tone ?? 'neutral'}`} key={toast.id} role={toast.tone === 'danger' ? 'alert' : 'status'}>{toast.message}</div>)}
  </div>
}

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
