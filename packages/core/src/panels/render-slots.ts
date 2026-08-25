import type { JsonObject, JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'

export interface RenderSlotReference {
  readonly component: string
  readonly order?: number
  readonly properties?: JsonObject
}

export const PanelsRenderHook = Object.freeze({
  AUTH_LOGIN_FORM_AFTER: 'panels::auth.login.form.after',
  AUTH_LOGIN_FORM_BEFORE: 'panels::auth.login.form.before',
  AUTH_PASSWORD_RESET_REQUEST_FORM_AFTER: 'panels::auth.password-reset.request.form.after',
  AUTH_PASSWORD_RESET_REQUEST_FORM_BEFORE: 'panels::auth.password-reset.request.form.before',
  AUTH_PASSWORD_RESET_RESET_FORM_AFTER: 'panels::auth.password-reset.reset.form.after',
  AUTH_PASSWORD_RESET_RESET_FORM_BEFORE: 'panels::auth.password-reset.reset.form.before',
  AUTH_REGISTER_FORM_AFTER: 'panels::auth.register.form.after',
  AUTH_REGISTER_FORM_BEFORE: 'panels::auth.register.form.before',
  BODY_END: 'panels::body.end',
  BODY_START: 'panels::body.start',
  CONTENT_AFTER: 'panels::content.after',
  CONTENT_BEFORE: 'panels::content.before',
  CONTENT_END: 'panels::content.end',
  CONTENT_START: 'panels::content.start',
  FOOTER: 'panels::footer',
  GLOBAL_SEARCH_AFTER: 'panels::global-search.after',
  GLOBAL_SEARCH_BEFORE: 'panels::global-search.before',
  GLOBAL_SEARCH_END: 'panels::global-search.end',
  GLOBAL_SEARCH_START: 'panels::global-search.start',
  HEAD_END: 'panels::head.end',
  HEAD_START: 'panels::head.start',
  LAYOUT_END: 'panels::layout.end',
  LAYOUT_START: 'panels::layout.start',
  PAGE_END: 'panels::page.end',
  PAGE_FOOTER_WIDGETS_AFTER: 'panels::page.footer-widgets.after',
  PAGE_FOOTER_WIDGETS_BEFORE: 'panels::page.footer-widgets.before',
  PAGE_FOOTER_WIDGETS_END: 'panels::page.footer-widgets.end',
  PAGE_FOOTER_WIDGETS_START: 'panels::page.footer-widgets.start',
  PAGE_HEADER_ACTIONS_AFTER: 'panels::page.header.actions.after',
  PAGE_HEADER_ACTIONS_BEFORE: 'panels::page.header.actions.before',
  PAGE_HEADER_HEADING_AFTER: 'panels::page.header.heading.after',
  PAGE_HEADER_HEADING_BEFORE: 'panels::page.header.heading.before',
  PAGE_HEADER_WIDGETS_AFTER: 'panels::page.header-widgets.after',
  PAGE_HEADER_WIDGETS_BEFORE: 'panels::page.header-widgets.before',
  PAGE_HEADER_WIDGETS_END: 'panels::page.header-widgets.end',
  PAGE_HEADER_WIDGETS_START: 'panels::page.header-widgets.start',
  PAGE_START: 'panels::page.start',
  PAGE_SUB_NAVIGATION_END_AFTER: 'panels::page.sub-navigation.end.after',
  PAGE_SUB_NAVIGATION_END_BEFORE: 'panels::page.sub-navigation.end.before',
  PAGE_SUB_NAVIGATION_MOBILE_MENU_AFTER: 'panels::page.sub-navigation.module-menu.after',
  PAGE_SUB_NAVIGATION_MOBILE_MENU_BEFORE: 'panels::page.sub-navigation.module-menu.before',
  PAGE_SUB_NAVIGATION_SIDEBAR_AFTER: 'panels::page.sub-navigation.sidebar.after',
  PAGE_SUB_NAVIGATION_SIDEBAR_BEFORE: 'panels::page.sub-navigation.sidebar.before',
  PAGE_SUB_NAVIGATION_START_AFTER: 'panels::page.sub-navigation.start.after',
  PAGE_SUB_NAVIGATION_START_BEFORE: 'panels::page.sub-navigation.start.before',
  PAGE_SUB_NAVIGATION_TOP_AFTER: 'panels::page.sub-navigation.top.after',
  PAGE_SUB_NAVIGATION_TOP_BEFORE: 'panels::page.sub-navigation.top.before',
  RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER: 'panels::resource.pages.list-records.table.after',
  RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE: 'panels::resource.pages.list-records.table.before',
  RESOURCE_PAGES_LIST_RECORDS_TABS_END: 'panels::resource.pages.list-records.tabs.end',
  RESOURCE_PAGES_LIST_RECORDS_TABS_START: 'panels::resource.pages.list-records.tabs.start',
  RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_AFTER: 'panels::resource.pages.manage-related-records.table.after',
  RESOURCE_PAGES_MANAGE_RELATED_RECORDS_TABLE_BEFORE: 'panels::resource.pages.manage-related-records.table.before',
  RESOURCE_RELATION_MANAGER_AFTER: 'panels::resource.relation-manager.after',
  RESOURCE_RELATION_MANAGER_BEFORE: 'panels::resource.relation-manager.before',
  RESOURCE_TABS_END: 'panels::resource.tabs.end',
  RESOURCE_TABS_START: 'panels::resource.tabs.start',
  SCRIPTS_AFTER: 'panels::scripts.after',
  SCRIPTS_BEFORE: 'panels::scripts.before',
  SIDEBAR_FOOTER: 'panels::sidebar.footer',
  SIDEBAR_LOGO_AFTER: 'panels::sidebar.logo.after',
  SIDEBAR_LOGO_BEFORE: 'panels::sidebar.logo.before',
  SIDEBAR_NAV_END: 'panels::sidebar.nav.end',
  SIDEBAR_NAV_START: 'panels::sidebar.nav.start',
  SIDEBAR_START: 'panels::sidebar.start',
  SIMPLE_LAYOUT_END: 'panels::simple-layout.end',
  SIMPLE_LAYOUT_START: 'panels::simple-layout.start',
  SIMPLE_PAGE_END: 'panels::simple-page.end',
  SIMPLE_PAGE_START: 'panels::simple-page.start',
  STYLES_AFTER: 'panels::styles.after',
  STYLES_BEFORE: 'panels::styles.before',
  TENANT_MENU_AFTER: 'panels::tenant-menu.after',
  TENANT_MENU_BEFORE: 'panels::tenant-menu.before',
  TOPBAR_AFTER: 'panels::topbar.after',
  TOPBAR_BEFORE: 'panels::topbar.before',
  TOPBAR_END: 'panels::topbar.end',
  TOPBAR_LOGO_AFTER: 'panels::topbar.logo.after',
  TOPBAR_LOGO_BEFORE: 'panels::topbar.logo.before',
  TOPBAR_START: 'panels::topbar.start',
  USER_MENU_AFTER: 'panels::user-menu.after',
  USER_MENU_BEFORE: 'panels::user-menu.before',
  USER_MENU_PROFILE_AFTER: 'panels::user-menu.profile.after',
  USER_MENU_PROFILE_BEFORE: 'panels::user-menu.profile.before',
} as const)

export type PanelsRenderHook = typeof PanelsRenderHook[keyof typeof PanelsRenderHook]

export const ActionsRenderHook = Object.freeze({
  MODAL_CUSTOM_CONTENT_AFTER: 'actions::modal.custom-content.after',
  MODAL_CUSTOM_CONTENT_BEFORE: 'actions::modal.custom-content.before',
  MODAL_CUSTOM_CONTENT_FOOTER_AFTER: 'actions::modal.custom-content-footer.after',
  MODAL_CUSTOM_CONTENT_FOOTER_BEFORE: 'actions::modal.custom-content-footer.before',
  MODAL_SCHEMA_AFTER: 'actions::modal.schema.after',
  MODAL_SCHEMA_BEFORE: 'actions::modal.schema.before',
} as const)

export type ActionsRenderHook = typeof ActionsRenderHook[keyof typeof ActionsRenderHook]

export const TablesRenderHook = Object.freeze({
  FILTER_INDICATORS: 'tables::filter.indicators',
  HEADER_AFTER: 'tables::header.after',
  HEADER_BEFORE: 'tables::header.before',
  HEADER_CELL: 'tables::header.cell',
  SELECTION_INDICATOR_ACTIONS_AFTER: 'tables::selection.indicator.actions.after',
  SELECTION_INDICATOR_ACTIONS_BEFORE: 'tables::selection.indicator.actions.before',
  TOOLBAR_AFTER: 'tables::toolbar.after',
  TOOLBAR_BEFORE: 'tables::toolbar.before',
  TOOLBAR_COLUMN_MANAGER_TRIGGER_AFTER: 'tables::toolbar.toggle-column-trigger.after',
  TOOLBAR_COLUMN_MANAGER_TRIGGER_BEFORE: 'tables::toolbar.toggle-column-trigger.before',
  TOOLBAR_END: 'tables::toolbar.end',
  TOOLBAR_GROUPING_SELECTOR_AFTER: 'tables::toolbar.grouping-selector.after',
  TOOLBAR_GROUPING_SELECTOR_BEFORE: 'tables::toolbar.grouping-selector.before',
  TOOLBAR_REORDER_TRIGGER_AFTER: 'tables::toolbar.reorder-trigger.after',
  TOOLBAR_REORDER_TRIGGER_BEFORE: 'tables::toolbar.reorder-trigger.before',
  TOOLBAR_SEARCH_AFTER: 'tables::toolbar.search.after',
  TOOLBAR_SEARCH_BEFORE: 'tables::toolbar.search.before',
  TOOLBAR_START: 'tables::toolbar.start',
} as const)

export type TablesRenderHook = typeof TablesRenderHook[keyof typeof TablesRenderHook]

export const WidgetsRenderHook = Object.freeze({
  TABLE_WIDGET_END: 'widgets::table-widget.end',
  TABLE_WIDGET_START: 'widgets::table-widget.start',
} as const)

export type WidgetsRenderHook = typeof WidgetsRenderHook[keyof typeof WidgetsRenderHook]

export type RenderHook = ActionsRenderHook | PanelsRenderHook | TablesRenderHook | WidgetsRenderHook

export type RenderSlotSource = 'application' | 'panel' | 'plugin' | 'component'

const sourceOrder: Readonly<Record<RenderSlotSource, number>> = Object.freeze({
  application: 0,
  plugin: 1,
  panel: 2,
  component: 3,
})

export interface ScopedRenderSlotManifest extends JsonObject {
  readonly component: string
  readonly order: number
  readonly properties: JsonObject
  readonly source: RenderSlotSource
}

export type ScopedRenderSlots<TSlot extends string> = Readonly<Partial<Record<TSlot, readonly ScopedRenderSlotManifest[]>>>

const componentPattern = /^[A-Za-z][A-Za-z0-9]*(?:[._:-][A-Za-z0-9]+)*$/u

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function normalizeProperties(value: JsonObject | undefined): JsonObject {
  const serialized = toJsonValue(value ?? {})
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
    throw new TypeError('Render slot properties must be a JSON-safe object')
  }
  return Object.freeze(serialized)
}

