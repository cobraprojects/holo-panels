# Multiple panels and guards

Holo Panels supports registering more than one panel with either a shared Holo Auth guard or separate guards. The panel definition selects the guard. A browser request cannot select or override it.

This guide documents behavior implemented in the current core and framework adapters. The final section separates repository-provided authentication and tenancy behavior from application-owned configuration.

## Define panel identity on the server

Pass the Holo actor model to `definePanel(id, Actor)` so callback types are inferred, then configure a stable panel ID, a static path, and a Holo Auth guard:

```ts
import { definePanel } from '@holo-js/panels'

class StaffActor {
  readonly id = 0
  readonly role: 'admin' | 'analyst' = 'analyst'
}

export const adminPanel = definePanel('admin', StaffActor)
  .path('/admin')
  .guard('staff')
  .access(({ actor }) => actor.role === 'admin')
  .presentActor(actor => ({ id: actor.id, role: actor.role }))

export const reportsPanel = definePanel('reports', StaffActor)
  .path('/reports')
  .guard('staff')
  .access(({ actor }) => actor.role === 'admin' || actor.role === 'analyst')
  .presentActor(actor => ({ id: actor.id, role: actor.role }))
```

The default guard is `web` when `.guard(...)` is omitted. `.presentActor(...)` is an explicit client projection: only return fields that the panel UI is allowed to receive. The default projection is an empty object.

Calling `.compile()` produces an immutable definition for runtime use. Normal applications usually let `holo prepare` discover and prepare panel definitions rather than constructing a separate routing or authentication system.

## Same-guard panels

Panels using the same guard resolve the same Holo Auth session and actor identity. A single `PanelRuntime.bootstrap([...])` call caches guard resolution by guard name, so bootstrapping `admin` and `reports` together resolves `auth.guard('staff')` once.

Sharing a guard does not merge the panels:

- each panel retains its own ID, path, manifest, resources, pages, plugins, and tenant configuration;
- each panel runs its own `.access(...)` policy, including during the shared bootstrap;
- operation authorization, resource policies, plugin permissions, cache identity, and tenant scope remain panel-specific.

This is the currently implemented same-guard SSO behavior: both panels consume the same Holo Auth guard/session. Holo Panels does not issue a second session or copy credentials between panels.

## Different-guard panels

Configure a different guard when a panel has independent authenticated state or an actor supplied by another Holo Auth provider:

```ts
class VendorActor {
  readonly id = ''
  readonly companyId = ''
}

export const vendorPanel = definePanel('vendor', VendorActor)
  .path('/vendor')
  .guard('vendors')
  .access(({ actor }) => actor.companyId.length > 0)
  .presentActor(actor => ({ id: actor.id }))
```

The runtime resolves `auth.guard('staff')` for the staff panels and `auth.guard('vendors')` for the vendor panel independently. A session authenticated for one guard does not satisfy the other guard unless Holo Auth itself reports an authenticated actor for both.

Panel and guard identity come from compiled server definitions. Operation endpoints accept an allow-listed panel ID, look up that compiled panel, and use its configured guard; request payloads cannot choose a guard or provider.

## Panel access is always independent

`.access(...)` receives a server-created `PanelAccessContext<TActor>` containing:

- `actor` from the configured Holo Auth guard;
- the compiled `guard` name;
- the fixed `panelId`;
- the resolved `provider` name or `null`;
- the current `operation` and `AbortSignal`.

The policy runs for bootstrap and every supported transport operation: `action`, `form-submit`, `notification`, `options`, `page-data`, `resolver`, `table-data`, and `upload`. An unauthenticated guard fails before access with `unauthenticated`; a false access result fails with `access-denied`.

Panel access is only the first application boundary. Resource and record policies, tenant access, plugin authorization layers, and operation invariants must still authorize their own work on the server. Hiding a navigation item or component is not authorization.

## Provider projection

Holo Panels asks the selected guard for both `user()` and `provider()`. The provider is then:

- included in the frozen authenticated server scope;
- available to panel access and operation execution;
- projected into the bootstrap payload as `provider: string | null`.

The provider string is identity metadata, not client authority. The client may observe it, but changing a request envelope cannot change which provider or guard the server resolves. Guard objects, callbacks, model values, session state, and provider implementations are never serialized into the panel manifest.

## Fixed operation routes

All three adapters use the same fixed operation route shape:

```text
/holo/panels/[panelId]/[operation]
```

The route handler receives an explicit `panelIds` allow-list. It rejects an unknown panel ID or operation and verifies that the decoded request envelope has the same `panelId` and `operation` as the route. Mutations are CSRF-protected and request bodies are bounded before execution.

The route parameters identify a prepared server registration; they do not identify a module path, model, relation, query, guard, or provider supplied by the client.

For multiple panels, add every served ID to the operation handler and create a separate page shell with a fixed `panelId` for each panel. Keep the panel's browser path aligned with the `.path(...)` in its compiled definition.

## Next.js route setup

Create the shared operation route at `app/holo/panels/[panelId]/[operation]/route.ts`:

The clean `holo` filesystem segment is exposed by Next.js at `/holo`, matching the endpoint used by panel clients.

