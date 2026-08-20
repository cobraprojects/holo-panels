# Changelog

All notable changes to the Holo Panels workspace are recorded here. Holo Panels packages release in lockstep, so one entry applies to the complete `@holo-js/panels` package family.

The newest published prerelease is `0.1.0-next.0`. All 21 packages are available from npm with the `next` tag.

This prerelease accepts every stable Holo-JS version at or above `0.3.9`. Holo-JS `0.3.9` was not published, so packed minimum-version compatibility is validated against Holo-JS `0.3.10`, and the clean registry lifecycle is validated against published Holo-JS `0.3.11`.

## 0.1.0-next.1 - Unreleased

### Added

- Filament-shaped per-panel providers covering routing, authentication, branding, layout, navigation, resources, global search, notifications, tenancy, runtime behavior, errors, assets, plugins, and render hooks.
- Inferred resource schemas whose form fields, table columns, infolist entries, relation paths, and dot notation derive from Holo model metadata without application-authored helper types.
- Filament-style resource and relation-manager classes with protected `model` and `relationship` properties, host-scoped component factories, reusable actions, and generated type bindings for prepare, build, and live development.
- Isolated shadcn-family React, Vue, and Svelte panel interfaces with light, dark, and system modes, configurable panel colors, responsive navigation, user menus, actions, bulk actions, filters, pagination, search, notifications, and theme overrides.

### Changed

- Example applications now use only final public panel providers and inferred resource APIs; internal registries, routes, auth pages, and framework wiring are generated managed artifacts.
- Resource and relation-manager generators now emit the final class API with normal imports and no bound base classes, destructured component aliases, explicit record types, or repeated model columns.
- Next.js, Nuxt, and SvelteKit preparation respects each framework's configured application, page, route, and server directories as well as panel-specific paths and login routes.
- Absent Holo model policies allow resource access after panel and tenant checks; explicit policies and optional Shield permissions remain authoritative when configured.
- Adopted an intentionally quieter visual baseline while preserving the public theming boundary: `PanelBuilder` appearance methods, semantic `--holo-*` variables, `--hp-*` palette aliases, and renderer-emitted `hp-*` and `data-slot` hooks.

### Fixed

- Replaced encoded or internal application route directories with framework-native managed routes rooted at `holo` endpoints.
- Prevented Nuxt parent auth pages from shadowing nested profile, MFA, and recovery-code routes by generating convention-correct index pages.
- Fixed SvelteKit login and MFA submissions during hydration by reading submitted form values directly.
- Rehydrated model-backed tenant actors before persistence so tenant switching behaves identically across all framework session adapters.
- Added resource-widget table query context and completed cross-framework MFA enrollment, recovery challenge, and disable behavior.

### Validation

- All 21 package builds and strict typechecks, 412 behavior suites with 1,036 tests, ESLint, architecture and dependency validation, exact 161-topic Filament parity, coverage diagnostics, packed independent consumers, packed plugin consumers, and packed P0-C lifecycles pass.
- All 60 production-browser journeys pass across Next.js, Nuxt, and SvelteKit.
- Registry validation remains pending until this lockstep candidate is published; the older `0.1.0-next.0` registry package does not contain the fingerprinted plugin stylesheet behavior added by this release.

## 0.1.0-next.0 - 2026-08-04

### Added

- The Holo plugin, project preparation, discovery, generated registries, installer, generators, and uninstall lifecycle.
- Framework-neutral panel, schema, form, table, infolist, action, resource, relation, navigation, search, widget, notification, tenancy, and plugin foundations.
- React, Vue, and Svelte renderers with Next.js, Nuxt, and SvelteKit adapters.
- The optional Shield authorization package and database-backed permission storage foundations.
- Cross-framework contract and acceptance helpers in `@holo-js/panels-testing`.
- Installation, first-panel, feature, package, security, threat-model, multiple-panel, deployment, upgrade, and benchmark documentation.
- Registry-backed release acceptance for clean Next.js, Nuxt, and SvelteKit applications.
- The canonical MIT license in the repository and every published package artifact.

### Security

- Server-only callbacks and values are excluded from client manifests.
- Resource serialization removes hidden model attributes.
- Transport, uploads, rich content, notifications, tenant contexts, import/export primitives, and private transfer artifacts enforce bounded and scoped inputs.
- Resolver batches are capped at 100 requests, duplicate bootstrap panel IDs fail before authentication work, and global-search adapters cannot exceed their requested record limit.
- Patched dependency overrides remove all advisories reported by `bun audit` as of 2026-07-28.

### Changed

- The adjacent Holo-JS development dependency includes the approved project-preparation, notification/session, and multi-factor authentication host capabilities required by the current workspace.
- Example manifests now centralize esbuild through the workspace catalog while preserving generated-scaffold parity.

### Release evidence

- The protected release workflow published the complete 14-package family with the `next` tag.
- Clean external-registry Next.js, Nuxt, and SvelteKit applications passed plugin installation, activation, preparation, generation, adapter selection, Shield, idempotency, and safe uninstall with Holo-JS `0.3.11`.
- The production browser acceptance gate passes 30/30 with zero retries.

## Upgrade policy

Follow [Testing, deployment, and upgrades](docs/testing-deployment-upgrades.md) for the current clean-install, validation, generated-artifact, safe-upgrade, and uninstall procedures. Supported-version and security-fix rules are defined in [SECURITY.md](SECURITY.md).
