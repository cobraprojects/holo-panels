# Security model and deployment checklist

This document describes the security properties visible in the current repository. It is a threat model, not a claim that every planned release feature is complete. “Implemented” means a control exists in current source and has directly relevant tests. “Pending” means the control is required by the implementation plan but is absent, internal-only, or not connected end to end.

The application remains responsible for its Holo Auth configuration, policies, validation schemas, tenant resolvers, plugin selection, storage and queue configuration, secrets, network controls, logging, and infrastructure.

## Security status at a glance

| Area | Current status | Release consequence |
|---|---|---|
| Panel bootstrap | Implemented core authentication, panel access, and JSON projection | The application must explicitly project a safe actor object. |
| Transport | Implemented framework route allow-lists, request bounds, CSRF for mutations, envelope validation, and structured errors | Application-owned operation handlers must still authorize and validate their domain input. |
| Uploads | Implemented service-level policy, scope, token, MIME, size, private preview, and cleanup controls | Endpoint registration and the authorization callback are application/runtime responsibilities. |
| Rich content | Implemented structural rich-text sanitizer and escaped Markdown serialization | Raw HTML is not a supported trusted-content surface. Custom renderers remain trusted code. |
| Notifications | Implemented recipient, guard, panel, tenant, ID, payload, URL, and mutation scoping | Application callbacks must derive recipient and tenant identity from authenticated scope. |
| Plugins | Implemented stable IDs, duplicate detection, explicit renderer lookup, and compatibility helpers | Plugins are trusted executable code; there is no sandbox, signature verification, or automatic compatibility enforcement at every registration point. |
| Tenancy | Implemented membership resolution, active-tenant validation, automatic resource scope, cache identity, queued-context reauthorization, and scoped resources, relations, search, notifications, uploads, imports, and exports | Application callbacks must preserve the trusted tenant context; shared resources require an explicit `.shared()` declaration. |
| Permissions | Implemented Holo policy calls, domain authorization callbacks, Shield evaluation/storage, Role and Permission resources, and command/migration lifecycle | Shield remains optional; applications choose where to install its authorization layer, and UI visibility is never authorization. |
| Imports and exports | Implemented bounded CSV/mapping/query engines, durable Holo DB lifecycle and outbox, Holo Queue work, private Holo Storage, CSV/XLSX finalization, notifications, cancellation, cleanup, and mounted framework controls | Applications supply domain persistence, validation, policies, worker operation, and retention configuration. |
| Background jobs and private downloads | Implemented durable scope-bound records and envelopes, atomic leases/transitions, bounded retries, private streaming artifacts, signed grants, reauthorization, and cleanup | Deployments must run workers and cleanup, retain artifacts privately, and protect signing keys. |

