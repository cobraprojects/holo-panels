# Holo Panels agent instructions

These rules apply to every task in this repository. The approved architecture and implementation sequence live in `plans/implementation.md`.

## Product boundary

- Holo Panels is a separate official Holo-JS plugin repository. Do not move its implementation into the Holo-JS repository.
- Use existing Holo-JS services and the existing `holo` CLI. Do not create competing database, auth, authorization, validation, notification, queue, storage, media, realtime, security, router, or CLI systems.
- Changes required in Holo-JS must be implemented and reviewed in the adjacent Holo-JS repository as explicitly identified cross-repository tasks.
- Do not introduce, rename, remove, or reshape a user-facing API without proposing the exact API and obtaining explicit user approval first.
- The fluent APIs, package boundaries, protocol rules, security boundaries, and distribution model in the implementation plan are approved constraints. Do not silently substitute a different architecture.

## Implementation tracking

- `plans/implementation.md` in Holo Panels is the single authoritative checklist for every Holo Panels phase, including cross-repository prerequisites.
- Check a task only after its implementation and all required diagnostics, typecheck, lint, and targeted behavior tests pass.
- For Holo-JS host work, keep the corresponding prerequisite checkbox in the canonical Holo Panels plan and record the Holo-JS commit or pull request evidence there when available.
- Check an acceptance criterion only after observing the stated behavior.
- Check a phase gate only after every task and acceptance criterion in that phase is complete and phase-wide validation passes.
- Mark a Holo Panels phase complete only after all dependencies, including required Holo-JS host work, pass.
- Check the master phase checkbox only after its phase gate is checked.
- Record evidence beside the checkbox or in the associated pull request when completion is not obvious from the source.
- If completed behavior regresses, uncheck the affected item until it is fixed and revalidated.
- Never create, bulk-sync, or maintain a duplicate checklist in Holo-JS.
- Respect phase prerequisites and parallel ownership rules. Agents working concurrently must not edit the same files or shared barrels.

## Engineering principles

1. Security first. Validate all system boundaries and prevent injection, XSS, CSRF, IDOR, unsafe uploads, mass assignment, tenant leakage, and secret exposure.
2. Clean architecture. Keep protocols, server execution, client state, renderers, framework adapters, and integrations separated according to the documented dependency graph.
3. Clean code. Use self-explanatory names, early returns, small focused functions, and no source-code comments. Do not leave compatibility shims or temporary workarounds.
4. Root-cause fixes. Diagnose and correct the underlying problem rather than patching symptoms.
5. Testability. Test externally observable behavior, security boundaries, failure handling, and high-risk domain logic. Do not test implementation structure merely to increase coverage.
6. Maintainability and scalability. Prefer composable capabilities and registries over duplicated methods, giant base classes, or central type switches.

## TypeScript and public API standards

- Enable strict TypeScript, including strict null checks, strict function types, strict bind/call/apply, strict property initialization, unchecked indexed access, implicit-return checks, and fallthrough checks.
- Do not use `any` in public APIs. Do not widen concrete inferred values to `unknown` or `never` to satisfy the checker.
- Use precise generics, conditional types, mapped types, and branded types so model fields, record types, relations, form paths, component states, and resolver contexts remain inferred.
- Use descriptive generic names such as `TRecord`, `TValues`, `TState`, and `TContext`.
- Use inline type imports: `import { type Foo, bar } from './module'`.
- All exported APIs must have explicit or precisely inferred return types.
- Never use `as any`, `@ts-ignore`, or `@ts-nocheck`. Use a documented `@ts-expect-error` only for a genuine upstream type defect.
- Fluent methods must return the concrete `this` type and preserve subtype-specific methods.
- Server callbacks and server-only values must never be serialized into client manifests. Never use `eval` or dynamic source evaluation.

## Code style

- Use single quotes, no semicolons, trailing commas in multiline constructs, and `1tbs` braces.
- Prefer `const`; never use `var`.
- Use strict equality.
- Remove unused imports and variables.
- Do not add comments to executable source. Make code self-documenting through names and structure.
- Keep package exports explicit. Do not import non-exported package internals.
- Centralize shared dependency versions in the root workspace catalog. Internal packages use `workspace:*`.

## Package architecture

- The root package is private. Published packages release in lockstep.
- `panels-core` cannot depend on UI frameworks.
- `panels-client` cannot depend on React, Vue, Svelte, Next.js, Nuxt, or SvelteKit.
- `panels-ui` cannot depend on a framework runtime.
- Renderers contain no database queries, authorization decisions, or persistence.
- Each framework adapter depends only on its matching renderer.
- Shield remains optional and cannot be required by core.
- The umbrella package must not install or bundle all framework adapters.
- Custom fields, columns, entries, filters, actions, widgets, pages, resources, and plugins must use the same registries as built-ins.

## Security boundaries

- UI visibility is not authorization. Re-authorize every operation on the server using panel access, tenant access, Shield permissions when enabled, Holo class or record policies, and operation invariants.
- Apply tenant and authorization scopes before record lookup, relation lookup, search, aggregation, import, export, and reactive option resolution.
- Accept only allow-listed IDs and fields from the client. Client input must never select modules, paths, model names, columns, relations, or arbitrary queries.
- Holo validation is authoritative. Client validation and reactivity are convenience behavior only.
- Treat uploaded files and rich content as hostile. Enforce server-side MIME, extension, size, path, authorization, and sanitization policies.
- Store exports privately and require authorized, expiring downloads.
- Do not expose secrets, hidden model attributes, callbacks, stack traces, or local source paths in production payloads.

## Required validation

After every executable code task:

1. Run language-server diagnostics on every modified executable file.
2. Run the repository's full or appropriately targeted TypeScript typecheck with zero errors.
3. Run ESLint with `--fix` on changed executable files with zero errors.
4. Run the smallest behavior-oriented Vitest suite that proves the change, using `--reporter=json`.

At phase gates, also run full workspace typecheck, lint, tests, architecture validation, package builds, packed-package smoke tests, and affected example application typechecks and acceptance tests.

Coverage is diagnostic evidence, not a target. Do not duplicate scenarios across test layers unless each layer catches a materially different failure. Prefer real integrations at system boundaries and mock only external systems that cannot run safely or deterministically.

For documentation-only changes, validate wording, links, commands, file references, public API names, Markdown structure, and checkbox integrity. Do not run executable checks unless documentation changes accompany code changes or the user explicitly requests them.

## Repository hygiene

- Use `rg` or `rg --files` for discovery.
- Use `apply_patch` for manual file edits.
- Preserve unrelated user changes in a dirty worktree.
- Never use destructive Git or filesystem commands without explicit authorization and validated targets.
- Do not edit generated files manually.
- Generators must preserve user-authored files and refuse ambiguous or unmanaged overwrites.

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues for `cobraprojects/holo-panels`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses the single-context layout. See `docs/agents/domain.md`.