export function appendScopedRenderSlot<TSlot extends string>(
  slots: ScopedRenderSlots<TSlot>,
  slot: TSlot,
  reference: string | RenderSlotReference,
  source: RenderSlotSource,
): ScopedRenderSlots<TSlot> {
  if (!Object.hasOwn(sourceOrder, source)) throw new Error('Render slots require a valid registration source')
  const component = (typeof reference === 'string' ? reference : reference.component).trim()
  if (!componentPattern.test(component)) throw new Error('Render slots require a named registered component')
  const order = typeof reference === 'string' ? 0 : (reference.order ?? 0)
  if (!Number.isSafeInteger(order)) throw new Error('Render slot order must be a safe integer')
  const properties = normalizeProperties(typeof reference === 'string' ? undefined : reference.properties)
  const manifest: ScopedRenderSlotManifest = Object.freeze({ component, order, properties, source })
  const existing = slots[slot] ?? []
  const duplicate = existing.some(item => (
    item.component === component
    && item.order === order
    && item.source === source
    && canonicalJson(item.properties) === canonicalJson(properties)
  ))
  if (duplicate) throw new Error(`Duplicate render slot component "${component}" for "${slot}"`)
  const ordered = [...existing, manifest].sort((left, right) => (
    left.order - right.order
    || sourceOrder[left.source] - sourceOrder[right.source]
    || left.component.localeCompare(right.component)
    || canonicalJson(left.properties).localeCompare(canonicalJson(right.properties))
  ))
  return Object.freeze({ ...slots, [slot]: Object.freeze(ordered) })
}
