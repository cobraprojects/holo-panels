# P17 example and browser-journey closure audit

Original audit date: 2026-07-28

Closure date: 2026-07-29

Status: resolved. This document records closure evidence for the four P17-B requirements. The canonical checklist remains `plans/implementation.md`.

## Result

P17-B is complete. Next.js, Nuxt, and SvelteKit expose equivalent guarded admin panels and tenant-scoped public blogs. The maintained examples cover the required domain inventory, production browser journeys, and packed clean-consumer acceptance.

| Requirement | Closure evidence |
| --- | --- |
| Equivalent blog/admin apps | Each framework app contains the same Post, Category, Tag, Comment, User, Membership, Media, and PostTag models and stable fixture identifiers, plus guarded admin and tenant-scoped blog routes. |
| Complete feature inventory | Shared contracts cover role administration, notifications, widgets, tenant-scoped records, relations, media, durable import, and private export behavior in all three applications. |
| Real-browser critical journeys | The Playwright suite runs 30 production-server journeys across Next.js, Nuxt, and SvelteKit for guarded access, CRUD and relations, tenant switching, MFA enrollment/challenge/recovery/disable, and public blog behavior. |
| Packed and registry consumers | Packed validation installs the complete package family without workspace aliases, and the registry lifecycle installs `@holo-js/panels@0.1.0-next.0` with Holo-JS `0.3.11` into clean applications for all three frameworks. |

## Acceptance boundaries

The examples use only exported Holo Panels and Holo-JS APIs. Framework routing remains framework-owned; authentication, authorization, validation, database, queues, notifications, storage, and security remain Holo-owned. Generated route shells remain managed artifacts, while application domain and runtime files remain application-owned.

The observable behavior contract is frozen in `plans/p17-example-product-contract.md`. Completion evidence is maintained in the P17 section of `plans/implementation.md`, the Playwright suite under `tests/e2e`, and the packed and registry lifecycle scripts.