The remaining release work is tracked in [Phase P17 of the implementation plan](../plans/implementation.md#49-phase-p17-documentation-hardening-and-release). Do not treat unchecked release or registry tasks as completed publication evidence.

## Assets and security objectives

Holo Panels protects:

- authenticated actor and provider identity;
- panel, tenant, resource, record, relation, notification, and transfer boundaries;
- hidden model attributes, server callbacks, secrets, source paths, and stack traces;
- mutation integrity and idempotency;
- uploaded bytes and private stored artifacts;
- permission, role, and tenant assignments;
- generated registries and the mapping from stable IDs to trusted server modules;
- browser integrity against XSS, unsafe navigation, prototype-path mutation, and spreadsheet formula injection.

The primary objectives are fail-closed authorization, scoped lookup before disclosure, strict parsing at every client/server boundary, bounded resource use, and non-disclosure of server-only state.

## Trust boundaries

1. **Browser to framework endpoint.** Browser values, route parameters, headers, cookies, form fields, uploaded bytes, notification IDs, record IDs, and persisted browser state are untrusted.
2. **Framework adapter to panel runtime.** The adapter must select an operation from its fixed allow-list, match route and envelope identifiers, establish Holo request context, verify CSRF for mutations, and pass only authenticated scope to server handlers.
3. **Panel runtime to application callbacks.** Access policies, tenant resolvers, field validation, resource persistence, action handlers, notification identity resolvers, and plugin code are trusted application code. Their return values still cross serialization and presentation boundaries.
4. **Domain executor to database, storage, media, queue, and realtime services.** Queries and mutations must be tenant- and authorization-scoped before lookup. Storage keys, queue envelopes, realtime channels, and download grants are capability-bearing values.
5. **Prepare-time discovery to production registry.** Application source is trusted during `holo prepare`. Production requests may select only fixed generated IDs; they must never select source paths, imports, or modules.
6. **Server manifest to renderer.** Manifests are JSON data, not executable source. Renderer registries and custom components are trusted code and must treat manifest text and record values as untrusted content.

## Attacker capabilities

Assume an attacker can:

- use an unauthenticated browser or a valid low-privilege account;
- alter every request field, route segment, ID, selected column, action name, tenant key, upload declaration, and client-side visibility state;
- replay, reorder, duplicate, cancel, or race requests and background messages;
- guess record, notification, upload, operation, and download identifiers;
- submit oversized, malformed, deeply structured, non-UTF-8, formula-prefixed, path-like, or markup-bearing input;
- trigger stale sessions, stale tenant selections, expired capabilities, aborted requests, partial failures, and concurrent writes;
- install or modify application packages and source only if they already control the deployment or dependency supply chain.

The model does not attempt to contain malicious server plugins or malicious application code. Those execute inside the application's trust boundary.

## Non-negotiable invariants

- A client-provided panel, resource, action, field, column, relation, model, module, or path name never becomes a dynamic import or arbitrary query selector.
- Authentication and panel access run on the server for bootstrap and every operation.
- Tenant and authorization scopes are applied before record or relation lookup, search execution, export counting, or notification mutation.
- Visibility controls presentation only. Every mutation and sensitive read requires server authorization.
- Writable fields, pivot fields, export columns, IDs, operations, and renderer types are allow-listed.
- Holo validation or an explicitly supplied server validator is authoritative; client validation is advisory.
- Server callbacks, class instances, functions, circular values, unsafe URLs, non-finite numbers, stack traces, and local paths do not belong in client manifests or structured errors.
- Uploaded content is not trusted based on its filename or declared MIME type.
- Rich content is structured and sanitized; plain text remains the default.
- Private artifacts are never made public merely because the caller knows a storage key or operation ID.
- Background work is bound to a versioned actor, panel, and tenant scope and revalidated when consumed.

## Panel bootstrap

### Implemented controls

[`PanelRuntime`](../packages/core/src/panels/runtime.ts) resolves the configured Holo Auth guard, rejects missing users, runs the selected panel's access callback, and creates a frozen authenticated scope for bootstrap and operations. Unknown panel IDs, unauthenticated requests, access denial, and non-object actor presentations fail closed. Multiple requested panels sharing a guard reuse one guard-resolution promise but each panel is authorized independently.

The bootstrap manifest contains compiled JSON presentation rather than server callbacks. [`toJsonValue`](../packages/core/src/protocol/serialization.ts) rejects functions, symbols, class instances, cycles, non-finite numbers, and unsafe values under URL-named keys. Page schema projection in [`pages/resolution.ts`](../packages/core/src/pages/resolution.ts) evaluates server visibility and omits the server callback before serialization.

Realtime notification channels are disclosed only after inbox list authorization and must be bounded stable names. Reserved `private-` and `presence-` prefixes are rejected before the client adds its trusted private-channel prefix.

Evidence: [`p9-b-pages-panels.test.ts`](../packages/core/tests/p9-b-pages-panels.test.ts), [`protocol.test.ts`](../packages/core/tests/protocol.test.ts), and [`p13-panel-notification-shell.test.ts`](../packages/core/tests/p13-panel-notification-shell.test.ts).

### Application duties and residual controls

`presentActor` is an application-owned projection. It must return only fields safe for every browser receiving that panel bootstrap; serialization does not infer hidden actor attributes. Panel access must not default to `true` in production unless the entire authenticated guard is intended to have access.

Repository suites audit generated manifests for callbacks, secrets, hidden attributes, local paths, unsafe errors, and unexpected client values. [`SECURITY.md`](../SECURITY.md) defines supported-version and reporting policy. Deployments remain responsible for rate limits and correlated security logging appropriate to their infrastructure and risk model.

## Transport operations

### Implemented controls

The current operation union is `action`, `bootstrap`, `form-submit`, `notification`, `options`, `page-data`, `resolver`, `table-data`, and `upload`; see [`panels/contracts.ts`](../packages/core/src/panels/contracts.ts). Next.js, Nuxt, and SvelteKit adapters keep matching fixed operation sets and reject unknown operations.

The adapters enforce bounded request bodies of 1 MiB, fixed panel IDs, route/envelope operation equality, supported methods, and Holo Security CSRF checks on mutation POST routes. Their implementations are [`next/src/operation.ts`](../packages/next/src/operation.ts), [`nuxt/src/server.ts`](../packages/nuxt/src/server.ts), and [`sveltekit/src/server.ts`](../packages/sveltekit/src/server.ts).

[`transport/codec.ts`](../packages/core/src/transport/codec.ts) requires versioned JSON envelopes, bounded-format idempotency keys, matching response IDs, known error categories, and known typed effects. Redirect and download effects allow root-relative or HTTP(S) URLs and reject unsafe schemes. [`PanelsTransport`](../packages/client/src/transport/panels-transport.ts) uses same-origin credentials, requires a CSRF field, validates same-origin endpoint paths, retries reads rather than arbitrary mutations, and bounds retry settings.

Resource mutations in [`resources/executor.ts`](../packages/core/src/resources/executor.ts) allow-list writable attributes, run validation, use transactions, scope queries before ID lookup, invoke Holo class and record policies, and remove model-hidden fields during serialization. Action execution in [`actions/engine.ts`](../packages/core/src/actions/engine.ts) validates mounts, bounds bulk IDs, authorizes each execution, handles optimistic versions, binds idempotency to actor and tenant identity, and limits response effects. Relation operations in [`relations/executor.ts`](../packages/core/src/relations/executor.ts) apply owner, tenant, and authorization scopes before related-record lookup and allow-list input and pivot fields.

Evidence: [`transport.test.ts`](../packages/core/tests/transport.test.ts), [`client transport.test.ts`](../packages/client/tests/transport.test.ts), [`next adapter tests`](../packages/next/tests/p9-c-next-adapter.test.tsx), [`nuxt adapter tests`](../packages/nuxt/tests/p9-d-nuxt-adapter.test.ts), [`sveltekit server tests`](../packages/sveltekit/tests/server.test.ts), [`p9-a-resources.test.ts`](../packages/core/tests/p9-a-resources.test.ts), [`p8-b-actions.test.ts`](../packages/core/tests/p8-b-actions.test.ts), and [`p10-relation-managers.test.ts`](../packages/core/tests/p10-relation-managers.test.ts).

### Application and infrastructure controls

- Per-operation strict payload schemas remain the responsibility of each registered handler; the generic JSON envelope is not a domain validator.
- Rate limits for authentication, search, options, imports, exports, and sensitive custom actions are required but are not supplied by the common transport.
- Generic action idempotency is process-local, not a durable distributed idempotency store.
- Imports and exports are mounted through fixed action/runtime definitions rather than adding request-selected operation names to `PanelOperation`.
- Security logging and audit correlation must be added without recording credentials, upload tokens, download grants, raw sensitive rows, or internal exceptions.

Unexpected failures should be mapped to generic structured errors at the adapter boundary. Production responses must not include caught error stacks, database messages, filesystem paths, or secrets.

## Uploads

### Implemented controls

[`defineUploadPolicy`](../packages/core/src/fields/upload/policy.ts) validates extension, MIME, size, count, expiry, disk, conversion, and safe relative-directory configuration. [`TemporaryUploadService`](../packages/core/src/fields/upload/service.ts):

- normalizes filenames and rejects separators and NUL bytes;
- generates a random token by default, stores only its SHA-256 hash, and compares hashes with `timingSafeEqual`;
- binds metadata to actor, panel, resource, field, and optional tenant identity;
- reauthorizes create, write, preview, delete, and finalize operations;
- checks expiry, exact byte size, extension, declared MIME, detected signature MIME, file count, and image-only policy;
- serializes concurrent creation within a scoped in-process lock;
- stores temporary content under service-derived paths rather than client paths;
- produces an expiring private preview URL capped at 15 minutes;
- deletes temporary bytes after media attachment and exposes an expiry cleanup operation.

[`handleUploadEndpoint`](../packages/core/src/fields/upload/endpoint.ts) refuses calls not marked as CSRF verified. Tests cover traversal, spoofed MIME, size limits, cross-tenant access, token failure, denied deletion, concurrent count enforcement, media finalization, and expiry cleanup in [`p6-d-uploads.test.ts`](../packages/core/tests/p6-d-uploads.test.ts).

### Required deployment controls

- Derive upload context from authenticated server scope. Never accept actor, panel, resource, field, or tenant scope directly from the request body.
- Supply an authorization callback that checks panel access, tenant membership, resource policy, record ownership where relevant, field allow-listing, and operation invariants.
- Configure a private Holo Storage disk and verify that its temporary URLs are signed, short-lived, and not cacheable by shared intermediaries.
- Schedule `cleanupExpired()` and monitor failures. The method existing does not schedule itself.
- Keep framework/proxy body limits at or below the configured upload limit and stream large payloads where supported.
- Add content scanning or moderation when the deployment's risk requires it. Signature detection is a MIME check, not malware detection or full media decoding.

## Rich content and browser rendering

### Implemented controls

[`structuralRichTextSanitizer`](../packages/core/src/fields/collections/sanitization.ts) admits a fixed document-node and mark vocabulary. It permits only bounded heading levels and relative, fragment, or credential-free HTTPS links; unsupported nodes, marks, and attributes fail. Markdown serialization escapes `&`, `<`, and `>` and removes NUL bytes. Rich text is stored as sanitized structured JSON rather than executable HTML.

Form paths and schema state paths reject prototype-mutating segments such as `__proto__`, `constructor`, and `prototype`; see [`client/forms/paths.ts`](../packages/client/src/forms/paths.ts) and [`schemas/builder.ts`](../packages/core/src/schemas/builder.ts). Entry URL handling in [`client/entries/safety.ts`](../packages/client/src/entries/safety.ts) rejects unsafe protocols and credential-bearing HTTP(S) URLs.

Evidence: [`p6-c-rich-collections.test.ts`](../packages/core/tests/p6-c-rich-collections.test.ts) and renderer security cases in the React, Vue, and Svelte test directories.

### Required deployment controls

Do not introduce `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, Svelte `{@html}`, or an equivalent raw-HTML path for untrusted values. If an application adds an explicit HTML feature, it must define and test a server-side sanitizer policy and render only that sanitizer's output. A custom editor adapter or renderer is trusted executable code and can bypass presentation safeguards; review it accordingly.

Apply a restrictive Content Security Policy, escape text in application-owned templates, validate external URLs again at navigation time, and add `rel="noopener noreferrer"` when opening an external destination in a new browsing context.

## Notifications

### Implemented controls

[`executePanelDatabaseNotificationOperation`](../packages/core/src/notifications/executor.ts) parses a small operation union, bounds page sizes and offsets, limits mutation batches to 100 canonical IDs, resolves recipient and tenant identity from server callbacks, authorizes every operation, and ignores client attempts to choose scope.

[`PanelNotificationInbox`](../packages/core/src/notifications/inbox.ts) binds queries to recipient type/ID, guard, panel, tenant, and payload version. It filters malformed or cross-scope records and enumerates visible IDs before mutation, so a guessed foreign ID causes the whole mutation to fail instead of partially mutating. Presentations and navigation actions are parsed through fixed types and safe URL rules. The client store revalidates actions, aborts stale requests, coalesces invalidations, and bounds polling intervals and mutation batches.

Evidence: [`p13-database-notification-executor.test.ts`](../packages/core/tests/p13-database-notification-executor.test.ts), [`p13-b-inbox-runtime.test.ts`](../packages/core/tests/p13-b-inbox-runtime.test.ts), [`p13-sqlite-notification-phase-gate.test.ts`](../packages/testing/tests/p13-sqlite-notification-phase-gate.test.ts), and [`client notification tests`](../packages/client/tests/p13-notifications.test.ts).

### Required deployment controls

Recipient, tenant, and realtime identity callbacks must use authenticated scope only. Realtime authorization must protect the server subscription endpoint independently; knowing a channel name is not authorization. Retain and delete notification data according to application policy, rate-limit expensive inbox operations, and ensure external notification URLs meet the application's redirect policy.

## Plugins, generated registries, and custom renderers

### Implemented controls

Core extension IDs use validated namespaces, kinds, and names. [`ExtensionRegistry`](../packages/core/src/plugins/registry.ts) rejects duplicates, requires an existing registration before a panel override, and fails on missing renderers. [`assertPluginCompatible`](../packages/core/src/plugins/compatibility.ts) provides deterministic Panels/protocol version-range validation. Panel plugin installation in [`panels/panel.ts`](../packages/core/src/panels/panel.ts) validates plugin and authorization-layer IDs and freezes the installed shape.

Prepare-time discovery validates project-relative paths, rejects root escapes, and generates fixed import expressions. Relevant sources are [`cli/discovery/compiler.ts`](../packages/cli/src/discovery/compiler.ts), [`cli/discovery/module-loader.ts`](../packages/cli/src/discovery/module-loader.ts), and [`cli/generated/render.ts`](../packages/cli/src/generated/render.ts). Path-escape and module-boundary cases are covered by [`compiler.test.ts`](../packages/cli/tests/discovery/compiler.test.ts) and [`module-loader.test.ts`](../packages/cli/tests/discovery/module-loader.test.ts).

### Trust decision and supply-chain controls

Plugins and custom renderers are not sandboxed. A plugin can execute with the application's server privileges; a client renderer can read data available to its page and make browser requests. Install only reviewed packages, pin versions and integrity through the package manager, review transitive dependencies, and give runtime credentials least privilege.

Preparation enforces plugin compatibility, public renderer exports, package-relative asset/icon containment, stable fingerprints, duplicate/missing renderer rules, and managed-file ownership. The packed money plugin and independently packed all-family example exercise installation against packed Holo Panels packages. Dependency license and vulnerability review is part of the release gate. Package signatures and registry provenance remain deployment and release-pipeline controls rather than a plugin sandbox.

Production must use generated registries. Never add a request-controlled `import()`, filesystem scan, module path, model name, or renderer package path.

## Tenancy

### Implemented controls

[`PanelTenancyRuntime`](../packages/core/src/tenancy/runtime.ts) validates typed tenant IDs, safe single-segment route keys, unique memberships, a membership bound, and per-membership authorization. Invalid or revoked persisted tenants are cleared. Switching resolves from the authorized membership list rather than trusting a tenant ID.

Queued tenant contexts are versioned and bind the exact guard, panel, tenant value, and primitive type. Consumption rechecks the current membership list; stale or foreign contexts fail. Bootstrap presentation in [`tenancy/compiled.ts`](../packages/core/src/tenancy/compiled.ts) emits bounded text and safe avatar URLs rather than tenant objects.

Resource lookup applies base and tenant scopes before ID resolution. Relations scope to owner, tenant, and authorization before related lookup. Global search in [`search/engine.ts`](../packages/core/src/search/engine.ts) filters by fixed guard and panel, authorizes panel/resource/result/page, applies tenant and authorization query scopes before search, bounds terms/results, and constrains result URLs to the panel.

Evidence: [`p14-d-tenancy.test.ts`](../packages/core/tests/p14-d-tenancy.test.ts), [`p9-a-resources.test.ts`](../packages/core/tests/p9-a-resources.test.ts), [`p10-relation-managers.test.ts`](../packages/core/tests/p10-relation-managers.test.ts), and [`p11-navigation-search.test.ts`](../packages/core/tests/p11-navigation-search.test.ts).

### Application duties

Tenant isolation tests cover options, actions, caches, notifications, uploads, jobs, imports, exports, and downloads. Cache identities include panel, actor or authorization scope, tenant including primitive type, locale, and relevant dependencies. Workers resolve queued tenant context against current membership before data access; enqueue-time membership alone is insufficient.

Applications that intentionally share records across tenants need an explicit reviewed query path. Do not disable tenant scoping merely to make a lookup succeed.

## Permissions and Shield

### Implemented controls

The core resource executor invokes Holo Authorization class and record policies. Pages, actions, relation managers, widgets, search resources, notifications, uploads, imports, and exports expose server authorization callbacks appropriate to their current internal contracts.

The optional Shield package implements permission-key validation, role and direct-permission evaluation, tenant-aware grants, cache invalidation, transactional in-memory administration, a Holo DB repository implementation, permission synchronization helpers, and panel plugin installation. [`composeShieldAuthorization`](../packages/shield/src/authorization.ts) defines the intended panel → tenant → Shield → policy → invariant order. Evidence is in [`p14-a-shield.test.ts`](../packages/shield/tests/p14-a-shield.test.ts), [`p14-a-database-repository.test.ts`](../packages/shield/tests/p14-a-database-repository.test.ts), and [`p14-a-plugin.test.ts`](../packages/shield/tests/p14-a-plugin.test.ts).

### Application duties

Role and Permission resources, Shield commands, migrations, and built-in cross-domain denial suites are implemented. An installed authorization layer cannot automatically govern arbitrary application-defined executors, so custom operations must explicitly compose panel access, tenant access, Shield when enabled, Holo policy, and invariants. UI visibility, hidden buttons, navigation omission, disabled controls, and client manifests are not authorization boundaries. Denials for guessed IDs should use not-found-equivalent behavior where disclosure would reveal another tenant's or actor's record.

## Imports, exports, background jobs, and private downloads

### Implemented controls

The public transfer runtime combines the bounded import/export engines with durable Holo services:

- [`imports/csv.ts`](../packages/core/src/imports/csv.ts) enforces UTF-8, byte, row, column, cell, delimiter, header, and record-width limits.
- [`imports/mapping.ts`](../packages/core/src/imports/mapping.ts) allow-lists mappings and rejects unknown, duplicate, and missing required mappings.
- [`imports/executor.ts`](../packages/core/src/imports/executor.ts) rechecks tenant authorization per row and inside the transaction, validates before persistence, distinguishes create/update authorization, binds row idempotency, supports aborts, and sanitizes unexpected row errors.
- [`exports/engine.ts`](../packages/core/src/exports/engine.ts) allow-lists selected columns, authorizes before query creation, applies authorization and tenant scopes before overrides/counting/chunking, bounds row and chunk sizes, orders deterministically, and permits scalar output only.
- [`exports/csv.ts`](../packages/core/src/exports/csv.ts) quotes CSV correctly and escapes formula-capable cells by default.
- [`transfers/lifecycle.ts`](../packages/core/src/transfers/lifecycle.ts) derives actor/panel/tenant scope on the server, binds versioned queue envelopes to exact typed scope, bounds retries, enforces monotonic progress, sanitizes terminal errors, checks cancellation policy, records private artifact metadata without a URL, creates expiring grants, reauthorizes downloads, and identifies retained terminal work for cleanup.
- [`transfers/holo-store.ts`](../packages/core/src/transfers/holo-store.ts) persists operation and outbox transitions through Holo Database transactions, optimistic revisions, and bounded leases.
- [`transfers/holo-queue.ts`](../packages/core/src/transfers/holo-queue.ts) dispatches only the fixed transfer job definition through Holo Queue.
- [`transfers/holo-storage.ts`](../packages/core/src/transfers/holo-storage.ts) requires private Holo Storage, streams bounded chunks, refuses replacement, and verifies exact size and SHA-256 digests.
- [`transfers/parts.ts`](../packages/core/src/transfers/parts.ts) persists bounded canonical parts and streams deterministic CSV or incremental XLSX finalization without buffering a complete export.
- [`transfers/holo-notifier.ts`](../packages/core/src/transfers/holo-notifier.ts) emits deduplicated terminal Holo Notifications from durable outbox records.

Evidence: [`p15-a-csv.test.ts`](../packages/core/tests/p15-a-csv.test.ts), [`p15-a-import-engine.test.ts`](../packages/core/tests/p15-a-import-engine.test.ts), [`p15-b-export-engine.test.ts`](../packages/core/tests/p15-b-export-engine.test.ts), [`p15-transfer-lifecycle.test.ts`](../packages/core/tests/p15-transfer-lifecycle.test.ts), [`p15-driver-contracts.test.ts`](../packages/core/tests/p15-driver-contracts.test.ts), and the three-framework [`p15-transfer-phase-gate.test.ts`](../packages/testing/tests/p15-transfer-phase-gate.test.ts).

### Deployment controls

Run the operation migrations before starting workers. Configure a private Holo Storage disk, a cryptographically strong signing key, bounded queue concurrency, monitored outbox dispatch, and cleanup for terminal records and artifacts. Workers must run with least privilege and recheck current membership and policy before access. Import failure rows can contain personal or secret source values; retain them privately for the shortest operational period, redact where appropriate, and never log them. Never expose a storage key or authorize a download solely by operation ID or token.

## Failure handling

Security-relevant failures should follow these rules:

- Fail closed on missing authentication, invalid scope, unknown operation, malformed envelope, CSRF failure, expired capability, policy denial, or unavailable security dependency.
- Apply scopes before lookup. Prefer an indistinguishable not-found result for foreign, denied, or absent records when identity disclosure is unnecessary.
- Roll back domain mutations when validation, authorization, lifecycle hooks, or persistence fails. Do not report success before durable commit.
- Make retries explicit and idempotent. Reads may retry transient failures; mutations require a durable idempotency design before automatic retry.
- Treat partial import/action results as explicit state. Do not silently retry successful rows or repeat one-time effects.
- Return bounded public error codes and messages. Log a correlation ID server-side, with secrets and personal data redacted.
- Abort stale reads and background work where safe, but do not treat client cancellation as proof that the server mutation did not commit.
- If notification, cleanup, or secondary side effects fail after a primary commit, record recoverable work without leaking internal exceptions to the browser.

## Deployment checklist

### Authentication and authorization

- [ ] Configure the intended Holo Auth guard for every panel.
- [ ] Replace permissive panel access with an explicit production policy.
- [ ] Review `presentActor` as a browser disclosure allow-list.
- [ ] Verify class and record policies for every resource operation.
- [ ] Verify every page, action, relation, notification, upload, search, widget, import, export, cancellation, and download callback fails closed.
- [ ] Do not rely on Shield as universal enforcement until its executor integration is complete.

### Tenancy and data access

- [ ] Derive tenant identity from authenticated server context, never request payloads.
- [ ] Apply tenant and authorization scopes before lookup, count, search, aggregation, relation hydration, import choice, and export override.
- [ ] Include actor/authorization and tenant identity in every cache key.
- [ ] Revalidate queued tenant contexts and current membership in workers.
- [ ] Test guessed IDs, revoked membership, stale active tenants, same ID with different primitive types, and cross-tenant notification/upload/download access.

### HTTP and browser

- [ ] Keep generated fixed panel and operation routes; do not add request-controlled module resolution.
- [ ] Preserve Holo Security CSRF protection for every mutation and upload request.
- [ ] Set proxy and framework request limits no higher than the application can safely parse.
- [ ] Add rate limits for auth, search, options, notifications, uploads, imports, exports, and sensitive actions.
- [ ] Enforce TLS, secure cookies, suitable SameSite policy, HSTS, a restrictive CSP, and clickjacking protection.
- [ ] Validate redirect/download destinations and external-link behavior.

### Storage, uploads, and transfers

- [ ] Use private disks for temporary uploads, exports, and failure rows.
- [ ] Verify signed URL expiry and shared-cache behavior.
- [ ] Run upload and transfer cleanup on a monitored schedule.
- [ ] Add malware scanning or moderation when required by the data classification.
- [ ] Run the durable transfer migrations, workers, outbox dispatcher, private storage, download handler, and cleanup schedule before enabling imports or exports.
- [ ] Use cryptographically random, single-purpose, expiring download capabilities and reauthorize every resolution.

### Plugins and supply chain

- [ ] Install only reviewed plugins and custom renderers.
- [ ] Pin lockfiles, verify package integrity, and run license and vulnerability review.
- [ ] Verify plugin Panels/protocol compatibility explicitly.
- [ ] Run `holo prepare` in a trusted build environment and deploy generated registries without runtime filesystem discovery.
- [ ] Review generated diffs and refuse unowned or unexpectedly modified route artifacts.

### Operations

- [ ] Log authorization denials, rate-limit events, transfer state changes, and cleanup failures with correlation IDs and redaction.
- [ ] Exclude credentials, CSRF values, upload tokens, grant tokens, raw sensitive rows, stack traces, and filesystem paths from logs and responses.
- [ ] Back up and test restoration of authorization, tenant, notification, operation, and artifact metadata.
- [ ] Exercise incident response for leaked upload/download capabilities and compromised plugin dependencies.
- [ ] Run the repository's full validation and packed clean-install acceptance before release.

## Evidence index

The highest-value behavior suites for this threat model are:

- bootstrap and serialization: [`p9-b-pages-panels.test.ts`](../packages/core/tests/p9-b-pages-panels.test.ts), [`protocol.test.ts`](../packages/core/tests/protocol.test.ts);
- transport and adapters: [`core transport.test.ts`](../packages/core/tests/transport.test.ts), [`client transport.test.ts`](../packages/client/tests/transport.test.ts), [`next operation tests`](../packages/next/tests/p9-c-next-adapter.test.tsx), [`nuxt server tests`](../packages/nuxt/tests/p9-d-nuxt-adapter.test.ts), [`sveltekit server tests`](../packages/sveltekit/tests/server.test.ts);
- resources, actions, and relations: [`p9-a-resources.test.ts`](../packages/core/tests/p9-a-resources.test.ts), [`p8-b-actions.test.ts`](../packages/core/tests/p8-b-actions.test.ts), [`p10-relation-managers.test.ts`](../packages/core/tests/p10-relation-managers.test.ts);
- uploads and rich content: [`p6-d-uploads.test.ts`](../packages/core/tests/p6-d-uploads.test.ts), [`p6-c-rich-collections.test.ts`](../packages/core/tests/p6-c-rich-collections.test.ts);
- notifications: [`p13-database-notification-executor.test.ts`](../packages/core/tests/p13-database-notification-executor.test.ts), [`p13-sqlite-notification-phase-gate.test.ts`](../packages/testing/tests/p13-sqlite-notification-phase-gate.test.ts);
- plugins, Shield, and tenancy: [`plugins.test.ts`](../packages/core/tests/plugins.test.ts), [`p14-a-shield.test.ts`](../packages/shield/tests/p14-a-shield.test.ts), [`p14-d-tenancy.test.ts`](../packages/core/tests/p14-d-tenancy.test.ts);
- transfers: [`p15-a-import-engine.test.ts`](../packages/core/tests/p15-a-import-engine.test.ts), [`p15-b-export-engine.test.ts`](../packages/core/tests/p15-b-export-engine.test.ts), [`p15-transfer-lifecycle.test.ts`](../packages/core/tests/p15-transfer-lifecycle.test.ts), [`p15-driver-contracts.test.ts`](../packages/core/tests/p15-driver-contracts.test.ts), and [`p15-transfer-phase-gate.test.ts`](../packages/testing/tests/p15-transfer-phase-gate.test.ts).

Re-run and extend these suites whenever a trust boundary, operation payload, authorization callback, scope key, storage driver, queue driver, renderer, or public API changes.