```ts
import { createPanelOperationRoute } from '@holo-js/panels-next'
import { panelsRuntime } from '~/server/panels/runtime'

const route = createPanelOperationRoute({
  panelIds: ['admin', 'reports', 'vendor'],
  runtime: panelsRuntime,
})

export const GET = route.GET
export const POST = route.POST
```

Create one optional catch-all page shell per panel. For example, `app/admin/[[...panelsPath]]/page.tsx` contains:

```tsx
import { createPanelPage } from '@holo-js/panels-next'
import { panelsRuntime } from '~/server/panels/runtime'

export default createPanelPage({ panelId: 'admin', runtime: panelsRuntime })
```

Repeat that page file under `app/reports/[[...panelsPath]]/page.tsx` and `app/vendor/[[...panelsPath]]/page.tsx` with the corresponding fixed panel ID.

## Nuxt route setup

Create the shared Nitro handler at `server/routes/holo/panels/[panelId]/[operation].ts`:

```ts
import { createPanelOperationHandler } from '@holo-js/panels-nuxt'
import { panelsRuntime } from '../../../../panels/runtime'

export default createPanelOperationHandler({
  panelIds: ['admin', 'reports', 'vendor'],
  runtime: panelsRuntime,
})
```

Create one optional catch-all page per panel. For example, `pages/admin/[[...panelsPath]].vue` contains:

```vue
<script setup lang="ts">
import { PanelPage, usePanelPage } from '@holo-js/panels-nuxt'

const panelPage = await usePanelPage({ panelId: 'admin' })
</script>

<template>
  <PanelPage :page="panelPage" />
</template>
```

Repeat the page for each additional panel and change only its fixed `panelId` and filesystem path.

## SvelteKit route setup

Create the shared endpoint at `src/routes/holo/panels/[panelId]/[operation]/+server.ts`:

```ts
import { createPanelOperationHandler } from '@holo-js/panels-sveltekit'
import { panelsRegistry } from '$lib/server/panels/registry'

const handler = createPanelOperationHandler({
  panelIds: ['admin', 'reports', 'vendor'],
  registry: panelsRegistry,
})

export const GET = handler.GET
export const POST = handler.POST
```

Create one catch-all load and page pair per panel. For `src/routes/admin/[...path]/+page.server.ts`:

```ts
import { createPanelPageLoad } from '@holo-js/panels-sveltekit'
import { panelsRegistry } from '$lib/server/panels/registry'

export const load = createPanelPageLoad({
  panelId: 'admin',
  registry: panelsRegistry,
})
```

Its adjacent `+page.svelte` renders the returned data:

```svelte
<script lang="ts">
  import { PanelPage } from '@holo-js/panels-sveltekit'

  let { data } = $props()
</script>

<PanelPage {data} />
```

Repeat the pair for each additional panel with its fixed panel ID.

## Tenant and plugin server boundaries

The current core includes foundational tenancy and plugin contracts:

- `.tenancy(...)` keeps the model, membership resolver, access callback, identity function, route-key function, presenter, and active-tenant persistence callbacks on the server;
- bootstrap serializes only authorized tenant presentations and clears an active tenant that is no longer in the authorized membership set;
- switching resolves an allow-listed route key through the current actor's authorized memberships before saving it;
- queued tenant context is bound to the guard and panel ID and is re-authorized when resolved;
- `.plugin(...)` installs the plugin with the final compiled `{ id, guard }` identity;
- plugin authorization requests receive server-derived actor, guard, panel ID, tenant, permission, and signal values;
- plugin installations and authorization callbacks remain outside the client manifest.

These contracts establish server boundaries; they are not permission to trust client tenant IDs. Every resource lookup, relation lookup, search, notification, background operation, import, or export must resolve and authorize its tenant scope before data access.

## Authentication and tenancy ownership

Holo Panels provides inferred auth-page definitions for login, logout, profile, password reset, email verification, MFA enrollment/challenge/recovery/disable, secure framework cookie effects, same- and different-guard isolation, tenant registration/profile/switching, automatic resource scoping with explicit `.shared()` opt-out, cache identity rotation, and queued-context reauthorization.

Applications still configure their Holo Auth guards, session driver and cookie policy, credential verification, mail delivery, tenant membership queries, panel-access callbacks, actor and tenant presentation allow-lists, and domain policies. Browser visibility never replaces server authorization, and authenticated framework routes must derive actor and tenant identity from the configured request guard rather than request payloads.

## Implementation evidence

- [Panel contracts](../packages/core/src/panels/contracts.ts)
- [Panel builder](../packages/core/src/panels/panel.ts)
- [Panel runtime](../packages/core/src/panels/runtime.ts)
- [Multiple-panel runtime tests](../packages/core/tests/p9-b-pages-panels.test.ts)
- [Core panel plugin and tenancy tests](../packages/core/tests/p14-core-panel-integration.test.ts)
- [Next adapter example](../apps/example-next/app/admin/[[...panelsPath]]/page.tsx)
- [Nuxt adapter example](../apps/example-nuxt/app/pages/admin/[[...panelsPath]].vue)
- [SvelteKit adapter example](../apps/example-sveltekit/src/routes/admin/[...path]/+page.server.ts)
- [Package and public-subpath reference](./package-reference.md)
