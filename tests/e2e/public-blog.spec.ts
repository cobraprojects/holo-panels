import { expect, test, type Page } from '@playwright/test'

interface BlogFixture {
  readonly approvedComment: string
  readonly detailBody: string
  readonly detailPath: string
  readonly draftPath: string
  readonly draftTitle: string
  readonly filteredOutTitle: string
  readonly filterName: string
  readonly heading: string
  readonly otherTenantTitle: string
  readonly pendingComment: string
  readonly pendingCommentPath: string
  readonly publishedTitle: string
}

const fixtures: Readonly<Record<string, BlogFixture>> = Object.freeze({
  next: {
    approvedComment: 'The resource boundaries are clear.',
    detailBody: 'Build administrative applications with typed resources and framework-native rendering.',
    detailPath: '/blog/building-with-holo-panels',
    draftPath: '/blog/acme-draft',
    draftTitle: 'Acme draft',
    filteredOutTitle: 'Acme release',
    filterName: 'Guides',
    heading: 'Holo Panels example blog',
    otherTenantTitle: 'Globex platform',
    pendingComment: 'Awaiting Acme moderation.',
    pendingCommentPath: '/blog/building-with-holo-panels',
    publishedTitle: 'Building with Holo Panels',
  },
  nuxt: {
    approvedComment: 'The resource boundaries are clear.',
    detailBody: 'Build administrative applications with typed resources and framework-native rendering.',
    detailPath: '/blog/building-with-holo-panels',
    draftPath: '/blog/acme-draft',
    draftTitle: 'Acme draft',
    filteredOutTitle: 'Acme release',
    filterName: 'Guides',
    heading: 'Acme journal',
    otherTenantTitle: 'Globex platform',
    pendingComment: 'Awaiting Acme moderation.',
    pendingCommentPath: '/blog/building-with-holo-panels',
    publishedTitle: 'Building with Holo Panels',
  },
  sveltekit: {
    approvedComment: 'The resource boundaries are clear.',
    detailBody: 'Build administrative applications with typed resources and framework-native rendering.',
    detailPath: '/blog/building-with-holo-panels?tenant=acme',
    draftPath: '/blog/acme-draft?tenant=acme',
    draftTitle: 'Acme draft',
    filteredOutTitle: 'Acme release',
    filterName: 'Guides',
    heading: 'Acme journal',
    otherTenantTitle: 'Globex platform',
    pendingComment: 'Awaiting Acme moderation.',
    pendingCommentPath: '/blog/building-with-holo-panels?tenant=acme',
    publishedTitle: 'Building with Holo Panels',
  },
})

const fixtureFor = (projectName: string): BlogFixture => {
  const fixture = fixtures[projectName]
  if (!fixture) throw new Error(`The ${projectName} project has no public blog fixture`)
  return fixture
}

async function expectSuccessfulDocument(page: Page, path: string): Promise<void> {
  const response = await page.goto(path)
  expect(response?.ok()).toBe(true)
  await expect(page.locator('main').last()).toBeVisible()
}

test('lists only published records for the selected tenant', async ({ page }, testInfo) => {
  const fixture = fixtureFor(testInfo.project.name)
  await expectSuccessfulDocument(page, '/blog')

  await expect(page.getByRole('heading', { level: 1, name: fixture.heading })).toBeVisible()
  await expect(page.getByRole('link', { name: fixture.publishedTitle })).toBeVisible()
  await expect(page.getByText(fixture.draftTitle, { exact: true })).toHaveCount(0)
  await expect(page.getByText(fixture.otherTenantTitle, { exact: true })).toHaveCount(0)
})

test('filters published records through browser navigation', async ({ page }, testInfo) => {
  const fixture = fixtureFor(testInfo.project.name)
  await expectSuccessfulDocument(page, '/blog')

  await page.getByRole('link', { name: fixture.filterName }).click()

  await expect(page).toHaveURL(/\?category=/)
  await expect(page.getByRole('link', { name: fixture.publishedTitle })).toBeVisible()
  await expect(page.getByText(fixture.filteredOutTitle, { exact: true })).toHaveCount(0)
})

test('renders a published post and only approved comments', async ({ page }, testInfo) => {
  const fixture = fixtureFor(testInfo.project.name)
  await expectSuccessfulDocument(page, fixture.detailPath)

  await expect(page.getByText(fixture.detailBody, { exact: true })).toBeVisible()
  await expect(page.getByText(fixture.approvedComment, { exact: true })).toBeVisible()

  await expectSuccessfulDocument(page, fixture.pendingCommentPath)
  await expect(page.getByText(fixture.pendingComment, { exact: true })).toHaveCount(0)
})

test('returns not found for an unpublished slug', async ({ page }, testInfo) => {
  const fixture = fixtureFor(testInfo.project.name)
  const response = await page.goto(fixture.draftPath)

  expect(response?.status()).toBe(404)
  await expect(page.getByText(fixture.draftTitle, { exact: true })).toHaveCount(0)
})
