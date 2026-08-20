import { expect, test } from '@playwright/test'

test('renders the framework-owned example shell', async ({ page }, testInfo) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: `example-${testInfo.project.name}` })).toBeVisible()
  await expect(page.getByText(/Holo .*backend runtime/)).toBeVisible()
})

test('keeps sibling panel overlays in their owning theme scope', async ({ page }) => {
  await page.goto('/e2e/panel-portal-theme')

  const lightPanel = page.locator('[data-e2e-panel="light"]')
  const darkPanel = page.locator('[data-e2e-panel="dark"]')
  const lightHost = page.locator('[data-e2e-portal-host="light"]')
  const darkHost = page.locator('[data-e2e-portal-host="dark"]')

  await expect(lightPanel).toHaveAttribute('data-theme', 'light')
  await expect(darkPanel).toHaveAttribute('data-theme', 'dark')
  await expect(lightHost).toHaveCount(1)
  await expect(darkHost).toHaveCount(1)

  const themeValues = async () => ({
    darkHost: await darkHost.evaluate(element =>
      getComputedStyle(element)
        .getPropertyValue('--holo-color-surface-overlay')
        .trim(),
    ),
    darkPanel: await darkPanel.evaluate(element =>
      getComputedStyle(element)
        .getPropertyValue('--holo-color-surface-overlay')
        .trim(),
    ),
    lightHost: await lightHost.evaluate(element =>
      getComputedStyle(element)
        .getPropertyValue('--holo-color-surface-overlay')
        .trim(),
    ),
    lightPanel: await lightPanel.evaluate(element =>
      getComputedStyle(element)
        .getPropertyValue('--holo-color-surface-overlay')
        .trim(),
    ),
  })

  const initialThemes = await themeValues()
  expect(initialThemes.lightHost).toBe(initialThemes.lightPanel)
  expect(initialThemes.darkHost).toBe(initialThemes.darkPanel)
  expect(initialThemes.lightHost).not.toBe(initialThemes.darkHost)

  await page
    .getByRole('button', { name: 'Open light panel menu' })
    .click()

  const lightMenu = lightHost.locator(
    '[data-slot="dropdown-menu-content"]',
  )
  await expect(lightMenu).toBeVisible()
  await expect(
    darkHost.locator('[data-slot="dropdown-menu-content"]'),
  ).toHaveCount(0)

  const lightMenuTheme = await lightMenu.evaluate(element =>
    getComputedStyle(element)
      .getPropertyValue('--holo-color-surface-overlay')
      .trim(),
  )
  const lightMenuBackground = await lightMenu.evaluate(element =>
    getComputedStyle(element).backgroundColor,
  )
  expect(lightMenuTheme).toBe(initialThemes.lightHost)

  await page.keyboard.press('Escape')
  await expect(lightMenu).not.toBeVisible()
  await page
    .getByRole('button', { name: 'Open dark panel modal' })
    .click()

  const darkModal = darkHost.locator('[data-panels-component="modal"]')
  await expect(darkModal).toBeVisible()
  await expect(darkModal).toHaveAttribute('aria-modal', 'true')
  await expect(
    lightHost.locator('[data-panels-component="modal"]'),
  ).toHaveCount(0)

  const darkModalTheme = await darkModal.evaluate(element =>
    getComputedStyle(element)
      .getPropertyValue('--holo-color-surface-overlay')
      .trim(),
  )
  const darkModalBackground = await darkModal.evaluate(element =>
    getComputedStyle(element).backgroundColor,
  )
  expect(darkModalTheme).toBe(initialThemes.darkHost)
  expect(darkModalBackground).not.toBe(lightMenuBackground)
  expect(await themeValues()).toEqual(initialThemes)
})
