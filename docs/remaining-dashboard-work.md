# Remaining dashboard work

This document records the unresolved dashboard refactor work found on 2026-08-22. It is a remediation brief, not a replacement for the authoritative checklist in `plans/implementation.md`. A task is complete only when its behavior passes in Next.js, Nuxt, and SvelteKit.

## 1. Make panel configuration the single source of truth

- Keep branding, colors, theme, density, fonts, content width, panel paths, and authentication paths in the panel definition.
- Stop serializing those values as literal props in generated login, profile, MFA, and MFA recovery routes.
- Make generated framework routes identify the panel and load its serializable configuration through the supported panel bootstrap path.
- Keep server callbacks and server-only values out of client payloads.
- Regenerate every managed auth route in the example applications after fixing the generator.

The final application code must define the value once:

```ts
export default definePanel(User)
  .id('admin')
  .brandName('Holo Panels Admin')
```

Generated pages must not repeat `Holo Panels Admin` or the rest of the panel configuration.

## 2. Restore authentication behavior

- Fix Next.js login so a fresh page load submits the current CSRF token successfully.
- Refresh an expired or stale CSRF token and retry once without trapping the user on the login page.
- Apply the same behavior to Nuxt and SvelteKit.
- Preserve the requested `next` destination after authentication.
- Show invalid credentials as an authentication error. Do not misreport them as a CSRF failure.
- Cover fresh login, stale-token recovery, invalid credentials, successful redirect, and repeated submission in browser tests.

## 3. Fix client effect lifetime

- Remove the cause of `Client effect session is disposed.` during edit forms, modal actions, uploads, and navigation.
- Give each mounted panel client one live effect session.
- Cancel requests owned by an unmounted client without disposing the replacement client's session.
- Ignore late responses from obsolete requests safely.
- Cover route transitions, rapid repeated actions, modal close, upload cancellation, and component remounts with behavior tests.

## 4. Use shadcn components throughout the dashboard

- Replace remaining dashboard controls with the framework's shadcn implementation.
- Remove replaced custom component implementations and their unused styles.
- Use shadcn/ui for React, shadcn-vue with Reka UI for Vue, and shadcn-svelte with Bits UI for Svelte.
- Use the same shared Holo behavior contracts and aligned visual states across React, Vue, and Svelte.
- Allow Holo panel composition components only when they assemble official shadcn components with panel behavior.
- Keep stable Holo class names on component roots so applications can override styles deliberately.
- Keep dashboard Tailwind compilation isolated from the application's frontend Tailwind setup.
- Generate only classes used by the dashboard and registered user extensions.
- Provide and verify the command that rebuilds the isolated dashboard stylesheet after a user adds custom classes or renderers.
- Apply the Emil Kowalski design engineering principles to interaction polish and motion.
- Do not animate keyboard-driven or frequently repeated actions.
- Animate only when motion explains state, preserves spatial continuity, provides feedback, or prevents a jarring change.
- Prefer interruptible CSS transitions, animate transform and opacity, use origin-aware popovers, keep modals centered, and honor reduced-motion preferences.
- Keep normal UI motion under 300 milliseconds, use a fast custom ease-out for entry, and make exits faster than entries.
- Give pressable controls subtle active feedback without changing their layout.

This applies to navigation, buttons, icon buttons, dropdown menus, command search, input groups, forms, selects, dialogs, sheets, cards, tables, pagination, badges, alerts, skeletons, empty states, notification inboxes, and Sonner toasts.

### Dashboard composition

