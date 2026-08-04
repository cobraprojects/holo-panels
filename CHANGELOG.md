# Changelog

All notable changes to the Holo Panels workspace are recorded here. Holo Panels packages release in lockstep, so one entry applies to the complete `@holo-js/panels` package family.

The project has not published a prerelease. The current workspace version is `0.1.0-next.0`; everything below remains unreleased until the first credentialed registry publication.

This prerelease requires Holo-JS `^0.3.10` and is validated against the published Holo-JS `0.3.10` host release.

## Unreleased

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

### Pending before the first prerelease

- Publish `0.1.0-next.0` for the lockstep package family through the protected CI release workflow.
- Install the published prerelease from the external registry and complete the remaining P17 registry and final release acceptance gates. The local three-framework browser gate passes 30/30 with zero retries.

## Upgrade policy

Follow [Testing, deployment, and upgrades](docs/testing-deployment-upgrades.md) for the current clean-install, validation, generated-artifact, safe-upgrade, and uninstall procedures. Supported-version and security-fix rules are defined in [SECURITY.md](SECURITY.md).
