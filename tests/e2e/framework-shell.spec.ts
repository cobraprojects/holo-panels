import { expect, test } from '@playwright/test'

test('renders the framework-owned example shell', async ({ page }, testInfo) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: `example-${testInfo.project.name}` })).toBeVisible()
  await expect(page.getByText(/Holo .*backend runtime/)).toBeVisible()
})
