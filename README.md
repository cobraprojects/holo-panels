# Holo Panels

Holo Panels is the official resource-driven panel plugin for Holo-JS. It is developed in this separate repository, in the same way that Filament is developed separately from Laravel while building on Laravel's services and conventions.

The workspace contains the core runtime, client, UI, framework renderers and adapters, CLI integration, testing helpers, and optional Shield package. The complete `0.1.0-next.0` package family is published on npm with the `next` tag. The corrected `0.1.0-next.1` lockstep candidate is validated locally; Phase P17 remains open until that candidate is published and passes the registry lifecycle.

## Intended integration

Holo Panels is native to Holo-JS:

- Users install the umbrella package `@holo-js/panels` as a Holo plugin.
- Commands are contributed to the existing `holo` CLI; Holo Panels does not introduce a second executable.
- Database access, forms, validation, authentication, authorization, notifications, queues, storage, media, broadcast, realtime, configuration, and security use the corresponding Holo-JS packages.
- Next.js, Nuxt, and SvelteKit support uses separate framework adapters and React, Vue, and Svelte renderers.
- The repository is one workspace monorepo containing multiple focused, independently testable packages released in lockstep.

The complete architecture, phased task breakdown, acceptance criteria, parallel-work rules, and implementation checklist are in [plans/implementation.md](plans/implementation.md).

## Documentation

- [Install Holo Panels](docs/installation.md)
- [Create your first panel](docs/first-panel.md)
- [Theme and customize a panel](docs/theming.md)
- [Packages and public subpaths](docs/package-reference.md)
- [Searchable API reference](docs/api-reference.md)
- [Features and framework integration](docs/features.md)
- [Filament 5 feature parity](docs/filament-5-parity.md)
- [Multiple panels and guards](docs/multiple-panels-and-guards.md)
- [Security architecture](docs/security.md)
- [Threat model](docs/threat-model.md)
- [Testing, deployment, and upgrades](docs/testing-deployment-upgrades.md)
- [Performance benchmarks](benchmarks/README.md)
- [Changelog](CHANGELOG.md)

## Development status

The checkboxes in the implementation plan are the authoritative progress record. A task may be checked only after its implementation and required validation pass. A phase may be checked only after all tasks, acceptance criteria, and the phase gate pass.

Do not infer feature availability from the plan. Until a package or command is implemented, validated, and marked complete, it is proposed behavior rather than a supported API.

## Repository relationship

For local development, place this repository adjacent to Holo-JS:

```text
Code/
├── holo-js/
└── holo-panels/
```

Coordinated host changes belong in the Holo-JS repository. Panel implementation belongs here. Published Holo Panels packages depend on compatible published Holo-JS packages; local linking is only a development workflow.

## CI compatibility pin

Standalone CI checks out Holo-JS beside this repository from the public `cobraprojects/holo-js` repository at immutable commit `15ac56ba94d19b6735d9bc607ef56087ae11a243`, the published `0.3.10` compatibility baseline, and never follows `main` implicitly. Holo Panels accepts compatible Holo-JS `0.3.x` releases from `0.3.10` onward and excludes `0.4.0`.

The pin may be updated only in `.github/workflows/ci.yml` and `scripts/validate-ci-bootstrap.mjs` together, after packed compatibility checks pass for the proposed Holo revision and its package version matches the Holo Panels peer range. A Holo version-range update must also follow `plans/dependency-policy.md`.

The full `bun run validate` CI gate includes the P0-C packed cross-repository acceptance suite against this immutable, published Holo-JS baseline. CI must not follow a floating branch or depend on an unpublished local checkout.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing the project. Report vulnerabilities according to [SECURITY.md](SECURITY.md), not through a public issue.

## License

Holo Panels is open-source software distributed under the [MIT License](LICENSE).
