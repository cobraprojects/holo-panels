import { defineConfig, devices } from '@playwright/test'

const host = '127.0.0.1'
const examples = Object.freeze({
  next: { port: 43101 },
  nuxt: { port: 43102 },
  sveltekit: { port: 43103 },
})
const selectedExamples = new Set(
  (process.env.HOLO_PANELS_E2E_EXAMPLES ?? Object.keys(examples).join(','))
    .split(',')
    .filter((example): example is keyof typeof examples => example in examples),
)

const exampleUrl = (example: keyof typeof examples): string => `http://${host}:${examples[example].port}`

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  outputDir: 'tests/e2e/test-results',
  projects: [
    {
      name: 'next',
      testMatch: ['**/framework-shell.spec.ts', '**/public-blog.spec.ts', '**/admin-journeys.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: exampleUrl('next') },
    },
    {
      name: 'nuxt',
      testMatch: ['**/framework-shell.spec.ts', '**/public-blog.spec.ts', '**/admin-journeys.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: exampleUrl('nuxt') },
    },
    {
      name: 'sveltekit',
      testMatch: ['**/framework-shell.spec.ts', '**/public-blog.spec.ts', '**/admin-journeys.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: exampleUrl('sveltekit') },
    },
  ].filter(project => selectedExamples.has(project.name as keyof typeof examples)),
  reporter: process.env.CI ? [['github'], ['line']] : 'line',
  retries: process.env.CI ? 2 : 0,
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: (Object.keys(examples) as (keyof typeof examples)[]).filter(example => selectedExamples.has(example)).map(example => ({
    command: `node tests/e2e/start-example.mjs ${example} ${examples[example].port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: exampleUrl(example),
  })),
  workers: process.env.CI ? 1 : undefined,
})
