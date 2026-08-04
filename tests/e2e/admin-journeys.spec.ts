import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

const guardResponses = Object.freeze({
  next: { location: '/login?next=%2Fadmin', status: 307 },
  nuxt: { location: '/login?next=/admin', status: 302 },
  sveltekit: { location: '/login', status: 303 },
})

async function login(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill('super@example.test')
  await page.getByLabel('Password').fill('panel-secret')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect.poll(async () => (await page.context().cookies()).some(cookie => cookie.name === 'holo_panels_session')).toBe(true)
  await expect(page).toHaveURL(/\/admin(?:\/|$)/u)
}

function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const character of secret.replace(/=+$/u, '').toUpperCase()) bits += alphabet.indexOf(character).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/gu)?.map(value => Number.parseInt(value, 2)) ?? [])
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return value.toString().padStart(6, '0')
}

async function logout(page: Page): Promise<void> {
  const token = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  await page.evaluate(async (csrfToken) => {
    await fetch('/_holo/panels/admin/auth/logout', {
      body: '{}',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      method: 'POST',
    })
  }, token)
  await page.goto('/login')
}

async function fillOptionalField(page: Page, label: RegExp, value: string): Promise<void> {
  const field = page.getByLabel(label).first()
  if (await field.count()) await field.fill(value)
}

async function waitForPanelReady(page: Page): Promise<void> {
  const readiness = page.locator('[data-panels-ready]').first()
  if (await readiness.count()) await expect(readiness).toHaveAttribute('data-panels-ready', 'true')
}

async function gotoPanelPage(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForPanelReady(page)
}

async function selectField(page: Page, label: string, preferredValues: readonly string[]): Promise<void> {
  const field = page.getByLabel(label).first()
  if (await field.count()) {
    const tagName = await field.evaluate(element => element.tagName.toLowerCase())
    if (tagName !== 'select') {
      await field.fill(preferredValues[0]!)
      return
    }
    const options = await field.locator('option').evaluateAll(elements => elements.map(element => ({ label: element.textContent?.trim() ?? '', value: element.getAttribute('value') ?? '' })))
    const preferred = preferredValues.find(value => options.some(option => option.label === value || option.value === value))
    const selected = preferred ?? options.find(option => option.value)?.value
    if (!selected) throw new Error(`${label} has no selectable option`)
    await field.selectOption(selected)
    return
  }

  const radio = page.getByRole('radio', { name: new RegExp(preferredValues.join('|'), 'iu') }).first()
  await expect(radio).toBeVisible()
  await radio.check()
}

async function submitResourceForm(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/_holo/panels/admin/form-submit'))
  await page.getByRole('button', { name: /^Save\b/iu }).click()
  const response = await responsePromise
  if (!response.ok()) throw new Error(await response.text())
}

async function deleteRow(page: Page, rowText: string | RegExp): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: rowText }).first()
  await expect(row).toBeVisible()
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/_holo/panels/admin/action'))
  const dialogPromise = page.waitForEvent('dialog', { timeout: 500 }).then(dialog => dialog.accept()).catch(() => undefined)
  await row.getByRole('button', { name: /^Delete$/iu }).click()
  await dialogPromise
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true })
  const confirmationVisible = await expect(confirm).toBeVisible({ timeout: 1_000 }).then(() => true).catch(() => false)
  if (confirmationVisible) await confirm.click()
  const response = await responsePromise
  if (!response.ok()) throw new Error(await response.text())
  await page.reload()
  await waitForPanelReady(page)
  await expect(page.getByRole('row').filter({ hasText: rowText })).toHaveCount(0)
}

test('protects the admin shell with the configured Holo Auth guard', async ({ request }, testInfo) => {
  const expected = guardResponses[testInfo.project.name as keyof typeof guardResponses]
  if (!expected) throw new Error(`The ${testInfo.project.name} project has no admin guard fixture`)

  const response = await request.get('/admin', { maxRedirects: 0 })

  expect(response.status()).toBe(expected.status)
  expect(response.headers().location ?? null).toBe(expected.location)
  expect(await response.text()).not.toContain('user-acme-admin')
  expect(await response.text()).not.toContain('tenant-acme')
})

