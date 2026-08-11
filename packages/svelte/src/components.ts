import type { Component, Snippet } from 'svelte'
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'
import RawAvatar from './components/Avatar.svelte'
import RawBadge from './components/Badge.svelte'
import RawButton from './components/Button.svelte'
import RawDialog from './components/Dialog.svelte'
import RawSlideOver from './components/SlideOver.svelte'
import RawDropdown from './components/Dropdown.svelte'
import RawEmptyState from './components/EmptyState.svelte'
import RawErrorBoundary from './components/ErrorBoundary.svelte'
import RawIconButton from './components/IconButton.svelte'
import RawInputWrapper from './components/InputWrapper.svelte'
import RawLink from './components/Link.svelte'
import RawLoadingIndicator from './components/LoadingIndicator.svelte'
import RawPagination from './components/Pagination.svelte'
import RawSection from './components/Section.svelte'
import RawTabs from './components/Tabs.svelte'
import RawToastViewport from './components/ToastViewport.svelte'

export interface PanelsButtonProps extends HTMLButtonAttributes { readonly children?: Snippet; readonly ref?: HTMLButtonElement }
export interface PanelsLinkProps extends HTMLAnchorAttributes { readonly children?: Snippet; readonly current?: boolean; readonly disabled?: boolean; readonly href: string }
export interface PanelsBadgeProps { readonly children?: Snippet; readonly tone?: 'danger' | 'info' | 'neutral' | 'success' | 'warning' }
export interface PanelsAvatarProps { readonly alt: string; readonly fallback?: string; readonly src?: string }
export interface PanelsIconButtonProps { readonly children?: Snippet; readonly disabled?: boolean; readonly label: string }
export interface PanelsInputControlAttributes { readonly 'aria-describedby'?: string; readonly 'aria-invalid'?: true; readonly id: string }
export interface PanelsInputWrapperProps { readonly children?: Snippet<[PanelsInputControlAttributes]>; readonly description?: string; readonly error?: string; readonly inputId: string; readonly label: string; readonly required?: boolean }
export interface PanelsLoadingIndicatorProps { readonly label?: string }
export interface PanelsDropdownItem { readonly disabled?: boolean; readonly icon?: string | null; readonly id: string; readonly label: string }
export interface PanelsDropdownProps { readonly items: readonly PanelsDropdownItem[]; readonly label: string; readonly onselect?: (id: string) => void }
export interface PanelsDialogProps { readonly children?: Snippet; readonly labelledBy: string; readonly onclose: () => void; readonly open: boolean }
export interface PanelsTab { readonly disabled?: boolean; readonly id: string; readonly label: string }
export interface PanelsTabsProps { readonly label: string; readonly onselect?: (id: string) => void; readonly tabs: readonly PanelsTab[]; readonly value: string }
export interface PanelsSectionProps { readonly children?: Snippet; readonly heading: string }
export interface PanelsEmptyStateProps { readonly children?: Snippet; readonly description?: string; readonly heading: string }
export interface PanelsPaginationProps { readonly label?: string; readonly onpagechange?: (page: number) => void; readonly page: number; readonly pages: number }
export interface PanelsToast { readonly id: string; readonly message: string; readonly tone?: 'danger' | 'info' | 'success' | 'warning' }
export interface PanelsToastViewportProps { readonly toasts?: readonly PanelsToast[] }
export interface PanelsErrorBoundaryProps { readonly children?: Snippet; readonly error?: string; readonly fallback?: string; readonly onerror?: (error: unknown) => void }

export const PanelsButton: Component<PanelsButtonProps, Record<string, unknown>, 'ref'> = RawButton
export const PanelsLink: Component<PanelsLinkProps> = RawLink
export const PanelsBadge: Component<PanelsBadgeProps> = RawBadge
export const PanelsAvatar: Component<PanelsAvatarProps> = RawAvatar
export const PanelsIconButton: Component<PanelsIconButtonProps> = RawIconButton
export const PanelsInputWrapper: Component<PanelsInputWrapperProps> = RawInputWrapper
export const PanelsLoadingIndicator: Component<PanelsLoadingIndicatorProps> = RawLoadingIndicator
export const PanelsDropdown: Component<PanelsDropdownProps> = RawDropdown
export const PanelsModal: Component<PanelsDialogProps> = RawDialog
export const PanelsSlideOver: Component<PanelsDialogProps> = RawSlideOver
export const PanelsTabs: Component<PanelsTabsProps> = RawTabs
export const PanelsSection: Component<PanelsSectionProps> = RawSection
export const PanelsEmptyState: Component<PanelsEmptyStateProps> = RawEmptyState
export const PanelsPagination: Component<PanelsPaginationProps> = RawPagination
export const PanelsToastViewport: Component<PanelsToastViewportProps> = RawToastViewport
export const PanelsErrorBoundary: Component<PanelsErrorBoundaryProps> = RawErrorBoundary
