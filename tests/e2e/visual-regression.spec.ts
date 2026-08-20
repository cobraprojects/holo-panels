import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

const desktopViewport = Object.freeze({ height: 1_000, width: 1_440 })
const mobileViewport = Object.freeze({ height: 844, width: 390 })
const frozenBrowserTime = new Date('2026-08-15T12:00:00.000Z')

function screenshotName(testInfo: TestInfo, state: string): string {
  return `${testInfo.project.name}-${state}.png`
}

async function settlePage(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded')
}

async function waitForPanelReady(page: Page): Promise<void> {
  const readiness = page.locator('[data-panels-ready]').first()
  if (await readiness.count()) await expect(readiness).toHaveAttribute('data-panels-ready', 'true')
  await expect(page.locator('[data-holo-panel]').first()).toBeVisible()
  await settlePage(page)
}

async function gotoPanelPage(page: Page, path: string): Promise<void> {
  try {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes('net::ERR_ABORTED')) throw cause
    await page.waitForLoadState('domcontentloaded')
    if (new URL(page.url()).pathname !== new URL(path, page.url()).pathname) await page.goto(path, { waitUntil: 'domcontentloaded' })
  }
  await waitForPanelReady(page)
}

async function login(page: Page): Promise<void> {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-slot="card"]')).toBeVisible()
  await page.getByLabel('Email').fill('super@example.test')
  await page.getByLabel('Password').fill('panel-secret')
  const signIn = page.getByRole('button', { name: 'Sign in' })
  await Promise.all([
    page.waitForURL(url => url.pathname.startsWith('/admin') && url.pathname !== '/admin/login'),
    signIn.click(),
  ])
  await waitForPanelReady(page)
  await expect.poll(async () => (await page.context().cookies()).some(cookie => cookie.name === 'holo_panels_session')).toBe(true)
}

async function expectPageScreenshot(page: Page, testInfo: TestInfo, state: string): Promise<void> {
  await settlePage(page)
  await expect(page).toHaveScreenshot(screenshotName(testInfo, state), {
    fullPage: false,
    mask: [page.locator('time')],
  })
}

async function expectLocatorScreenshot(locator: Locator, testInfo: TestInfo, state: string): Promise<void> {
  await expect(locator).toBeVisible()
  await expect(locator).toHaveScreenshot(screenshotName(testInfo, state), {
    mask: [locator.locator('time')],
  })
}

async function useDarkMode(page: Page): Promise<void> {
  const accountMenu = page.locator('.hp-panel-user-trigger button, button:has(.hp-panel-user-trigger)').first()
  await accountMenu.click()
  await page.getByRole('menuitem', { name: /Dark(?: theme)?/u }).click()
  await expect(page.locator('[data-holo-panel]').first()).toHaveAttribute('data-theme', 'dark')
}

test.use({
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'UTC',
  viewport: desktopViewport,
})

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.setViewportSize(desktopViewport)
  await page.clock.setFixedTime(frozenBrowserTime)
})

test.describe('approved panel visuals', () => {
  test('renders the framework auth state', async ({ page }, testInfo) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-slot="card"]')).toBeVisible()
    await expect(page.getByRole('heading')).toBeVisible()
    await expectPageScreenshot(page, testInfo, 'auth-login-desktop-light')
  })

  test('renders the framework panel shell from seeded data', async ({ page }, testInfo) => {
    await login(page)
    await expect(page.getByText(/Holo Panels/u).first()).toBeVisible()
    await expectPageScreenshot(page, testInfo, 'panel-shell-desktop-light')
  })

  test('renders the framework resource table from seeded data', async ({ page }, testInfo) => {
    await login(page)
    await gotoPanelPage(page, '/admin/posts')
    await expect(page.getByRole('heading', { level: 1, name: 'Posts', exact: true })).toBeVisible()
    await expect(page.locator('[data-slot="table"]')).toBeVisible()
    await expectLocatorScreenshot(page.locator('main'), testInfo, 'posts-table-desktop-light')
  })

  test('renders a desktop resource table in dark mode', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'next', 'The Next example owns the representative dark-mode baseline')
    await login(page)
    await gotoPanelPage(page, '/admin/posts')
    await useDarkMode(page)
    await expectPageScreenshot(page, testInfo, 'posts-table-desktop-dark')
  })

  test('renders the mobile navigation drawer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'sveltekit', 'The SvelteKit example owns the representative mobile baseline')
    await page.setViewportSize(mobileViewport)
    await login(page)
    const shell = page.locator('[data-holo-panel]').first()
    const navigation = page.getByRole('navigation', { name: 'Panel navigation' })
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
    await expect(shell).toHaveAttribute('data-navigation-open', 'true')
    await expect(navigation).toBeInViewport()
    await expectPageScreenshot(page, testInfo, 'panel-shell-mobile-drawer')
  })

  test('renders the resource creation form', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'nuxt', 'The Nuxt example owns the representative form baseline')
    await login(page)
    await gotoPanelPage(page, '/admin/posts/create')
    await expect(page.getByRole('heading', { name: 'Create Post', exact: true })).toBeVisible()
    await expect(page.locator('[data-slot="input"]').first()).toBeVisible()
    await expectLocatorScreenshot(page.locator('main'), testInfo, 'post-form-desktop-light')
  })

  test('renders a seeded relation manager', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'sveltekit', 'The SvelteKit example owns the representative relation baseline')
    await login(page)
    await gotoPanelPage(page, '/admin/posts/building-with-holo-panels/edit')
    const tags = page.getByRole('region', { name: 'Tags', exact: true })
    await expect(tags.getByRole('table')).toBeVisible()
    await expectLocatorScreenshot(tags, testInfo, 'post-tags-relation-desktop-light')
  })

  test('renders the notification inbox', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'next', 'The Next example owns the representative notification baseline')
    await login(page)
    const trigger = page.locator('.hp-notification-inbox-trigger-button')
    await trigger.click()
    const inbox = page.getByRole('region', { name: 'Notification inbox' })
    await expect(inbox).toBeVisible()
    await expect(inbox).not.toHaveAttribute('aria-busy', 'true')
    await expectLocatorScreenshot(page.locator('.hp-notification-inbox-trigger-content'), testInfo, 'notification-inbox-desktop-light')
  })
})
