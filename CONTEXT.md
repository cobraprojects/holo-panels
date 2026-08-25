# Holo Panels

Holo Panels provides Filament-style administration panels for Holo-JS applications across Next.js, Nuxt, and SvelteKit.

## Language

**Panel definition**:
The application-authored source of truth for one administration panel, including identity, routes, branding, authentication, tenancy, resources, pages, widgets, and appearance.
_Avoid_: Panel config object, generated panel config

**Generated panel manifest**:
The client-safe representation derived from a panel definition under `.holo-js`. It contains serializable data and never becomes a second authored configuration source.
_Avoid_: Panel definition, route configuration

**Panel composition component**:
A Holo component that combines panel behavior with official shadcn components, such as a panel shell, resource table, or relation manager. It is not a replacement for a shadcn UI component.
_Avoid_: Custom primitive, Holo button, Holo input

**Resource**:
The panel definition for administering one Holo model, including its pages, form, table, infolist, actions, and relation managers.
_Avoid_: Model, table

**Relation manager**:
A resource-owned definition for administering one named Holo model relationship in the context of a parent record.
_Avoid_: Relation table, nested resource

**Panel notification**:
A notification defined through `@holo-js/panels-notifications`, modeled after Filament Notifications. It may appear as ephemeral Sonner feedback or use the panel notification package's database and broadcast capabilities.
_Avoid_: Direct toast, renderer error

**Simple resource**:
A resource with one `ManageRecords` page whose create, view, and edit actions use modals while the record list remains the normal page content.
_Avoid_: Modal resource, table-only resource

**Persistent table selection**:
The table-owned selection that remains active across pagination and filter changes. It contains explicit record identifiers or a scoped select-all query with deselected identifiers, and is always resolved and authorized again on the server.
_Avoid_: Current-page selection, trusted client IDs

**Panel widget**:
A dashboard or resource-page component registered through the widget package as a stats overview, chart, table, or custom widget. It receives only authorized, serializable state from the panel protocol.
_Avoid_: Dashboard card, arbitrary component
