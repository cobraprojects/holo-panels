# Ticket #22 widget API proposal

Status: approved by the user on 2026-08-31, including the proposed test boundaries.

Source: [ticket #22](https://github.com/cobraprojects/holo-panels/issues/22), under [the dashboard specification](https://github.com/cobraprojects/holo-panels/issues/4). Both prerequisite tickets, #11 and #16, are closed.

This proposal does not replace the authoritative checklist in `plans/implementation.md`.

## API additions

### Stat progress

Add an optional `progress` property to a stat returned by a stats widget data callback:

```ts
progress: { value: 75, max: 100 }
```

Omission or `null` means no progress indicator. Both numbers must be finite, `max` must be positive, and `value` must be between zero and `max`, inclusive. Validate the data on the server. All three renderers must expose the same labeled progress indicator and numeric values.

Keep the existing stat properties and widget factories. This does not introduce another stat builder or chart type.

### Dashboard filter forms

Add these fluent methods to the existing dashboard builder:

```ts
defineDashboard('overview')
  .filtersForm(filterSchema)
  .persistFiltersInSession()
  .widgets('content-overview', 'publishing-trend')
```

`filterSchema` is a compiled shared form schema, using the existing schema, field, and Holo validation contracts. It must retain inferred field and value types without application-authored casts or generic arguments. Schema callbacks stay on the server.

`persistFiltersInSession(enabled = true)` opts into Holo session persistence. Omission disables persistence. Persist only validated, allow-listed filter fields, scoped to the authenticated actor, panel, tenant, and dashboard. Reset restores schema defaults and removes saved state for that scope.

Dashboard filters apply to the dashboard's widgets. A widget-local filter with the same field name overrides that dashboard value for that widget only. Persisted values and client submissions do not authorize queries or select database columns.

Use the existing form controls and form state. Widget refresh must go through the existing panel transport and server authorization, including page and tenant access. Do not add a separate endpoint family or client validation engine.

## Confirmed gaps in the current implementation

- `packages/core/src/widgets/contracts.ts` has no stat progress property.
- `packages/core/src/widgets/dashboard.ts` has no shared filter schema or persistence configuration. Its dashboard definitions are not ordinary compiled pages, while adapter page discovery accepts only ordinary page definitions.
- `packages/react/src/widgets/renderer.tsx` renders a stat icon as an empty span.
- `packages/svelte/src/widgets/WidgetRenderer.svelte` omits stat icons and renders sparkline values as text rather than chart geometry.
- The three chart renderers duplicate geometry calculations. They disagree on category alignment and on how multiple pie series are grouped.
- `packages/client/src/widgets/store.ts` copies thrown exception messages into visible error state. It also retains supplied data for hidden and unauthorized results.
- The generated page clients create widget loaders that return the original resolved snapshot. Filter changes and polling do not fetch new widget data.
- Existing widget filters use separate hand-built controls. Dashboard-level filters do not use the shared form schema.

These findings require fresh behavior evidence before retaining the affected P12 completion claims. The audit is not completion evidence for ticket #22.

## Proposed test boundaries

The TDD skill requires confirmation of test boundaries before new tests are written. Use the existing boundaries below:

- Widget resolution and generated panel operations, observing authorization, tenant isolation, validated data, current-record and parent-table context, and exclusion of callbacks from manifests.
- The widget client store, observing filtering, persistence, cancellation, lazy activation, polling, denied results, and sanitized errors.
- Renderer DOM behavior, observing actual icons, sparklines, progress, chart data tables, responsive placement, and equivalent widget states.
- Shared built-application browser journeys across Next.js, Nuxt, and SvelteKit, observing dashboard navigation, filters, refresh, and resource placement.

The existing client widget suite passed all six tests on 2026-08-31 with `bunx vitest run tests/p12-widgets.test.ts --reporter=json`, run from `packages/client`. Those tests do not prove the missing browser behavior.

## Completion

After approval, implement and validate the changes, run the implement skill's standards and specification reviews against the task's starting commit `40c928279cce8194c1f5b240c013ff14a20f3170`, and commit on the current branch. Update the canonical implementation checklist only with observed evidence. Comment on #22 with validation and commit status, close it, and verify that GitHub reports `CLOSED`.
