import {
  Component,
  Children,
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useId,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ErrorInfo,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { Dialog, DropdownMenu, Tabs } from 'radix-ui'
import { ChevronDown, X } from 'lucide-react'
import { ShadcnIcon } from './internal-ui'

type Tone = 'danger' | 'info' | 'neutral' | 'success' | 'warning'

function classes(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

const PanelsPortalContext = createContext<HTMLElement | null>(null)

export interface PanelsPortalProviderProps {
  readonly children?: ReactNode
  readonly container: HTMLElement | null
}

export function PanelsPortalProvider({ children, container }: PanelsPortalProviderProps): ReactNode {
  return <PanelsPortalContext.Provider value={container}>{children}</PanelsPortalContext.Provider>
}

export interface PanelsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tone?: Tone
}

export function PanelsButton({ className, tone = 'neutral', type = 'button', ...props }: PanelsButtonProps): ReactNode {
  return <button {...props} type={type} className={classes('hp-button', `hp-tone-${tone}`, className)} data-panels-component="button" data-slot="button" data-variant={tone === 'danger' ? 'destructive' : tone === 'neutral' ? 'outline' : tone} />
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
    data-slot="button"
    data-variant="link"
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
  return <span {...props} className={classes('hp-badge', `hp-tone-${tone}`, className)} data-panels-component="badge" data-slot="badge" data-variant={tone === 'danger' ? 'destructive' : tone === 'neutral' ? 'secondary' : tone} />
}

export interface PanelsAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  readonly alt: string
  readonly fallback?: string
  readonly src?: string
}

export function PanelsAvatar({ alt, className, fallback, src, ...props }: PanelsAvatarProps): ReactNode {
  return <span {...props} className={classes('hp-avatar', className)} data-panels-component="avatar" data-slot="avatar">
    {src ? <img alt={alt} data-slot="avatar-image" src={src} /> : <span aria-label={alt} data-slot="avatar-fallback">{fallback ?? alt.slice(0, 1).toUpperCase()}</span>}
  </span>
}

export interface PanelsIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string
}

export function PanelsIconButton({ className, label, type = 'button', ...props }: PanelsIconButtonProps): ReactNode {
  return <button {...props} aria-label={label} className={classes('hp-icon-button', className)} data-panels-component="icon-button" data-size="icon" data-slot="button" data-variant="ghost" type={type} />
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
  return <div {...props} className={classes('hp-input-wrapper', className)} data-panels-component="input-wrapper" data-slot="field">
    <label data-slot="label" htmlFor={inputId}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
    {description ? <div data-slot="field-description" id={descriptionId}>{description}</div> : null}
    {input}
    {errors.length > 0 ? <ul data-slot="field-error" id={errorsId} role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul> : null}
  </div>
}

export interface PanelsLoadingIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  readonly label?: string
}

export function PanelsLoadingIndicator({ className, label = 'Loading', ...props }: PanelsLoadingIndicatorProps): ReactNode {
  return <span {...props} aria-label={label} className={classes('hp-loading', className)} data-panels-component="loading-indicator" data-slot="spinner" role="status" />
}

export interface PanelsDropdownItem {
  readonly disabled?: boolean
  readonly icon?: string | null
  readonly id: string
  readonly label: ReactNode
  readonly onSelect: () => void
  readonly textValue?: string
}

export interface PanelsDropdownProps {
  readonly ariaLabel?: string
  readonly items: readonly PanelsDropdownItem[]
  readonly label: ReactNode
  readonly searchable?: boolean
}

