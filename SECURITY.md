# Security policy

Security issues in Holo Panels should be reported privately. This policy explains what to report, how maintainers handle a report, which versions are eligible for fixes, and how coordinated disclosure works.

Holo Panels `0.1.0-next.0` is an experimental published prerelease. It has no stable release or production-support commitment. Under the prerelease policy below, only the newest published prerelease is eligible for security fixes.

## Reporting a vulnerability

Do not open a public issue, discussion, pull request, or test fixture containing vulnerability details.

Use the repository host's private vulnerability-reporting feature when it is available. On GitHub this appears as **Security → Report a vulnerability**. If the repository does not offer a private reporting form, contact a Holo-JS maintainer through an already published private contact channel and state that the report concerns Holo Panels. Do not guess email addresses or send vulnerability details through an unrelated public channel.

Do not include live credentials, authentication cookies, CSRF values, upload or download capabilities, production personal data, private database rows, or unnecessary customer information. Use a local fixture and redact sensitive values.

A useful report contains:

- the affected Holo Panels package, version or commit, and public API or route;
- the Holo-JS version or commit and the framework/runtime versions involved;
- a minimal reproduction or precise reproduction steps;
- the expected boundary and the observed behavior;
- required privileges, tenant or actor relationships, and user interaction;
- practical confidentiality, integrity, and availability impact;
- whether the behavior works against the current repository state;
- any safe temporary mitigation;
- the reporter's preferred name or anonymity for credit.

If a report cannot safely include a working exploit, describe the controllable input, trust-boundary crossing, and resulting capability. A scanner result without a reachable vulnerable path is still useful context, but maintainers will need evidence that the affected code is included or executable in Holo Panels.

## What to expect after reporting

Maintainers follow these stages:

1. Confirm receipt through the private channel when a maintainer is available.
2. Reproduce the issue and identify the affected Holo Panels, Holo-JS, framework, and deployment versions.
3. Assess severity from demonstrated impact, prerequisites, scope, and available mitigations.
4. Decide whether the fix belongs in this repository, the adjacent Holo-JS repository, an upstream dependency, or more than one project.
5. Prepare tests, a fix, release notes or an advisory, and upgrade/mitigation guidance as appropriate.
6. Coordinate publication with the reporter and affected upstream maintainers when practical.

This is a process expectation, not a guaranteed acknowledgement, remediation, release, or disclosure deadline. The project is prerelease and does not promise a response-time SLA. Reporters may ask for status through the original private channel. Duplicate, non-reproducible, or out-of-scope reports may be closed with a concise explanation.

Maintainers will not ask a reporter to access data they do not own, degrade a third-party service, persist after confirming impact, or disclose secrets. Testing must remain within systems and accounts the reporter is authorized to use.

## Scope

The policy covers source maintained in this repository and the published package family under `packages/`:

- `@holo-js/panels`
- `@holo-js/panels-core`
- `@holo-js/panels-client`
- `@holo-js/panels-ui`
- `@holo-js/panels-react`
- `@holo-js/panels-vue`
- `@holo-js/panels-svelte`
- `@holo-js/panels-next`
- `@holo-js/panels-nuxt`
- `@holo-js/panels-sveltekit`
- `@holo-js/panels-cli`
- `@holo-js/panels-shield`
- `@holo-js/panels-testing`
- `@holo-js/panels-plugin-money`

Security-sensitive areas include:

- authentication, sessions, panel access, and actor presentation;
- class, record, relation, action, bulk-operation, and download authorization;
- Shield permissions, role administration, and tenant isolation;
- CSRF, throttling, idempotency, request parsing, and error disclosure;
- client manifests, hidden attributes, resolver execution, and cache identity;
- uploads, temporary storage, media finalization, path containment, and capability expiry;
- imports, exports, CSV formula neutralization, private artifacts, queues, and cleanup;
- rich-content sanitization, safe URLs, redirects, and framework rendering;
- notifications, realtime channel authorization, generated registries, plugin discovery, and managed files;
- package installation, dependency boundaries, release tooling, and packed artifacts.

The detailed trust boundaries and known pending controls are documented in the [security model](docs/security.md) and [threat model](docs/threat-model.md).

### Cross-repository and upstream issues

Holo Panels reuses Holo-JS authentication, authorization, database, security, queue, storage, media, notification, and framework-adapter services. Report an issue here when Holo Panels misuses those services, weakens their boundary, exposes an unsafe integration, or requires a coordinated fix. A vulnerability entirely inside a Holo-JS service should use Holo-JS's private security-reporting process. Maintainers should coordinate privately when ownership is unclear rather than asking the reporter to publish the issue twice.

Vulnerabilities entirely inside Next.js, Nuxt, SvelteKit, React, Vue, Svelte, Bun, Node.js, or another third-party dependency should normally be reported to that upstream project. Report the Holo Panels impact privately as well when the vulnerable path is reachable through the supported package or requires a Panels mitigation, version constraint, or advisory.

