# Third-party design-source audit

Holo Panels uses the shadcn family as design and source references. The P5-A implementation was audited against each upstream repository on 2026-07-27.

| Project | Upstream | License | Obligation if source is copied |
| --- | --- | --- | --- |
| shadcn/ui | <https://github.com/shadcn-ui/ui> | MIT, copyright 2023 shadcn | Include the upstream copyright and MIT permission notice in copies or substantial portions. |
| shadcn-vue | <https://github.com/unovue/shadcn-vue> | MIT, copyright 2023 radix-vue | Include the upstream copyright and MIT permission notice in copies or substantial portions. |
| shadcn-svelte | <https://github.com/huntabyte/shadcn-svelte> | MIT, copyright 2023 Hunter Johnston and CokaKoala | Include the upstream copyright and MIT permission notice in copies or substantial portions. |

The Holo Panels tokens, contracts, fixtures, and semantic CSS are original implementations. No shadcn-family source was copied into this package, so no third-party notice is required in the distributed CSS or JavaScript at this time. If a later renderer copies or substantially adapts upstream source, its package must preserve the applicable MIT notice and update its distributed third-party notices.
