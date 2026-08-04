# Contributing to Holo Panels

Holo Panels is in its initial bootstrap stage. Contributions must follow the approved architecture and phased implementation sequence in [plans/implementation.md](plans/implementation.md).

## Before starting

1. Read `AGENTS.md` and the relevant plan sections completely.
2. Confirm that prerequisite phase gates are complete.
3. Select unchecked tasks with non-overlapping owned paths.
4. Agree on ownership of shared manifests, workspace configuration, generated formats, and barrel exports before parallel work begins.
5. Obtain explicit approval before changing any user-facing API shown in the plan.

Do not mark work complete merely because code was written. Update plan checkboxes only according to the tracking rules in `AGENTS.md` and the plan.

## Repository scope

Holo Panels implementation belongs in this repository. Generic Holo-JS host capabilities belong in the adjacent Holo-JS repository and require that repository's own instructions, review, validation, and approval process.

Use Holo-JS services rather than recreating them. Holo Panels should compose with Holo database, forms, validation, auth, authorization, notifications, queues, storage, media, broadcast, realtime, security, kernel, core, and framework adapters.

## Development workflow

- Keep each change within a documented task and owned path.
- Add behavior tests and precise type-inference tests with the implementation.
- Run diagnostics, TypeScript typechecking, ESLint, and targeted behavior tests after executable changes.
- Run all phase-wide gates before checking a phase complete.
- Test packed packages in clean fixtures so workspace aliases do not hide publishing defects.
- Use conventional, focused commits that identify the implemented plan task.

When two agents work in parallel, they must own separate directories. The integration owner alone should update shared root configuration, lockfiles, package barrels, generated registry formats, and release metadata.

## API and architecture proposals

If a planned contract is insufficient, stop implementation and propose:

- The exact current and replacement API shapes.
- Why the existing contract cannot satisfy the behavior.
- Type-inference and compatibility effects.
- Security and framework effects.
- Required changes to tests, documentation, and generated output.

Continue only after approval, then update the implementation plan before code relies on the new contract.

## Pull requests

A pull request should state:

- The plan task IDs and checkboxes it completes.
- The behavior delivered.
- Security and authorization boundaries affected.
- Validation commands and results.
- Packed-package or framework acceptance evidence when applicable.
- Remaining limitations or follow-up tasks.

Do not include unrelated cleanup. Do not check acceptance criteria without observed evidence.

## Reporting vulnerabilities

Do not disclose suspected vulnerabilities in a public issue or discussion. Follow [SECURITY.md](SECURITY.md).