export function PanelsDropdown({ ariaLabel, items, label, searchable = false }: PanelsDropdownProps): ReactNode {
  const portalContainer = useContext(PanelsPortalContext)
  const [search, setSearch] = useState('')
  const visibleItems = search
    ? items.filter(item => (item.textValue ?? (typeof item.label === 'string' ? item.label : '')).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    : items
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild><button aria-label={ariaLabel} className="hp-dropdown-trigger" data-panels-component="dropdown" data-slot="dropdown-menu-trigger" type="button">{label}<ChevronDown aria-hidden="true" /></button></DropdownMenu.Trigger>
    <DropdownMenu.Portal container={portalContainer ?? undefined}>
      <DropdownMenu.Content className="hp-dropdown" data-holo-panel="" data-panels-component="dropdown" data-slot="dropdown-menu-content" sideOffset={6}>
        {searchable ? <input aria-label="Search tenants" data-slot="input" onChange={event => setSearch(event.currentTarget.value)} placeholder="Search tenants…" value={search} /> : null}
        {visibleItems.map(item => <DropdownMenu.Item
          className="hp-dropdown-item"
          data-slot="dropdown-menu-item"
          disabled={item.disabled}
          key={item.id}
          onSelect={item.onSelect}
          textValue={item.textValue}
        >{item.icon ? <ShadcnIcon name={item.icon} /> : null}{item.label}</DropdownMenu.Item>)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
}

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  readonly labelledBy: string
  readonly onClose: () => void
  readonly open: boolean
}

function DialogSurface({ children, className, labelledBy, onClose, open, ...props }: DialogProps): ReactNode {
  const portalContainer = useContext(PanelsPortalContext)
  return <Dialog.Root onOpenChange={value => { if (!value) onClose() }} open={open}>
    <Dialog.Portal container={portalContainer ?? undefined}>
      <Dialog.Overlay className="hp-dialog-overlay" data-holo-panel="" data-slot="dialog-overlay" />
      <Dialog.Content {...props} aria-labelledby={labelledBy} aria-modal="true" className={className} data-holo-panel="" data-slot="dialog-content">
        <Dialog.Title className="hp-visually-hidden">Dialog</Dialog.Title>
        {children}
        <Dialog.Close aria-label="Close" className="hp-dialog-close" data-slot="dialog-close"><X aria-hidden="true" /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

export function PanelsModal(props: DialogProps): ReactNode {
  return <DialogSurface {...props} className={classes('hp-modal', props.className)} data-panels-component="modal" />
}

export function PanelsSlideOver(props: DialogProps): ReactNode {
  return <DialogSurface {...props} className={classes('hp-slide-over', props.className)} data-panels-component="slide-over" />
}

export interface PanelsTabsProps {
  readonly children?: ReactNode
  readonly defaultValue: string
  readonly label: string
}

export function PanelsTabs({ children, defaultValue, label }: PanelsTabsProps): ReactNode {
  const items = Children.toArray(children)
  const panels = items.filter(item => isValidElement(item) && item.type === PanelsTabPanel)
  const triggers = items.filter(item => !isValidElement(item) || item.type !== PanelsTabPanel)
  return <Tabs.Root className="hp-tabs" data-slot="tabs" defaultValue={defaultValue}>
    <Tabs.List aria-label={label} data-panels-component="tabs" data-slot="tabs-list">{triggers}</Tabs.List>
    {panels}
  </Tabs.Root>
}

export interface PanelsTabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly value: string
}

export function PanelsTab({ children, value, ...props }: PanelsTabProps): ReactNode {
  return <Tabs.Trigger {...props} data-slot="tabs-trigger" value={value}>{children}</Tabs.Trigger>
}

export interface PanelsTabPanelProps extends HTMLAttributes<HTMLDivElement> {
  readonly value: string
}

export function PanelsTabPanel({ children, value, ...props }: PanelsTabPanelProps): ReactNode {
  return <Tabs.Content {...props} data-slot="tabs-content" value={value}>{children}</Tabs.Content>
}

export interface PanelsSectionProps extends HTMLAttributes<HTMLElement> {
  readonly heading: ReactNode
}

export function PanelsSection({ children, className, heading, ...props }: PanelsSectionProps): ReactNode {
  const headingId = useId()
  return <section {...props} aria-labelledby={headingId} className={classes('hp-section', className)} data-panels-component="section" data-slot="card"><h2 data-slot="card-title" id={headingId}>{heading}</h2><div data-slot="card-content">{children}</div></section>
}

export interface PanelsEmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  readonly title: ReactNode
}

export function PanelsEmptyState({ children, className, title, ...props }: PanelsEmptyStateProps): ReactNode {
  return <div {...props} className={classes('hp-empty-state', className)} data-panels-component="empty-state" data-slot="empty"><h2 data-slot="empty-title">{title}</h2><div data-slot="empty-description">{children}</div></div>
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
  return <nav {...props} aria-label={label} className="hp-pagination" data-panels-component="pagination" data-slot="pagination">
    <button aria-label="Previous page" data-slot="pagination-link" data-variant="outline" disabled={current <= 1} onClick={() => onPageChange(current - 1)} type="button">Previous</button>
    <span aria-live="polite" data-slot="pagination-status">Page {current} of {validPages}</span>
    <button aria-label="Next page" data-slot="pagination-link" data-variant="outline" disabled={current >= validPages} onClick={() => onPageChange(current + 1)} type="button">Next</button>
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
  return <div {...props} aria-label="Notifications" className={classes('hp-toast-viewport', className)} data-panels-component="toast-viewport" data-slot="toast-viewport" role="region">
    {toasts.map(toast => <div aria-atomic="true" className={`hp-tone-${toast.tone ?? 'neutral'}`} data-slot="toast" data-variant={toast.tone ?? 'neutral'} key={toast.id} role={toast.tone === 'danger' ? 'alert' : 'status'}>{toast.message}</div>)}
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