test.describe('authenticated admin journeys', () => {
  test.describe.configure({ mode: 'serial' })

  test('loads the authorized admin dashboard', async ({ page }) => {
    await login(page)
    await expect(page.getByText(/Holo Panels/u).first()).toBeVisible()
  })

  test('creates, edits, relates, and deletes tenant-scoped content', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await login(page)
    const suffix = `${testInfo.project.name}-${Date.now()}`
    const title = `Browser journey ${suffix}`
    const editedTitle = `${title} edited`
    const slug = `browser-journey-${suffix}`

    await gotoPanelPage(page, '/admin/posts/create')
    await page.getByRole('textbox', { name: /^Title/iu }).fill(title)
    await page.getByRole('textbox', { name: /^Slug/iu }).fill(slug)
    await fillOptionalField(page, /^Excerpt$/iu, 'Created through the shared Holo Panels browser journey.')
    await fillOptionalField(page, /^Body$/iu, 'This tenant-scoped record proves the production CRUD transport.')
    await fillOptionalField(page, /^Status$/iu, 'draft')
    await fillOptionalField(page, /^Category ?ID$/iu, 'category-acme-guides')
    await fillOptionalField(page, /^Author ?ID$/iu, 'user-super-admin')
    await selectField(page, 'Category', ['Guides', 'engineering', 'News', 'product'])
    await selectField(page, 'City', ['Cairo', 'Giza', 'Alexandria'])
    await submitResourceForm(page)

    await gotoPanelPage(page, '/admin/posts')
    const createdRow = page.getByRole('row').filter({ hasText: title }).first()
    await expect(createdRow).toBeVisible()
    const editLink = createdRow.getByRole('link', { name: /Edit/iu }).first()
    if (await editLink.count()) {
      await editLink.click()
    } else {
      const recordEditLink = page.getByRole('link', { name: `Edit ${slug}`, exact: true })
      if (await recordEditLink.count()) await recordEditLink.click()
      else await createdRow.getByRole('button', { name: /^Edit$/iu }).click()
    }
    await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/u)
    await waitForPanelReady(page)
    await page.getByRole('textbox', { name: /^Title/iu }).fill(editedTitle)
    await submitResourceForm(page)

    await gotoPanelPage(page, '/admin/posts')
    await expect(page.getByRole('row').filter({ hasText: editedTitle })).toBeVisible()

    await gotoPanelPage(page, '/admin/post-tags/create')
    await page.getByRole('textbox', { name: /^Post ?ID/iu }).fill('post-acme-release')
    await page.getByRole('textbox', { name: /^Tag ?ID/iu }).fill('tag-acme-typescript')
    await submitResourceForm(page)

    await gotoPanelPage(page, '/admin/post-tags')
    const relationRow = page.getByRole('row').filter({ hasText: 'post-acme-release' }).filter({ hasText: 'tag-acme-typescript' })
    await expect(relationRow).toBeVisible()
    await deleteRow(page, /post-acme-release.*tag-acme-typescript/iu)

    await gotoPanelPage(page, '/admin/posts')
    await deleteRow(page, editedTitle)
  })
  test('switches only to an authorized tenant', async ({ page }) => {
    await login(page)
    await gotoPanelPage(page, '/admin/tenants')
    await page.getByLabel('Tenant').selectOption('globex')
    await page.getByRole('button', { name: 'Switch tenant' }).click()
    await expect(page.getByText('Active tenant: globex')).toBeVisible()

    const token = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')?.value ?? ''
    const rejected = await page.evaluate(async (csrfToken) => {
      const response = await fetch('/_holo/panels/admin/tenant/switch', {
        body: JSON.stringify({ routeKey: 'attacker-tenant' }),
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        method: 'POST',
      })
      return response.status
    }, token)
    expect(rejected).toBe(404)
  })

  test('enrolls, challenges, recovers, and disables MFA through Holo Auth', async ({ page }) => {
    await login(page)
    await gotoPanelPage(page, '/admin/profile/mfa')
    await page.getByRole('button', { name: 'Begin enrollment' }).click()
    const secret = await page.getByTestId('mfa-manual-key').innerText()
    await page.getByLabel('Authentication code').fill(totp(secret))
    await page.getByRole('button', { name: 'Confirm enrollment' }).click()
    const recoveryCodesRegion = page.getByRole('region', { name: 'Recovery codes' })
    await expect(recoveryCodesRegion).toBeVisible()
    const recoveryCodes = await recoveryCodesRegion.getByRole('listitem').allTextContents()
    expect(recoveryCodes.length).toBeGreaterThan(1)

    await logout(page)
    await login(page)
    await expect(page).toHaveURL(/\/admin\/mfa-challenge$/u)
    await page.getByLabel('Challenge method').selectOption('recovery')
    await page.getByLabel('Authentication code').fill(recoveryCodes[0]!)
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page).toHaveURL(/\/admin\/?$/u)

    const token = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')?.value ?? ''
    const disabled = await page.evaluate(async ({ code, csrfToken }) => {
      const response = await fetch('/_holo/panels/admin/auth/mfa-disable', {
        body: JSON.stringify({ code, method: 'recovery' }),
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        method: 'POST',
      })
      return { body: await response.text(), status: response.status }
    }, { code: recoveryCodes[1]!, csrfToken: token })
    expect(disabled, disabled.body).toMatchObject({ status: 204 })
    await gotoPanelPage(page, '/admin/profile/mfa')
    await expect(page.getByText('MFA is disabled.')).toBeVisible()
  })
})