- Follow the [UIThing dashboard reference](https://uithing.com/block-renderer?component=BlockSidebar07&path=Sidebar/BlockSidebar07&containerClass=false) for the panel's visual composition without copying its implementation.
- Use a collapsible shadcn Sidebar on desktop, an icon rail when collapsed, and a shadcn Sheet on mobile.
- Put the tenant switcher at the top of the sidebar, followed by grouped navigation. Put account controls at the bottom.
- Preserve configured navigation groups, labels, icons, order, badges, visibility, and authorization in both expanded and collapsed states.
- Keep the page header on one line when space permits, with breadcrumbs and the title on the leading side and page actions on the opposite side.
- Use the configured content width consistently on dashboards, resource pages, forms, tables, and relation managers.
- Support light and dark themes without changing component geometry.

## 5. Unify the action system and action UI

- Render page, table row, table bulk, relation manager, notification, and form actions through the shared action package and shared presentation rules.
- Give every built-in action an icon.
- Make destructive built-in actions use the destructive color and require confirmation by default.
- Apply that rule to delete, bulk delete, detach, bulk detach, and every other destructive built-in action.
- Put page actions in the page header, opposite the title.
- Use the same button, menu item, dialog, loading, disabled, and error treatment in every action location.
- Report action success and failure through `@holo-js/panels-notifications`, with ephemeral panel notifications rendered through Sonner. Do not insert transport or availability errors inside menus or tables.
- Support notification action buttons, URLs, dismiss actions, persistent notifications that do not auto-dismiss, configured durations, custom IDs, and explicit close controls.
- Keep ephemeral, database, and broadcast notification delivery behind the same Panels notification definition and action API.
- Preserve the public methods for changing labels, icons, colors, confirmation text, visibility, authorization, modal content, and execution behavior.
- Let users opt a destructive action out of confirmation explicitly with `requiresConfirmation(false)` while keeping confirmation enabled by default.
- Allow users to omit or remove built-in actions without hidden registrations remaining active.

## 6. Rebuild tables on the shared table implementation

- Use the normal shadcn Table components in all three renderers.
- Implement table behavior through the Holo table package and server protocol without TanStack Table.
- Follow the table styling in [UIThing BlockDashboards1](https://uithing.com/block-renderer?component=BlockDashboards1&path=Dashboards%2FBlockDashboards1&containerClass=false): one low-chrome bordered table surface, compact rows, subdued headers, inline sort affordances, restrained status badges, row menus, and a simple footer.
- Replace the reference's summary-widget strip with the selected-record bulk-action bar when records are selected.
- Fix row selection, select-page, select-all-matching, clear selection, bulk action payloads, and selection reset.
- Preserve selected records while the user moves between pagination pages or changes filters so they can build a selection across result views.
- Represent `select all matching` as the current scoped query plus an exclusion set when that is more efficient than sending every record ID.
- Re-resolve, tenant-scope, authorize, and validate every selected record on the server when a bulk action executes. Never trust client-supplied selection state as authorization.
- Match Filament's table selection controls, including current-page-only selection, group-only selection, maximum selectable records, post-action deselection, chunked processing, and an option to avoid fetching full selected records when the action only needs identifiers.
- Make grouped bulk actions execute the registered action instead of returning `The requested action is not available.`
- Render sortable headers as table headers with a sort affordance. Do not style the active header as a primary action button.
- Make column visibility, filters, searching, pagination, page size, loading, and empty results work together.
- Use one table component for resource lists and relation managers.
- Use one loading state and one empty state for normal tables and relation-manager tables.
- Cover successful and failed bulk actions, destructive confirmation, filtering, sorting, pagination, selection, and empty results in browser tests.

## 7. Fix forms and field behavior

- Use `@holo-js/forms` for client form state, submission state, preserved values, and typed error bags.
- Use `@holo-js/validation` as the authoritative backend validation engine according to the [Holo Forms](https://docs.holo-js.com/forms/) and [Holo Validation](https://docs.holo-js.com/validation/) documentation.
- Reuse one inferred schema across client enhancement and server validation without creating a Holo Panels validation system.
- Validate on submit by default. After a failed submission, revalidate each invalid field as the user corrects it.
- Use shadcn input groups for global search, table search, and every field prefix or suffix.
- Align grouped input borders, focus rings, heights, icons, and spacing with normal shadcn inputs.
- Make select controls use the same available width as text inputs.
- Use one form layout and spacing system on create pages, edit pages, action modals, and relation-manager forms.
- Restore reactive slug generation from the configured source field without requiring the user to leave the field.
- Preserve a manually edited slug instead of overwriting it on later title changes.
- Fix file selection, upload progress, completion, validation errors, removal, and cancellation.
- Show field validation through the typed Holo form error bag beside the affected field.
- Show form-wide validation through the Holo form error bag inside the form.
- Send successful operations and non-validation action failures through `@holo-js/panels-notifications`.
- Do not expose raw runtime errors.

### Filament-compatible fields and schemas

- Support the complete Filament 5 form-field set: text input, select, checkbox, toggle, checkbox list, radio, date-time picker, file upload, rich editor, Markdown editor, repeater, builder, tags input, textarea, key-value, color picker, toggle buttons, slider, code editor, and hidden.
- Support custom fields through the same registry and renderer contract as built-ins.
- Support Filament 5 schema layouts: grid, flex, fieldset, section, tabs, wizard, callout, and empty state.
- Support responsive columns, column spans, ordering, nesting, collapsible and compact sections, labels and descriptions, visibility, disabled and read-only state, helper text, prefixes and suffixes, hints, and actions where the corresponding Filament component supports them.
- Preserve Filament-style reactive field behavior, including live, blur, and debounce modes; typed get and set utilities; dependent options and schemas; lifecycle hooks; and relationship-backed fields.
- Keep the user-facing schema fluent and directly imported. Model paths must be inferred from the resource or relation-manager binding without user-written generics or casts.

## 8. Fix resource and relation-manager behavior

- Make every discovered resource appear in navigation according to its configured group, label, icon, order, and authorization.
- Generate simple resources through the resource generator's `--simple` option with one `ManageRecords` page, a normal list view, and create, view, and edit actions in modals.
- Render registered relation managers on their parent resource's edit and view pages.
- Resolve a relation manager's record type from the parent resource model and its relation from the static relationship property.
- Use the normal table, form, action, empty-state, loading, and pagination components inside relation managers.
- Verify attach, detach, create, edit, view, delete, bulk actions, authorization, and tenant scoping.

## 9. Preserve SPA navigation by default

- Use framework-native client navigation for internal panel links in Next.js, Nuxt, and SvelteKit.
- Preserve panel client state when navigation does not require a full document load.
- Keep modified-click, external-link, download, hash, and cross-origin behavior correct.
- Cover sidebar links, breadcrumbs, table record links, page actions, redirects, and browser back and forward navigation.

## 10. Finish the Filament-style typed public API

- Keep the resource model as a static resource property. Do not redeclare migration columns in the model or resource.
- Keep a relation manager's relationship as a static property.
- Resolve model fields and relations from Holo-generated migration types in `.holo-js`.
- Infer column names, form paths, relation names, record callback parameters, action contexts, and result types from those generated types.
- Provide autocomplete for every accepted field and relation name.
- Reject invalid field and relation names at compile time.
- Require no user-written generic arguments, casts, extracted base-class members, or generated-table declarations in application code.
- Keep actions, forms, tables, infolists, notifications, widgets, pages, resources, and relation managers as normal package imports.
- Match Filament's direct array shape for schemas and tables. Do not require a contextual factory callback solely to recover model inference.

The final resource code must allow calls such as:

```ts
TextColumn.make('author_name')
```

The model binding must supply the type. The user must not write `TextColumn.make<CommentRecord>(...)` or extract constructors from a generated base class.

The table API must allow normal imports and a direct array:

```ts
table.columns([
  TextColumn.make('title'),
  TextColumn.make('author.name'),
])
```

The resource model binding and generated `.holo-js` declarations must contextually constrain each component. Invalid paths must fail at compile time and valid paths must autocomplete.

## 11. Add panel localization and RTL support

- Ship English and Arabic panel translations for every built-in label, action, validation message, notification, empty state, navigation item, table control, form control, and authentication screen.
- Resolve the active panel locale from the Holo application locale by default, with a panel-level override and an allow-list of supported locales.
- Carry both locale and text direction in the generated panel manifest and every server-driven response that can render independently.
- Set the document language and direction correctly and make every layout, icon placement, menu, popover, dialog, table, pagination control, form, notification, chart, and animation origin work in both LTR and RTL.
- Use logical CSS properties and direction-aware shadcn/Radix primitives. Do not maintain a parallel Arabic stylesheet.
- Fall back to English per missing translation key without exposing raw keys.
- Make application overrides and additional locale bundles rebuild through the isolated panel-theme command.
- Run the shared browser journeys in English/LTR and Arabic/RTL across Next.js, Nuxt, and SvelteKit.

## 12. Add Filament-compatible widgets

- Support Filament's four widget types through normal package imports and the shared widget registry: stats overview, chart, table, and custom.
- Treat chart as the Filament widget capability; do not add a separate chat widget.
- Let stats widgets express the visual capabilities shown in the [UIThing app stats references](https://uithing.com/blocks/app-stats), including values, descriptions, icons, colors, trends, sparklines, progress, and responsive grids without hard-coding one card design.
- Build table widgets on the same table package, protocol, shadcn Table composition, actions, loading state, empty state, selection, pagination, and authorization boundaries as resource tables.
- Support custom widgets through registered serializable manifests and framework renderers without allowing server callbacks or arbitrary source to reach the client.
- Match Filament widget behavior for sort order, responsive column span, conditional visibility, dashboard filters, persisted filters, multiple dashboards, resource-page placement, current-record context, and access to the parent page table's scoped data.
- Generate widget files and type bindings through the normal Holo commands and watch them during `holo dev`.

## 13. Finish generation and command integration

- Generate required resource and relation-manager type bindings under `.holo-js` during `holo prepare` and `holo build`.
- Watch resource and relation-manager additions, removals, renames, model changes, relationship changes, and migration type changes during `holo dev`.
- Regenerate only managed output and preserve user-authored files.
- Make resource and relation-manager generator commands emit the approved static model and relationship API.
- Refuse ambiguous overwrites and remove obsolete managed output when its source disappears.
- Verify generated imports, framework routes, registries, declarations, and theme files in clean applications.

## 14. Remove incomplete and orphaned code

- Remove obsolete custom UI components, CSS selectors, compatibility branches, duplicate renderers, old action paths, stale generated files, and unused exports.
- Confirm deleted component files have no remaining imports or package exports.
- Confirm published UI snapshots match the maintained renderer source.
- Run unused-code, duplicate-code, circular-dependency, and architecture-boundary checks.
- Review all current changed and untracked files. Keep only files required by the approved implementation.

## 15. Replace implementation checks with behavior coverage

- Test what a panel user can see and do. Do not assert private component structure as proof of behavior.
- Run the same shared journeys against Next.js, Nuxt, and SvelteKit.
- Cover login, CSRF recovery, SPA navigation, resource discovery, create, reactive slugging, upload, edit, view, delete, destructive confirmation and opt-out, cross-page selection, select-all exclusions, bulk actions, Panels notification actions and persistence, relation managers, widgets, localization, RTL, theme isolation, render hooks, and responsive layout.
- Assert that failures use the public UI and never expose stack traces, internal paths, disposed-session messages, or raw transport errors.
- Keep focused unit tests only where they catch type inference, protocol validation, security boundaries, or framework integration failures that browser journeys cannot isolate.

## 16. Complete validation before declaring the refactor done

- Run language-server diagnostics on every changed executable file.
- Run the full strict TypeScript build with zero errors.
- Run ESLint with fixes on changed executable files, then run the full lint command with zero errors.
- Run focused behavior tests with the JSON reporter while fixing each area.
- Run the full workspace test suite.
- Run all browser journeys against Next.js, Nuxt, and SvelteKit.
- Run architecture and dependency-policy validation.
- Build every package and every example application.
- Run conditional-export checks, packed-package smoke tests, and clean-install generation tests.
- Inspect the three dashboards at desktop and mobile widths in light and dark themes, in English/LTR and Arabic/RTL.
- Update `plans/implementation.md` only after the current behavior supplies fresh evidence for each affected acceptance criterion.

The refactor is not complete until all commands pass from a clean checkout and every browser journey passes against the built packages.