Application-specific policy mistakes, exposed deployment credentials, insecure reverse proxies, and malicious application plugins are outside the maintained package boundary. They may still reveal a missing safe default or documentation defect; report that product-level impact privately when it is reproducible in the supported integration.

## Supported versions

All publishable Holo Panels packages release in lockstep. An application must not mix package-family versions. The exact package and peer compatibility rules are documented in [Testing, deployment, and upgrades](docs/testing-deployment-upgrades.md#lockstep-versions-and-releases) and the [dependency policy](plans/dependency-policy.md).

| Holo Panels line | Holo-JS compatibility evidence | Security status |
|---|---|---|
| Published `0.1.0-next.0` | Packed minimum-version compatibility against Holo-JS `0.3.10` at commit `15ac56ba94d19b6735d9bc607ef56087ae11a243`; clean registry lifecycle against Holo-JS `0.3.11` at commit `0d074287272b769cda83fe4886c2127c96c9c529` | Newest experimental prerelease; eligible under the prerelease policy below, with no stable-release SLA |
| Stable release | None | No stable support line exists |

The workspace catalog declares Holo-JS peers as `>=0.3.9`, so Panels does not require a peer-range edit for each Holo-JS patch, minor, or major release. Holo-JS `0.3.9` was never published; packed minimum-version evidence therefore starts with the first available satisfying release, `0.3.10`, while registry installation and lifecycle evidence covers `0.3.11` at the immutable commits above. The open-ended peer range permits installation of later stable Holo-JS versions; release validation still identifies the concrete versions exercised for each Panels release.

The `0.1.0-next.0` prerelease must not be treated as a stable or long-lived security branch. Source checkouts are moving development targets; reports should name a commit.

## Prerelease support policy

When a prerelease is published, it remains experimental. Unless its release notes state a different window:

- only the newest published Holo Panels prerelease is eligible for security fixes;
- every package in the Holo Panels family must be upgraded to the same fixed version;
- fixes may require upgrading Holo-JS, a framework adapter, or another peer dependency;
- APIs and migration steps may change between prereleases;
- an older prerelease reaches end of support when a newer prerelease supersedes it;
- no prerelease receives a guaranteed maintenance duration or response-time SLA.

Publishing a prerelease does not make incomplete features production-ready. Its release notes and the [feature status page](docs/features.md) define which public surfaces are included. Internal or proposal-only modules are not supported merely because their source exists.

Before the first stable release, maintainers must replace this prerelease-only rule with an explicit stable support window. No stable long-term-support or previous-major support commitment exists today.

## Backports and end of support

Security fixes target the newest eligible release line. Backports to an older or end-of-support prerelease are discretionary and will occur only when maintainers explicitly announce them in an advisory or release note. Severity alone does not create an undocumented backport promise.

An end-of-support version may remain downloadable, but it is not eligible for fixes, compatibility testing, or security guidance beyond upgrading to a supported fixed version. If an immediate upgrade is impractical, an advisory may provide a temporary mitigation; that mitigation does not extend the version's support lifetime.

If a vulnerability affects both Holo Panels and Holo-JS, the supported fixed combination is the combination named in the advisory. Upgrading only one side is insufficient unless the advisory explicitly says so.

## Coordinated disclosure

Keep vulnerability details private until maintainers and relevant upstream projects have had a reasonable opportunity to assess impact and prepare a fix or mitigation. Maintainers will coordinate a disclosure date when practical, but cannot promise that every issue will receive a CVE, advisory, embargo period, or simultaneous upstream release.

A public disclosure should identify:

- affected and fixed package versions;
- compatible Holo-JS/framework versions when relevant;
- impact, prerequisites, and severity rationale;
- upgrade instructions and any temporary mitigation;
- migration, key/token rotation, cleanup, or incident-review steps when required;
- reporter credit when requested and appropriate.

Advisories should not publish live secrets, personal data, private storage keys, usable capability tokens, or exploit detail beyond what users need to assess and remediate risk. When exploitation may have occurred, disclosure guidance should include affected logs/data to review without claiming that absence of a log event proves absence of compromise.

## Security design and release evidence

UI visibility is never authorization. Every sensitive read and mutation must be independently authenticated, tenant-scoped, authorized, validated, and bounded on the server. Private identifiers and capability values are not authorization by themselves.

Repository security documentation:

- [Security controls and deployment checklist](docs/security.md)
- [Threat model and abuse-case register](docs/threat-model.md)
- [Feature availability and pending controls](docs/features.md)
- [Testing, deployment, and upgrades](docs/testing-deployment-upgrades.md)
- [Package and public-subpath reference](docs/package-reference.md)

A release is not considered supported merely because packages build. Its declared validation and packed-install gates, compatible dependency lines, migration guidance, and security status must be published together.
