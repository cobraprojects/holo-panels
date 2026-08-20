# End-to-end visual tests

The visual regression suite runs against production builds of the seeded Next.js, Nuxt, and SvelteKit examples. Screenshot names and paths include the Playwright project and host platform so framework and operating-system baselines cannot collide. If expected PNGs are absent, generate them only in a stable review environment rather than accepting screenshots from an arbitrary local render.

Build the examples, then create or intentionally update baselines in the same pinned Chromium environment used for review:

```sh
bun run test:e2e:build
bunx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
```

To update one framework while iterating:

```sh
bun run test:e2e:build
HOLO_PANELS_E2E_EXAMPLES=next bunx playwright test tests/e2e/visual-regression.spec.ts --project=next --update-snapshots
```

Review every changed PNG before accepting it. A normal verification run omits `--update-snapshots`:

```sh
bunx playwright test tests/e2e/visual-regression.spec.ts
```
