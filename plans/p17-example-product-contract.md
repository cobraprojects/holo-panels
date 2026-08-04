# P17 example product contract

Status: frozen framework-neutral example contract. Implementations may use current exported APIs now. Sections marked pending must wait for their approved P14-P16 public APIs.

Next.js, Nuxt, and SvelteKit must expose the same domain identifiers, seed identities, tenant boundaries, and observable behavior. Framework wiring may differ; product semantics may not.

## Stable identifiers

### Panels and tenants

| Kind | ID | Route key | Purpose |
| --- | --- | --- | --- |
| Panel | `admin` | `/admin` | Authenticated administration panel. |
| Tenant | `tenant-acme` | `acme` | Primary fixture tenant. |
| Tenant | `tenant-globex` | `globex` | Isolation fixture tenant. |

### Actors

| ID | Role intent | Tenant access | Required behavior |
| --- | --- | --- | --- |
| `user-super-admin` | Super administrator | Acme and Globex | Full approved panel access; Shield bypass remains bounded by panel, tenant, policy, and invariants. |
| `user-acme-admin` | Tenant administrator | Acme | Administer Acme content and users only. |
| `user-acme-editor` | Editor | Acme | Manage allowed content but not roles or users. |
| `user-globex-editor` | Editor | Globex | Same content capability within Globex only. |
| `user-denied` | Denied actor | None | Cannot bootstrap the panel or execute operations. |

Authentication pages and persisted role assignment remain pending P14 integration. Current fixtures may inject these identities only through their existing test guard/runtime boundary.

### Domain records

Every persistent record uses a stable string ID and, unless explicitly global, a required `tenantId`.

| Entity | Stable resource ID | Minimum fields | Scope |
| --- | --- | --- | --- |
| Post | `posts` | `id`, `tenantId`, `title`, `slug`, `excerpt`, `body`, `status`, `categoryId`, `authorId`, `featuredMediaId`, timestamps | Tenant |
| Category | `categories` | `id`, `tenantId`, `name`, `slug`, timestamps | Tenant |
| Tag | `tags` | `id`, `tenantId`, `name`, `slug`, timestamps | Tenant |
| Post tag | `post-tags` | `tenantId`, `postId`, `tagId` | Tenant |
| Comment | `comments` | `id`, `tenantId`, `postId`, `authorName`, `body`, `status`, timestamps | Tenant |
| User | `users` | `id`, `name`, `email`, timestamps | Global identity with tenant memberships |
| Membership | `memberships` | `tenantId`, `userId`, `roleKey` | Tenant |
| Media | `media` | `id`, `tenantId`, `disk`, `path`, `mime`, `size`, `alt`, timestamps | Tenant/private by default |

Example records must include at least three posts per tenant, two categories per tenant, three tags per tenant, one pending and one approved comment per tenant, and one private image per tenant. Equivalent seed values and IDs are required across frameworks.

## Current public-API slice

Each framework may implement these immediately:

- tenant-scoped models and migrations for Category, Tag, Comment, User, Membership, and Media;
- resource metadata, forms, tables, infolists, relations, navigation, global search, widgets, and notifications using current exported APIs;
- runtime authorization callbacks and tenant scopes using the existing guard and panel boundaries;
- deterministic app-local test fixtures that never bypass the normal runtime executor for behavior assertions;
- a public blog index, category/tag filtering, post detail, safe media presentation, and comment display using framework-native application routes.

No framework may create substitute authentication pages, Shield administration, import/export execution, schema transport, renderer registries, or UI publishing APIs.

## Pending approved-API slice

After the exact proposals are approved and implemented, all frameworks must add equivalent journeys for:

- panel login, logout, profile, password reset, email verification, and MFA enrollment/challenge/recovery;
- tenant switching with persisted active membership and revocation revalidation;
- Role and Permission administration through Shield;
- queued CSV import with mapping, progress, failures, cancellation, and idempotent retry;
- queued CSV/XLSX export with selected columns, progress, private storage, expiring authorization, and cleanup;
- remaining P16 schema transport, slots, defaults, plugin assets, custom registry, and sample money plugin surfaces.

## Observable behavior contract

The same acceptance assertions must pass in all three frameworks:

1. A denied actor cannot bootstrap `admin`; an allowed actor receives only the approved actor presentation.
2. Acme identities cannot read, search, relate, mutate, aggregate, notify, import, export, or download Globex data, and the inverse also holds.
3. Post create/edit applies authoritative validation, derives the slug reactively for convenience, and persists only allow-listed fields.
4. Category and city dependent options exclude foreign-tenant and unavailable values.
5. Tag attach/detach and comment create/moderate execute through owner-, tenant-, and policy-scoped relation operations.
6. Private media rejects spoofed MIME, oversize data, traversal, foreign-tenant preview/delete, and unauthorized finalization.
7. Navigation, global search, widgets, and notification inbox output changes with actor and tenant scope without leaking hidden fields.
8. Role changes take effect after cache/session revalidation and never bypass panel, tenant, record-policy, or invariant checks.
9. Import retry is idempotent and export downloads require an unexpired grant bound to actor, panel, and tenant.
10. Browser journeys preserve hydration, keyboard navigation, focus restoration, live regions, safe errors, CSRF, and fixed operation routing.

## Framework route contract

| Surface | Next.js | Nuxt | SvelteKit |
| --- | --- | --- | --- |
| Panel catch-all | `app/admin/[[...panelsPath]]/page.tsx` | `app/pages/admin/[[...panelsPath]].vue` | `src/routes/admin/[...path]/+page.server.ts` and `+page.svelte` |
| Panel operations | `app/admin/_panels/[operation]/route.ts` | `server/api/admin/_panels/[operation].ts` | `src/routes/admin/_panels/[operation]/+server.ts` |
| Blog index | `app/blog/page.tsx` | `app/pages/blog/index.vue` | `src/routes/blog/+page.server.ts` and `+page.svelte` |
| Blog post | `app/blog/[slug]/page.tsx` | `app/pages/blog/[slug].vue` | `src/routes/blog/[slug]/+page.server.ts` and `+page.svelte` |

App-owned runtime and domain files remain outside managed generated routes. Generators must preserve those files and continue refusing ambiguous managed overwrites.

## Completion evidence

- Identical inventory and stable IDs in all three apps.
- Framework typechecks, lint, production builds, and app behavior tests.
- Shared browser results for the ten critical journeys in `plans/p17-example-gap-audit.md`.
- Packed clean-consumer builds and browser smoke tests with no workspace alias or source-directory resolution.
- Canonical checklist updates only after each stated behavior is observed.
