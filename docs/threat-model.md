# Holo Panels threat model

Status: release-candidate security analysis based on the repository state on 2026-07-29.

This document models the security boundaries and abuse cases of Holo Panels. It distinguishes controls that are implemented and tested from controls that are required by the implementation plan but are pending, internal-only, or not integrated end to end. An unchecked phase in the [implementation plan](../plans/implementation.md#49-phase-p17-documentation-hardening-and-release) is not a production-readiness claim.

The deployment remains responsible for Holo Auth configuration, authorization policies, validation schemas, tenant resolvers, storage and queue drivers, plugin review, secrets, network controls, audit logging, backups, and infrastructure hardening. Plugins and application callbacks are trusted executable code; this model does not attempt to sandbox a malicious dependency or a compromised application server.

## Scope and method

The analysis covers:

- panel bootstrap and manifest projection;
- every current transport operation;
- uploads and media finalization;
- exports, imports, private artifacts, and download grants;
- plugin discovery, generated registries, and custom renderers;
- rich content and browser rendering;
- tenant selection and queued tenant context;
- Holo policies, domain authorization callbacks, and Shield;
- background work, retries, cancellation, cleanup, and failure reporting.

The model assumes an attacker can control all browser input, route parameters, request envelopes, persisted client state, record IDs, selected columns, action names, tenant keys, upload metadata, uploaded bytes, and operation ordering. An attacker may have no session or a valid low-privilege session and may replay, race, cancel, duplicate, or delay requests and jobs. They may guess identifiers, submit malformed or oversized data, and retain expired or revoked capabilities.

## Protected assets

- Actor identity, provider, session, and authorization scope.
- Panel membership and panel-specific access decisions.
- Tenant membership, active-tenant state, and tenant-scoped records.
- Hidden model attributes, server callbacks, secrets, source paths, stack traces, and storage keys.
- Resource records, relations, notifications, uploads, transfer source rows, exports, and failure-row artifacts.
- Role, permission, actor-role, and actor-permission assignments.
- Mutation integrity, idempotency state, job progress, and one-time side effects.
- Generated registries and the fixed mapping from public IDs to trusted modules and renderers.
- Browser integrity against XSS, unsafe navigation, prototype-path mutation, and spreadsheet formula execution.

## Trust boundaries

| Boundary | Untrusted input | Required decision |
|---|---|---|
| Browser → framework route | Cookies, CSRF values, route segments, headers, envelopes, payloads, upload declarations, bytes | Authenticate, validate the fixed route and method, verify CSRF for mutation, bound input, and reject unknown operations. |
| Framework adapter → panel runtime | Panel ID, operation, decoded JSON | Resolve a registered panel, resolve its configured Holo guard, and authorize panel access for this operation. |
| Runtime → domain executor | IDs, fields, filters, actions, relations, tenant selection | Select only registered definitions, validate domain payloads, apply tenant and authorization scopes before lookup, and enforce invariants. |
| Domain executor → Holo services | Queries, mutations, storage paths, queue messages, notification recipients | Preserve transactions, least privilege, private storage, typed scope, and failure isolation. |
| Prepare-time source → generated registry | Application modules, plugin contributions, project paths | Permit only validated project-relative modules and emit a fixed registry; never discover request-selected modules in production. |
| Server manifest → browser renderer | Presented actor, labels, record values, URLs, schema nodes | Serialize data only, exclude callbacks and hidden fields, constrain URLs, and render text safely. |
| Queue producer → worker | Operation ID, actor/panel/tenant scope, chunk, attempt | Validate the versioned envelope, reload durable state, reauthorize current scope, and make processing idempotent. |
| Private storage → download response | Artifact key, operation ID, capability token | Keep storage keys private, validate expiry and exact scope, reauthorize the caller, and stream through an authenticated endpoint. |

## Security invariants

1. Client input never chooses a module, import path, model name, arbitrary relation, query fragment, renderer package, or storage path.
2. Authentication and panel access execute on the server for bootstrap and every operation.
3. Tenant and authorization scopes apply before record lookup, relation lookup, search, aggregation, export counting, or download resolution.
4. UI visibility is presentation only. Sensitive reads and all mutations are reauthorized on the server.
5. Writable fields, pivot fields, export columns, bulk IDs, action names, operations, and renderer types are allow-listed.
6. Holo validation or an explicitly configured server validator is authoritative.
7. Client manifests and public errors contain no functions, secrets, hidden attributes, local paths, stack traces, or database exceptions.
8. Filenames and declared MIME types do not establish trust in uploaded bytes.
9. Plain text is the default. Rich content is structured and sanitized before rendering.
10. Knowing an operation ID, upload ID, notification ID, storage key, realtime channel, or capability token is not sufficient authorization.
11. Background messages bind a versioned actor, panel, and tenant scope and that scope is revalidated when consumed.

## Panel bootstrap

### Threats

- An unauthenticated or wrong-guard actor requests a panel manifest.
- An authenticated actor requests a different panel sharing the same guard and assumes authorization carries across panels.
- `presentActor` exposes password hashes, recovery material, internal flags, or tenant-private fields.
- A builder callback, class instance, unsafe URL, or source path crosses into JSON.
- A notification realtime channel discloses another recipient or injects a reserved channel prefix.

### Implemented controls

[`PanelRuntime`](../packages/core/src/panels/runtime.ts) resolves the guard configured for the selected panel, rejects missing users, runs that panel's access callback for bootstrap and operations, and creates a frozen authenticated scope. Guard resolution is shared during a multi-panel bootstrap, but access is evaluated independently for every panel. Unknown panels, unauthenticated actors, denied access, and non-object actor presentations fail closed.

[`toJsonValue`](../packages/core/src/protocol/serialization.ts) rejects functions, symbols, class instances, cycles, non-finite numbers, and unsafe URL-named values. Page resolution evaluates server-only visibility callbacks before projection rather than serializing them; see [`pages/resolution.ts`](../packages/core/src/pages/resolution.ts). Notification channel disclosure requires list authorization and a bounded stable channel that does not use reserved `private-` or `presence-` prefixes.

Evidence: [`p9-b-pages-panels.test.ts`](../packages/core/tests/p9-b-pages-panels.test.ts), [`protocol.test.ts`](../packages/core/tests/protocol.test.ts), and [`p13-panel-notification-shell.test.ts`](../packages/core/tests/p13-panel-notification-shell.test.ts).

### Residual risk and pending controls

`presentActor` is trusted application code. Serialization can reject non-JSON values but cannot infer which valid scalar fields are secret. Every application must review this projection as a disclosure allow-list. A permissive panel access callback intentionally grants access to its whole authenticated guard.

Repository-wide suites audit generated manifests for callbacks, secrets, hidden attributes, unsafe errors, and local paths. [`SECURITY.md`](../SECURITY.md) defines reporting and supported-version policy. Deployment-wide rate limiting and security-event correlation remain application and infrastructure controls.

## Transport operations

The current operation union is defined in [`panels/contracts.ts`](../packages/core/src/panels/contracts.ts): `action`, `bootstrap`, `form-submit`, `notification`, `options`, `page-data`, `resolver`, `table-data`, and `upload`.

### Common implemented controls

The Next, Nuxt, and SvelteKit adapters use fixed operation allow-lists and fixed configured panel IDs. They reject unsupported methods and unknown operations, bound request bodies to 1 MiB, verify route/envelope panel and operation equality, establish authenticated panel scope, and require Holo Security CSRF verification for mutation POST routes. See [`next/src/operation.ts`](../packages/next/src/operation.ts), [`nuxt/src/server.ts`](../packages/nuxt/src/server.ts), and [`sveltekit/src/server.ts`](../packages/sveltekit/src/server.ts).

[`transport/codec.ts`](../packages/core/src/transport/codec.ts) enforces versioned JSON envelopes, bounded idempotency-key syntax, matching response IDs, known error categories, JSON-safe details, known effects, and safe redirect/download schemes. [`PanelsTransport`](../packages/client/src/transport/panels-transport.ts) uses same-origin credentials, requires a CSRF field, rejects cross-origin endpoint paths, and retries reads rather than arbitrary mutations.

Evidence: [`core transport tests`](../packages/core/tests/transport.test.ts), [`client transport tests`](../packages/client/tests/transport.test.ts), [`Next adapter tests`](../packages/next/tests/p9-c-next-adapter.test.tsx), [`Nuxt adapter tests`](../packages/nuxt/tests/p9-d-nuxt-adapter.test.ts), and [`SvelteKit server tests`](../packages/sveltekit/tests/server.test.ts).

### Operation-by-operation analysis

| Operation | Primary abuse cases | Implemented server control | Remaining obligation |
|---|---|---|---|
| `bootstrap` | Manifest disclosure, actor over-projection, unauthorized panel | Guard resolution, panel access, JSON-safe projection | Review `presentActor`; audit every emitted manifest field. |
| `page-data` | Guess hidden page/path, disclose page records, inject a route path | Fixed page definitions and server visibility/authorization callbacks | Handler must normalize paths, authorize the page, scope its query, and bound returned data. |
| `resolver` | Invoke an unregistered resolver, choose a server callback, exfiltrate derived values | Registry IDs and JSON transport prevent callback serialization | Handler needs an exact resolver allow-list, authorization, payload schema, and output bound. |
| `options` | Enumerate foreign relations, abuse search, poison shared cache | Dependent-option contracts carry explicit identity and abort stale reads | Handler must authorize and tenant-scope before query; cache keys must include actor/authorization scope, panel, tenant, locale, dependencies, and search. |
| `table-data` | Select hidden columns, inject filters/sorts, enumerate foreign rows, unbounded query | Table query executor uses compiled definitions, bounded pagination, and typed filter/sort state | Every custom query/filter must retain authorization and tenant scopes and avoid N+1/unbounded relations. |
| `form-submit` | Mass assignment, validation bypass, stale overwrite, cross-tenant ID | Resource executor allow-lists writable attributes, validates, authorizes class/record operations, scopes before lookup, and uses transactions | Custom persistence and lifecycle hooks must preserve validation, authorization, transaction, and optimistic-concurrency semantics. |
| `action` | Invoke hidden action, forge bulk IDs, replay effects, bypass record policy | Action engine validates mounts, bounds bulk IDs, authorizes each execution, checks optimistic versions, and binds process-local idempotency to actor and tenant | Sensitive actions need rate limits and durable distributed idempotency before automatic mutation retries. |
| `notification` | Read/mutate another recipient's rows, guess IDs, subscribe to a foreign channel | Recipient, guard, panel, tenant, payload-version, ID, and batch scoping; operation authorization | Realtime subscription endpoint needs independent authorization; expensive operations need rate limits and retention policy. |
| `upload` | CSRF, scope swapping, token theft, traversal, MIME spoofing, oversized bytes | CSRF gate plus upload service controls described below | Adapter must derive upload scope from authenticated context and never accept actor or tenant identity from the body. |

Every registered handler remains responsible for its domain payload schema. The generic envelope proves shape and protocol compatibility, not business validity. Imports and exports are not current `PanelOperation` members and have no supported framework route.

Unexpected failures must map to bounded public error codes and messages. Production responses must not contain caught exception text, database messages, stack traces, filesystem paths, credentials, upload tokens, or download capabilities.

## Uploads and media

### Threats

- Path traversal or storage-key selection through a filename or identifier.
- Declared MIME or extension spoofing, polyglot content, decompression bombs, or malware.
- Cross-actor, cross-resource, cross-field, or cross-tenant read/delete/finalize.
- Upload-token guessing, replay, theft, or logging.
- Size/count races and abandoned temporary data.
- Public preview URLs that outlive authorization.

### Implemented controls

[`defineUploadPolicy`](../packages/core/src/fields/upload/policy.ts) validates extension, MIME, size, count, expiry, disk, conversion, and safe relative-directory configuration. [`TemporaryUploadService`](../packages/core/src/fields/upload/service.ts) normalizes filenames; rejects separators and NUL bytes; derives storage paths; generates a random token by default; stores its SHA-256 hash; uses timing-safe comparison; and binds metadata to actor, panel, resource, field, and optional tenant.

Create, write, preview, delete, and finalize are individually reauthorized. Write verifies exact authorized byte size and detected signature MIME against the declaration and policy. Count enforcement is serialized per scope inside the process. Private preview expiry is capped, successful media finalization removes temporary data, and expired objects can be cleaned. [`handleUploadEndpoint`](../packages/core/src/fields/upload/endpoint.ts) rejects requests not marked CSRF verified.

Evidence: [`p6-d-uploads.test.ts`](../packages/core/tests/p6-d-uploads.test.ts) covers traversal, MIME spoofing, size and count limits, token failure, cross-tenant access, deletion denial, finalization, private previews, and cleanup. [`p6-d-upload-store.test.ts`](../packages/client/tests/p6-d-upload-store.test.ts) covers client cancellation and queue behavior.

### Residual risk and deployment controls

The endpoint caller must derive actor/panel/resource/field/tenant context from authenticated server state. Upload tokens are capabilities and must be redacted from logs. In-process count locks do not coordinate multiple workers. MIME signature recognition is not malware scanning or safe media decoding. Schedule and monitor `cleanupExpired()`, enforce compatible proxy limits, use private storage, and add scanning/moderation appropriate to the data classification.

## Rich content and rendering

### Threats

- Stored or reflected XSS through HTML, Markdown, labels, record values, URLs, or a custom component.
- Unsafe protocols, credential-bearing external URLs, reverse-tabnabbing, or redirect abuse.
- Prototype pollution through form/schema paths.
- A malicious custom renderer bypassing safe presentation primitives.

### Implemented controls

[`structuralRichTextSanitizer`](../packages/core/src/fields/collections/sanitization.ts) accepts a fixed document-node and mark vocabulary, bounded headings, and relative, fragment, or credential-free HTTPS links. Unsupported nodes, marks, and attributes fail. Markdown output escapes `&`, `<`, and `>` and strips NUL bytes. Rich text is represented as sanitized structured JSON rather than executable HTML.

Form and schema paths reject `__proto__`, `constructor`, and `prototype`; see [`client/forms/paths.ts`](../packages/client/src/forms/paths.ts) and [`schemas/builder.ts`](../packages/core/src/schemas/builder.ts). Entry URL validation in [`client/entries/safety.ts`](../packages/client/src/entries/safety.ts) rejects unsafe schemes and credential-bearing HTTP(S) URLs.

Evidence: [`p6-c-rich-collections.test.ts`](../packages/core/tests/p6-c-rich-collections.test.ts) and the framework renderer test directories: [`React`](../packages/react/tests), [`Vue`](../packages/vue/tests), and [`Svelte`](../packages/svelte/tests).

### Residual risk and deployment controls

Custom renderers are trusted browser code and can bypass these controls. Do not add raw `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, Svelte `{@html}`, or an equivalent path for untrusted values. Any explicit HTML feature needs a server-side sanitizer contract and behavior tests. Deploy a restrictive Content Security Policy, validate navigation targets at use time, and use `noopener noreferrer` for new browsing contexts.

## Plugins and generated registries

### Threats

- Request-controlled module resolution or production filesystem scanning.
- Discovery path escape outside the application project.
- Duplicate type registration, missing/mismatched renderer, or protocol incompatibility.
- Plugin assets resolving outside their package.
- Supply-chain compromise or malicious server/client plugin code.
- Generated route or registry files overwriting unowned application files.

### Implemented controls

[`ExtensionRegistry`](../packages/core/src/plugins/registry.ts) uses validated extension IDs, rejects duplicates, requires an existing registration before panel overrides, and fails on missing renderers. [`assertPluginCompatible`](../packages/core/src/plugins/compatibility.ts) validates declared Panels and protocol ranges. Panel plugin installation validates plugin and authorization-layer IDs and freezes installed definitions in [`panels/panel.ts`](../packages/core/src/panels/panel.ts).

Prepare-time discovery validates project-relative paths, rejects root escapes, and emits fixed imports. See [`discovery/compiler.ts`](../packages/cli/src/discovery/compiler.ts), [`discovery/module-loader.ts`](../packages/cli/src/discovery/module-loader.ts), and [`generated/render.ts`](../packages/cli/src/generated/render.ts). Evidence includes [`compiler.test.ts`](../packages/cli/tests/discovery/compiler.test.ts), [`module-loader.test.ts`](../packages/cli/tests/discovery/module-loader.test.ts), and [`plugins.test.ts`](../packages/core/tests/plugins.test.ts).

### Residual risk and supply-chain controls

Plugins are not sandboxed. A server plugin has application privileges and a renderer can read its page data and issue browser requests. Install reviewed packages only, pin dependency integrity, and run prepare in a trusted build environment.

Preparation enforces compatibility, public renderer exports, package-relative asset/icon containment, deterministic fingerprints, duplicate/missing renderer rules, and managed-file ownership. Safe diff-based UI synchronization, packed sample-plugin contracts, and dependency license/vulnerability review are part of the validated release gate. Registry provenance and signature policy remain release-pipeline controls. Production must never add request-controlled `import()`, paths, model names, or renderer package names.

## Tenancy

### Threats

- IDOR by changing a tenant route, request value, relation ID, notification ID, or transfer ID.
- Stale persisted tenant selection after membership revocation.
- Confusing string and numeric IDs with the same textual representation.
- Cross-tenant cache reuse.
- Queue execution under enqueue-time membership after access is revoked.
- Querying by ID before tenant scope and revealing existence through error differences.

### Implemented controls

[`PanelTenancyRuntime`](../packages/core/src/tenancy/runtime.ts) validates typed tenant IDs, safe single-segment route keys, unique bounded memberships, and authorization for every membership. Active state is matched against the current authorized membership list and invalid or revoked values are cleared. Switching resolves a route key from authorized memberships instead of trusting a client tenant ID.

Queued tenant contexts are versioned and bind guard, panel, exact tenant value, and primitive type. Resolution validates the envelope against authenticated panel scope and reloads current authorized memberships. [`tenancy/compiled.ts`](../packages/core/src/tenancy/compiled.ts) projects bounded presentation rather than tenant objects.

Resource and relation executors apply tenant and authorization scopes before ID lookup. Global search limits results to the fixed guard/panel, applies tenant and authorization query scopes, and constrains returned URLs to the panel.

Evidence: [`p14-d-tenancy.test.ts`](../packages/core/tests/p14-d-tenancy.test.ts), [`p9-a-resources.test.ts`](../packages/core/tests/p9-a-resources.test.ts), [`p10-relation-managers.test.ts`](../packages/core/tests/p10-relation-managers.test.ts), and [`p11-navigation-search.test.ts`](../packages/core/tests/p11-navigation-search.test.ts).

### Residual risk and deployment controls

Tenant isolation suites cover options, actions, cache identities, notifications, uploads, jobs, imports, exports, and downloads. Cache identities include actor or authorization scope, panel, tenant including primitive type, locale, and relevant dependencies. Workers resolve queued tenant context against current membership before data access. Shared cross-tenant records need an explicit reviewed `.shared()` declaration and query path, not disabled scoping.

## Permissions and Shield

### Threats

- Treating a hidden button or navigation item as authorization.
- Checking a class policy but not a record policy, or authorizing after lookup.
- Permission-key confusion, duplicate grants, tenant-insensitive role reuse, or stale cached grants.
- Partial authorization where a plugin layer is installed but an executor bypasses it.
- Privilege escalation through role/permission administration or destructive synchronization.

### Implemented controls

The resource executor invokes Holo class and record policies, applies scopes before lookup, and allow-lists writable fields. Pages, actions, relations, widgets, search, notifications, uploads, and the public transfer runtime expose server authorization decisions appropriate to their contracts.

Shield validates permission keys and actor/tenant identities, evaluates role and direct grants, supports tenant-aware grants and cache invalidation, and provides transactional in-memory and Holo DB repository primitives. [`composeShieldAuthorization`](../packages/shield/src/authorization.ts) specifies panel → tenant → Shield → Holo policy → invariant ordering. The database schema uses relational uniqueness and foreign-key cascades; see [`database/migration.ts`](../packages/shield/src/database/migration.ts).

Evidence: [`p14-a-shield.test.ts`](../packages/shield/tests/p14-a-shield.test.ts), [`p14-a-database-repository.test.ts`](../packages/shield/tests/p14-a-database-repository.test.ts), [`p14-a-plugin.test.ts`](../packages/shield/tests/p14-a-plugin.test.ts), and [`p14-b-commands.test.ts`](../packages/shield/tests/p14-b-commands.test.ts).

### Residual risk and deployment controls

Role and Permission administration resources, host commands, migration distribution, and cross-domain denial suites are implemented. Built-in operations compose the approved authorization decisions, but an installed layer cannot automatically govern arbitrary application-defined executors. Custom operations must explicitly compose panel access, tenant access, Shield when enabled, Holo policy, and invariants, and must fail closed. A deployment-wide operational audit trail remains application-owned. Use not-found-equivalent behavior where distinguishing a denied object from an absent object would disclose another actor's or tenant's data.

## Imports, exports, private downloads, and background jobs

### Threats

- CSV parser resource exhaustion, invalid UTF-8, ambiguous headers, or malformed row width.
- Import mapping to hidden/mass-assignable fields, cross-tenant relationship resolution, replayed rows, or sensitive failure-row leakage.
- Exporting hidden columns, overriding a scoped query, formula injection, unbounded row count, or N+1 relations.
- Forged/stale job envelopes, scope changes after enqueue, duplicate chunks, retry storms, cancellation races, or partial commits.
- Guessing an operation ID, download token, or storage key; serving a public artifact after authorization changes.
- Stack traces, source rows, storage keys, or secrets in progress/failure responses and logs.

### Implemented controls

The public transfer runtime combines bounded import/export engines with durable Holo services:

- [`imports/csv.ts`](../packages/core/src/imports/csv.ts) enforces UTF-8, bytes, rows, columns, cells, delimiters, headers, and record-width bounds.
- [`imports/mapping.ts`](../packages/core/src/imports/mapping.ts) allow-lists mappings and rejects unknown, duplicate, and missing required mappings.
- [`imports/executor.ts`](../packages/core/src/imports/executor.ts) rechecks tenant authorization per row and in the transaction, validates before persistence, distinguishes create/update authorization, binds row idempotency, handles aborts, and sanitizes unexpected errors.
- [`exports/engine.ts`](../packages/core/src/exports/engine.ts) allow-lists selected columns, authorizes before query creation, applies authorization and tenant scopes before overrides/counting/chunking, bounds rows and chunks, orders deterministically, and permits scalar output only.
- [`exports/csv.ts`](../packages/core/src/exports/csv.ts) quotes CSV and neutralizes formula-capable cells by default.
- [`transfers/lifecycle.ts`](../packages/core/src/transfers/lifecycle.ts) derives typed actor/panel/tenant scope on the server, validates versioned queue envelopes, bounds chunk retries, requires monotonic progress, sanitizes terminal errors, authorizes cancellation, records private artifact metadata without a URL, creates expiring grants, reauthorizes download, and identifies terminal work eligible for cleanup.
- [`transfers/holo-store.ts`](../packages/core/src/transfers/holo-store.ts) persists atomic operation/outbox transitions through Holo Database revisions and bounded leases.
- [`transfers/holo-queue.ts`](../packages/core/src/transfers/holo-queue.ts) dispatches only fixed transfer job definitions through Holo Queue.
- [`transfers/holo-storage.ts`](../packages/core/src/transfers/holo-storage.ts) requires private Holo Storage, streams bounded chunks, refuses replacement, and verifies exact size and SHA-256 digests.
- [`transfers/parts.ts`](../packages/core/src/transfers/parts.ts) writes bounded canonical parts and streams deterministic CSV or incremental XLSX finalization.
- [`transfers/holo-notifier.ts`](../packages/core/src/transfers/holo-notifier.ts) emits deduplicated terminal Holo Notifications from durable outbox records.

Evidence: [`p15-a-csv.test.ts`](../packages/core/tests/p15-a-csv.test.ts), [`p15-a-import-engine.test.ts`](../packages/core/tests/p15-a-import-engine.test.ts), [`p15-b-export-engine.test.ts`](../packages/core/tests/p15-b-export-engine.test.ts), [`p15-transfer-lifecycle.test.ts`](../packages/core/tests/p15-transfer-lifecycle.test.ts), [`p15-driver-contracts.test.ts`](../packages/core/tests/p15-driver-contracts.test.ts), and [`p15-transfer-phase-gate.test.ts`](../packages/testing/tests/p15-transfer-phase-gate.test.ts).

### Residual risk and deployment controls

Import failure results can contain personal data or secrets from source rows. Store them privately, encrypt at rest where required, authorize every download, redact where appropriate, and retain them only for the shortest operational period.

Production enablement requires running the operation migrations, Holo Queue workers, outbox dispatch, private Holo Storage, authenticated download handler, and monitored cleanup. Signing keys and generated IDs must be cryptographically strong. Workers need least privilege, current membership and policy rechecks, bounded concurrency, and idempotent commits. Never expose a storage key or authorize solely from an operation ID or token.

## Abuse-case register

| ID | Scenario | Present mitigation | Release status |
|---|---|---|---|
| TM-01 | Low-privilege actor bootstraps another panel | Guard plus per-panel access callback | Implemented and tested |
| TM-02 | Actor projection leaks a valid JSON secret | Application-owned projection allow-list plus generated-manifest audits | Implemented repository audit; application projection review required |
| TM-03 | Client selects an arbitrary operation/module | Fixed operation and generated registries | Implemented and tested |
| TM-04 | Mutation is replayed across workers | Durable transfer revisions/outbox/idempotency; action keys bind actor and tenant | Implemented for transfers; custom distributed actions choose a durable idempotency store |
| TM-05 | Guessed record/relation ID crosses tenant | Scope before lookup and record authorization | Implemented and covered by cross-domain tenant suites |
| TM-06 | Upload filename escapes storage root | Normalized filename and service-derived path | Implemented and tested |
| TM-07 | Upload bytes spoof declared MIME | Exact size plus signature MIME check | Implemented; malware/media scanning is deployment-specific |
| TM-08 | Rich content executes script | Structural sanitizer and no raw-HTML contract | Implemented for built-ins; custom renderers remain trusted |
| TM-09 | Plugin loads request-selected source | Prepare-time fixed imports, compatibility, package path validation, and managed assets | Implemented; registry provenance remains a release-pipeline control |
| TM-10 | Revoked tenant job still executes | Versioned queued context and transfer workers re-resolve current membership | Implemented and tested |
| TM-11 | Shield UI visibility substitutes for permission | Server authorization composition and domain denial suites | Implemented built-in composition; custom executors must compose explicitly |
| TM-12 | Export includes hidden/formula-capable values | Column allow-list, scoped planning, and formula neutralization | Implemented end to end |
| TM-13 | Download token reveals public storage key | Durable private artifact metadata, signed grant, scope reauthorization, and streaming | Implemented; deployment must protect signing keys and private storage |
| TM-14 | Failure leaks stack, path, or source row | Generic error sanitization | Primitive implemented; centralized logging/redaction pending |
| TM-15 | Oversized search/options/transfer exhausts resources | Bounded engines, request/response ceilings, and 100k-row performance benchmarks | Repository audit complete; deployment rate limits remain required |

## Release security verification

Before release, evidence must show:

- bootstrap manifests contain no secrets, hidden model fields, callbacks, source paths, or unexpected URLs;
- each operation rejects unknown panels, operations, malformed envelopes, oversized input, invalid CSRF, unauthenticated actors, and denied panel access;
- each domain executor validates an exact payload schema and scopes before lookup;
- uploads reject cross-scope access, traversal, size/count races, token failure, MIME spoofing, and expired capabilities using the deployment's actual storage driver;
- built-in renderers do not use unsafe raw-HTML paths for untrusted data and external navigation follows policy;
- production registry generation rejects path escapes, duplicates, missing renderers, incompatible plugins, and unowned generated-file changes;
- tenant revocation invalidates active selection, caches, queued work, notifications, uploads, imports, exports, and downloads;
- every permission-bearing operation invokes panel, tenant, Shield when enabled, Holo policy, and invariant checks in the approved order;
- transfer state and idempotency survive restart and competing workers; private downloads are expired, scope-bound, reauthorized, and cleaned;
- authorization denial, throttling, job transitions, and cleanup failures are auditable through correlation IDs without logging credentials, CSRF values, tokens, storage keys, source rows, stacks, or paths;
- dependency license/vulnerability review, performance bounds, packed clean-install tests, and all three framework acceptance suites pass.

The broader deployment checklist and security control summary are in [`security.md`](security.md). Re-run this analysis whenever an operation, public payload, authorization layer, cache identity, storage/queue driver, plugin contribution, renderer, or trust boundary changes.
