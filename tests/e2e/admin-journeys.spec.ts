import { createHmac } from 'node:crypto'
import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'

const guardResponses = Object.freeze({
  next: { location: '/admin/login?next=%2Fadmin', status: 307 },
  nuxt: { location: '/admin/login?next=/admin', status: 302 },
  sveltekit: { location: '/admin/login?next=%2Fadmin', status: 303 },
})

const generatedResources = Object.freeze([
  { id: 'post-acme-panels', label: 'Post', plural: 'Posts', slug: 'posts' },
  { id: 'category-acme-guides', label: 'Category', plural: 'Categories', slug: 'categories' },
  { id: 'tag-acme-holo', label: 'Tag', plural: 'Tags', slug: 'tags' },
  { id: 'post-tag-post-acme-draft-tag-acme-tutorial', label: 'Post Tag', plural: 'Post tags', slug: 'post-tags' },
  { id: 'comment-acme-approved', label: 'Comment', plural: 'Comments', slug: 'comments' },
  { id: 'media-acme-cover', label: 'Media', plural: 'Media', slug: 'media' },
  { id: 'membership-acme-admin', label: 'Membership', plural: 'Memberships', slug: 'memberships' },
  { id: 'user-acme-admin', label: 'User', plural: 'Users', slug: 'users' },
])

function collectDisposedSessionErrors(page: Page): string[] {
  const errors: string[] = []
  const record = (message: string): void => {
    if (/disposed.{0,40}session|session.{0,40}disposed/iu.test(message)) errors.push(message)
  }
  page.on('pageerror', error => record(error.message))
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') record(message.text())
  })
  return errors
}

async function login(page: Page): Promise<void> {
  await page.goto('/admin/login', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-slot="card"]')).toBeVisible()
  const unclassifiedControls = await page.locator('[data-holo-panel] button, [data-holo-panel] input').evaluateAll(controls => controls.filter(control => !control.hasAttribute('data-slot')).map(control => control.outerHTML))
  expect(unclassifiedControls).toEqual([])
  const loginButton = page.getByRole('button', { name: 'Sign in' })
  await expect(loginButton).toBeEnabled()
  await page.getByLabel('Email').fill('super@example.test')
  await page.getByLabel('Password').fill('panel-secret')
  await Promise.all([
    page.waitForURL(url => url.pathname.startsWith('/admin') && url.pathname !== '/admin/login'),
    loginButton.click(),
  ])
  await page.waitForLoadState('domcontentloaded')
  await expect.poll(async () => (await page.context().cookies()).some(cookie => cookie.name === 'holo_panels_session')).toBe(true)
  await waitForPanelReady(page)
  await page.waitForLoadState('networkidle')
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
    await fetch('/holo/panels/admin/auth/logout', {
      body: '{}',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      method: 'POST',
    })
  }, token)
  await page.goto('/admin/login')
}

async function panelOperation(page: Page, operation: string, payload: Readonly<Record<string, unknown>>): Promise<Readonly<{ body: unknown, status: number }>> {
  return await page.evaluate(async ({ operation: operationName, payload: operationPayload }) => {
    const csrf = document.cookie.split('; ').find(cookie => cookie.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=')
    if (!csrf) throw new Error('The panel CSRF cookie is unavailable')
    const id = crypto.randomUUID()
    const body = new URLSearchParams({
      _token: decodeURIComponent(csrf),
      request: JSON.stringify({
        id,
        operation: operationName,
        panelId: 'admin',
        payload: operationPayload,
        protocolVersion: '1.0',
      }),
    })
    const response = await fetch(`/holo/panels/admin/${operationName}`, {
      body,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Idempotency-Key': `${id}:mutation`,
      },
      method: 'POST',
    })
    return { body: await response.json(), status: response.status }
  }, { operation, payload })
}

async function fillOptionalField(page: Page, label: RegExp, value: string): Promise<void> {
  const labelled = page.getByLabel(label).first()
  const textbox = page.getByRole('textbox', { name: label }).first()
  const combobox = page.getByRole('combobox', { name: label }).first()
  const field = await labelled.count() ? labelled : await textbox.count() ? textbox : combobox
  if (!await field.count()) return
  if (await field.evaluate(element => element.tagName.toLowerCase()) === 'select') {
    const options = await field.locator('option').evaluateAll(elements => elements.map(element => ({ label: element.textContent?.trim() ?? '', value: element.getAttribute('value') ?? '' })))
    const selected = options.find(option => option.label.toLowerCase() === value.toLowerCase() || option.value.toLowerCase() === value.toLowerCase())?.value
    if (selected) await field.selectOption(selected)
    return
  }
  await field.fill(value)
}

async function waitForPanelReady(page: Page): Promise<void> {
  const readiness = page.locator('[data-panels-ready]').first()
  if (await readiness.count()) await expect(readiness).toHaveAttribute('data-panels-ready', 'true')
}

async function markDocument(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const sentinel = globalThis.crypto.randomUUID()
    Reflect.set(globalThis, '__holoPanelsDocumentSentinel', sentinel)
    return sentinel
  })
}

async function expectSameDocument(page: Page, sentinel: string): Promise<void> {
  await expect.poll(async () => await page.evaluate(() => Reflect.get(globalThis, '__holoPanelsDocumentSentinel'))).toBe(sentinel)
}

async function gotoPanelPage(page: Page, path: string): Promise<void> {
  try {
    await page.goto(path)
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes('net::ERR_ABORTED')) throw cause
    await page.waitForLoadState('domcontentloaded')
    if (new URL(page.url()).pathname !== new URL(path, page.url()).pathname) await page.goto(path)
  }
  await waitForPanelReady(page)
}

async function selectField(page: Page, label: string, preferredValues: readonly string[]): Promise<void> {
  const exactLabel = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u')
  const labelled = page.getByLabel(exactLabel).first()
  const combobox = page.getByRole('combobox', { name: exactLabel }).first()
  const textbox = page.getByRole('textbox', { name: exactLabel }).first()
  const field = await labelled.count() ? labelled : await combobox.count() ? combobox : textbox
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
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/form-submit'))
  await page.getByRole('button', { name: /^Save\b/iu }).click()
  const response = await responsePromise
  if (!response.ok()) throw new Error(await response.text())
}

async function deleteRow(page: Page, rowText: string | RegExp): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: rowText }).first()
  await expect(row).toBeVisible()
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
  const dialogPromise = page.waitForEvent('dialog', { timeout: 500 }).then(dialog => dialog.accept()).catch(() => undefined)
  await row.getByRole('button', { name: 'Row actions', exact: true }).click()
  await page.getByRole('menuitem', { name: /^Delete$/iu }).click()
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

  test('recovers an open login form after its CSRF cookie becomes stale', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      document.cookie = 'XSRF-TOKEN=stale-token; Path=/; SameSite=Lax'
    })
    const loginButton = page.getByRole('button', { name: 'Sign in' })
    await expect(loginButton).toBeEnabled()
    await page.getByLabel('Email').fill('super@example.test')
    await page.getByLabel('Password').fill('panel-secret')
    await Promise.all([
      page.waitForURL(url => url.pathname.startsWith('/admin') && url.pathname !== '/admin/login'),
      loginButton.click(),
    ])
    await expect.poll(async () => (await page.context().cookies()).some(cookie => cookie.name === 'holo_panels_session')).toBe(true)
  })

  test('stops after one CSRF retry when the replacement token is also rejected', async ({ page }) => {
    let submissions = 0
    await page.route('**/holo/panels/admin/auth/login', async (route) => {
      submissions += 1
      await route.fulfill({
        body: JSON.stringify({ error: 'Panel request security validation failed.' }),
        contentType: 'application/json',
        status: 419,
      })
    })
    await page.goto('/admin/login', { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      document.cookie = 'XSRF-TOKEN=stale-token; Path=/; SameSite=Lax'
    })
    await page.getByLabel('Email').fill('super@example.test')
    await page.getByLabel('Password').fill('panel-secret')

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Your session expired. Refresh the page and try again.', { exact: true })).toBeVisible()
    expect(submissions).toBe(2)
  })

  test('renders invalid credentials as an authentication error', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'networkidle' })
    await page.getByLabel('Email').fill('super@example.test')
    await page.getByLabel('Password').fill('wrong-password')

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('These credentials do not match our records.', { exact: true })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/admin/login')
  })

  test('returns to the allow-listed requested destination after login', async ({ page }) => {
    await page.goto('/admin/posts?tableSearch=published', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(url => url.pathname === '/admin/login' && url.searchParams.get('next') === '/admin/posts?tableSearch=published')
    await page.getByLabel('Email').fill('super@example.test')
    await page.getByLabel('Password').fill('panel-secret')

    await Promise.all([
      page.waitForURL(url => url.pathname === '/admin/posts' && url.searchParams.get('tableSearch') === 'published'),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ])
  })

  test('submits a repeated login form operation only once', async ({ page }) => {
    let submissions = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/holo/panels/admin/auth/login')) submissions += 1
    })
    await page.goto('/admin/login', { waitUntil: 'networkidle' })
    await page.getByLabel('Email').fill('super@example.test')
    await page.getByLabel('Password').fill('panel-secret')

    await Promise.all([
      page.waitForURL(url => url.pathname.startsWith('/admin') && url.pathname !== '/admin/login'),
      page.locator('form').evaluate((form) => {
        form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
        form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
      }),
    ])

    expect(submissions).toBe(1)
  })

  test('loads the authorized admin dashboard', async ({ page }) => {
    await login(page)
    await expect(page.getByText(/Holo Panels/u).first()).toBeVisible()
  })

  test('loads every generated resource route with and without model policies', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page)

    for (const resource of generatedResources) {
      const routes = [
        { heading: resource.plural, path: `/admin/${resource.slug}` },
        { heading: `Create ${resource.label}`, path: `/admin/${resource.slug}/create` },
        { heading: `View ${resource.label}`, path: `/admin/${resource.slug}/${resource.id}` },
        { heading: `Edit ${resource.label}`, path: `/admin/${resource.slug}/${resource.id}/edit` },
      ]

      for (const route of routes) {
        const response = await page.goto(route.path)
        expect(response?.status(), route.path).toBe(200)
        await waitForPanelReady(page)
        await expect(page.locator('[data-holo-panel] h1'), route.path).toHaveText(route.heading)
        await expect(page.locator('body'), route.path).not.toContainText(/Application error|Policy definition was not found/iu)
      }
    }
  })

  test('returns a framework-native safe page for an unknown admin route', async ({ page }) => {
    await login(page)
    const response = await page.goto('/admin/does-not-exist')

    expect(response?.status()).toBe(404)
    await expect(page.locator('body')).not.toContainText(/stack|\/Users\/|node_modules/iu)
  })

  test('opens the compiled user menu and navigates to the profile page', async ({ page }) => {
    await login(page)
    const trigger = page.getByRole('button', { name: 'Account menu' })

    await trigger.click()
    await page.getByRole('menuitem', { name: 'Profile' }).click()

    await expect(page).toHaveURL(/\/admin\/profile$/u)
    await expect(page.getByRole('heading', { name: /^Profile$/u })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
  })

  test('switches and persists the panel color mode without changing the host application', async ({ page }) => {
    await login(page)
    const shell = page.locator('[data-holo-panel]').first()
    const trigger = page.getByRole('button', { name: 'Account menu' })

    await trigger.click()
    await page.getByRole('menuitem', { name: /Dark(?: theme)?/u }).click()
    await expect(shell).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('holo-panels:admin:color-mode'))).toBe('dark')
    await page.reload()
    await waitForPanelReady(page)
    await expect(shell).toHaveAttribute('data-theme', 'dark')

    await trigger.click()
    await page.getByRole('menuitem', { name: /System(?: theme)?/u }).click()
    await expect(shell).toHaveAttribute('data-theme', 'system')
  })

  test('composes the isolated dashboard from shadcn-family components', async ({ page }) => {
    await login(page)
    await gotoPanelPage(page, '/admin/posts')
    await expect(page.getByRole('heading', { name: /^example-/u })).toHaveCount(0)
    await expect(page.locator('[data-slot="sidebar-wrapper"]')).toBeVisible()
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible()
    await expect(page.locator('.hp-global-search [data-slot="input-group"]')).toBeVisible()
    await expect(page.locator('[data-slot="table"]')).toBeVisible()
    await expect(page.locator('[data-slot="checkbox"]').first()).toBeVisible()
    const unclassifiedListControls = await page.locator('[data-holo-panel] button, [data-holo-panel] input, [data-holo-panel] select, [data-holo-panel] textarea, [data-holo-panel] table').evaluateAll(controls => controls.filter(control => !control.hasAttribute('data-slot')).map(control => control.outerHTML))
    expect(unclassifiedListControls).toEqual([])

    const userMenu = page.getByRole('button', { name: 'Account menu' })
    await userMenu.click()
    const openMenu = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]')
    await expect(openMenu).toBeVisible()
    await expect(openMenu.locator('[data-slot="dropdown-menu-item"]').first()).toBeVisible()

    await gotoPanelPage(page, '/admin/posts/create')
    await expect(page.locator('[data-slot="card"]').first()).toBeVisible()
    await expect(page.locator('[data-slot="input"]').first()).toBeVisible()
    await expect(page.locator('[data-slot="native-select"]').first()).toBeVisible()
    await expect(page.locator('[data-slot="radio-group-item"]').first()).toBeVisible()
    const unclassifiedFormControls = await page.locator('[data-holo-panel] button, [data-holo-panel] input, [data-holo-panel] select, [data-holo-panel] textarea, [data-holo-panel] table').evaluateAll(controls => controls.filter(control => control.getAttribute('aria-hidden') !== 'true' && !control.hasAttribute('data-slot')).map(control => control.outerHTML))
    expect(unclassifiedFormControls).toEqual([])

    const formGeometry = await page.locator('.hp-resource-form').evaluate((form) => {
      const input = form.querySelector<HTMLInputElement>('[data-field-path="title"] input')
      const select = form.querySelector<HTMLSelectElement>('[data-field-path="city"] select')
      const radio = form.querySelector<HTMLFieldSetElement>('[data-field-type="radio"]')
      if (!input || !select || !radio) throw new Error('The post form controls are unavailable')
      const view = form.ownerDocument.defaultView
      if (!view) throw new Error('The post form window is unavailable')
      return {
        inputWidth: input.getBoundingClientRect().width,
        radioBorder: view.getComputedStyle(radio).borderTopWidth,
        selectWidth: select.getBoundingClientRect().width,
      }
    })
    expect(Math.abs(formGeometry.inputWidth - formGeometry.selectWidth)).toBeLessThanOrEqual(1)
    expect(formGeometry.radioBorder).toBe('0px')

    const globalSearch = page.locator('.hp-global-search [data-slot="input-group"]')
    await expect(globalSearch).toHaveCount(1)
    const groupedSearchBorders = await globalSearch.evaluate((group) => {
      const input = group.querySelector('[data-slot="input-group-control"]')
      if (!input) throw new Error('The grouped global search input is unavailable')
      const view = group.ownerDocument.defaultView
      if (!view) throw new Error('The global search window is unavailable')
      return {
        group: view.getComputedStyle(group).borderTopWidth,
        input: view.getComputedStyle(input).borderTopWidth,
      }
    })
    expect(groupedSearchBorders).toEqual({ group: '1px', input: '0px' })

    const postRouteKey = generatedResources[0]!.id
    await gotoPanelPage(page, `/admin/posts/${postRouteKey}/edit`)
    await expect(page.getByRole('heading', { name: 'Active query' })).toHaveCount(0)
    await expect(page.locator('[data-slot="page-actions"] a, [data-slot="page-actions"] button')).toHaveCount(2)
    const actionGeometry = await page.locator('.hp-panel-page-header').evaluate((header) => {
      const heading = header.querySelector('h1')
      const actions = [...header.querySelectorAll<HTMLElement>('[data-slot="page-actions"] a, [data-slot="page-actions"] button')]
      if (!heading || actions.length < 2) throw new Error('The edit page heading and actions are unavailable')
      return {
        actionTops: actions.map(action => action.getBoundingClientRect().top),
        headingCenter: heading.getBoundingClientRect().top + heading.getBoundingClientRect().height / 2,
      }
    })
    expect(Math.max(...actionGeometry.actionTops) - Math.min(...actionGeometry.actionTops)).toBeLessThanOrEqual(1)
    const pageActions = page.locator('[data-slot="page-actions"]')
    const pageActionsBox = await pageActions.boundingBox()
    expect(pageActionsBox?.width ?? 0).toBeGreaterThan(150)
    const commentsRelation = page.locator('[data-relation-manager="comments"]')
    await expect(commentsRelation.getByRole('table')).toBeVisible()
    await expect(commentsRelation.getByRole('columnheader', { name: 'Author Name' })).toBeVisible()
    await expect(commentsRelation.getByRole('button', { name: 'Edit' }).first()).toBeVisible()

    const styles = await page.locator('body').evaluate((body) => {
      const root = body.querySelector('[data-holo-panel]')
      const input = body.querySelector('.hp-resource-form [data-slot="input"]')
      const button = body.querySelector('[data-holo-panel] button[type="submit"]')
      const form = body.querySelector('.hp-resource-form')
      if (!root || !input || !button || !form) throw new Error('The generated panel controls are unavailable')
      const view = body.ownerDocument.defaultView
      if (!view) throw new Error('The generated panel window is unavailable')
      const external = body.ownerDocument.createElement('button')
      external.textContent = 'Outside panel'
      body.append(external)
      const result = {
        buttonBackground: view.getComputedStyle(button).backgroundColor,
        buttonRadius: view.getComputedStyle(button).borderRadius,
        buttonSize: [button.getBoundingClientRect().width, button.getBoundingClientRect().height],
        externalRadius: view.getComputedStyle(external).borderRadius,
        formDisplay: view.getComputedStyle(form).display,
        inputHeight: input.getBoundingClientRect().height,
        inputRadius: view.getComputedStyle(input).borderRadius,
        rootFont: view.getComputedStyle(root).fontFamily,
      }
      external.remove()
      return result
    })

    expect(styles.buttonBackground).not.toBe('rgba(0, 0, 0, 0)')
    expect(styles.buttonRadius).toBe('8px')
    expect(styles.buttonSize[1]).toBe(36)
    expect(styles.externalRadius).toBe('0px')
    expect(styles.formDisplay).toBe('grid')
    expect(styles.inputHeight).toBe(36)
    expect(styles.inputRadius).toBe('8px')
    expect(styles.rootFont).toContain('ui-sans-serif')

    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: /Dark(?: theme)?/u }).click()
    await expect(page.locator('[data-holo-panel]').first()).toHaveAttribute('data-theme', 'dark')
    const darkGeometry = await page.locator('body').evaluate((body) => {
      const input = body.querySelector<HTMLElement>('.hp-resource-form [data-slot="input"]')
      const button = body.querySelector<HTMLElement>('[data-holo-panel] button[type="submit"]')
      if (!input || !button) throw new Error('The dark panel controls are unavailable')
      return {
        buttonRadius: getComputedStyle(button).borderRadius,
        buttonSize: [button.getBoundingClientRect().width, button.getBoundingClientRect().height],
        inputHeight: input.getBoundingClientRect().height,
        inputRadius: getComputedStyle(input).borderRadius,
      }
    })
    expect(darkGeometry).toEqual({
      buttonRadius: styles.buttonRadius,
      buttonSize: styles.buttonSize,
      inputHeight: styles.inputHeight,
      inputRadius: styles.inputRadius,
    })
  })

  test('keeps resource tables compact, sortable, and contained at desktop and mobile widths', async ({ page }, testInfo) => {
    await login(page)
    await gotoPanelPage(page, '/admin/posts')
    const table = page.locator('[data-panels-component="table"]')
    const title = table.getByRole('columnheader').filter({ has: page.getByRole('button', { name: /^title$/iu }) })
    await expect(table).toHaveAttribute('data-state', 'ready')
    const geometry = await table.evaluate(element => {
      const surface = element.querySelector('[data-panels-component="data-table"]')
      const header = element.querySelector('thead th')
      const row = element.querySelector('tbody tr')
      const toolbar = element.querySelector('.hp-table-toolbar')
      const footer = element.querySelector('.hp-table-pagination')
      if (!surface || !header || !row || !toolbar || !footer) throw new Error('The resource table is incomplete')
      return {
        border: getComputedStyle(surface).borderTopWidth,
        headerHeight: header.getBoundingClientRect().height,
        headerSize: Number.parseFloat(getComputedStyle(header).fontSize),
        rowHeight: row.getBoundingClientRect().height,
        toolbarDisplay: getComputedStyle(toolbar).display,
        toolbarWrap: getComputedStyle(toolbar).flexWrap,
        footerDisplay: getComputedStyle(footer).display,
        footerWrap: getComputedStyle(footer).flexWrap,
      }
    })
    expect(geometry.border).toBe('1px')
    expect(geometry.headerHeight).toBeLessThanOrEqual(40)
    expect(geometry.headerSize).toBeLessThanOrEqual(14)
    expect(geometry.rowHeight).toBeLessThanOrEqual(56)
    expect(geometry.toolbarDisplay).toBe('flex')
    expect(geometry.toolbarWrap).toBe('wrap')
    expect(geometry.footerDisplay).toBe('flex')
    expect(geometry.footerWrap).toBe('wrap')
    await expect(table.getByRole('button', { name: 'Filters', exact: true })).toHaveCSS('background-color', await table.getByRole('button', { name: 'Columns', exact: true }).evaluate(element => getComputedStyle(element).backgroundColor))
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('table-desktop-light.png') })
    await table.getByRole('button', { name: 'Row actions', exact: true }).first().click()
    await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')

    await title.getByRole('button').click()
    await expect(title).toHaveAttribute('aria-sort', 'ascending')
    await expect(table).toHaveAttribute('data-state', 'ready')
    await page.getByRole('heading', { level: 1 }).hover()
    await expect(title.getByRole('button')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await table.getByRole('combobox', { name: 'Results per page' }).selectOption('10')
    await expect(table).toHaveAttribute('data-state', 'ready')
    await expect(table.getByRole('combobox', { name: 'Results per page' })).toHaveValue('10')
    const search = table.getByRole('searchbox', { name: 'Search', exact: true })
    await search.fill('ticket-14-no-matching-records')
    await expect(table).toHaveAttribute('data-state', 'empty')
    await expect(title).toBeVisible()
    await expect(table.getByRole('table')).toContainText('No records found.')
    await search.clear()
    await expect(table).toHaveAttribute('data-state', 'ready')

    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: /Dark(?: theme)?/u }).click()
    await page.setViewportSize({ height: 844, width: 390 })
    const overflow = await table.evaluate(element => {
      const surface = element.querySelector('[data-panels-component="data-table"]')
      if (!surface) throw new Error('The table surface is unavailable')
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        surfaceWidth: surface.getBoundingClientRect().width,
        tableWidth: element.getBoundingClientRect().width,
        overflowX: getComputedStyle(surface).overflowX,
      }
    })
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth)
    expect(overflow.surfaceWidth).toBeLessThanOrEqual(overflow.tableWidth)
    expect(overflow.tableWidth).toBeLessThanOrEqual(390)
    expect(overflow.overflowX).toBe('auto')
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('table-mobile-dark.png') })
  })

  test('executes grouped bulk actions through the table and reports failures with Sonner', async ({ page }) => {
    await login(page)
    await gotoPanelPage(page, '/admin/posts')

    await page.getByRole('checkbox', { name: 'Select page' }).click()
    await page.getByRole('button', { name: 'Bulk actions' }).click()
    await page.getByRole('menuitem', { name: 'Publish selected' }).click()
    const publishResponsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    const publishResponse = await publishResponsePromise
    expect(publishResponse.ok()).toBe(true)
    await expect(page.getByText('The requested action is not available.')).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Publish selected' })).toHaveCount(0)

    await page.route('**/holo/panels/admin/action', async (route) => {
      const requestBody = new URLSearchParams(route.request().postData() ?? '')
      const envelope = JSON.parse(requestBody.get('request') ?? '{}') as { readonly id?: unknown }
      await route.fulfill({
        body: JSON.stringify({
          error: { category: 'internal', code: 'forced-action-failure', message: 'Forced action failure.', retryable: false },
          id: typeof envelope.id === 'string' ? envelope.id : 'forced-action-request',
          ok: false,
          protocolVersion: '1.0',
        }),
        contentType: 'application/json',
        status: 500,
      })
    })
    await page.getByRole('button', { name: 'Bulk actions' }).click()
    await page.getByRole('menuitem', { name: 'Publish selected' }).click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    const actionFailureToast = page.locator('[data-sonner-toast]').filter({ hasText: 'Publish selected failed' })
    await expect(actionFailureToast).toContainText('The operation could not be completed.')
    await expect(page.locator('.hp-table-bulk-actions [role="alert"]')).toHaveCount(0)
  })

  test('collapses the desktop sidebar and opens the mobile navigation drawer', async ({ page }) => {
    await login(page)
    const shell = page.locator('[data-holo-panel]').first()
    const navigation = page.getByRole('navigation', { name: 'Panel navigation' })
    const toggle = page.getByRole('button', { name: 'Toggle navigation' })
    const expandedWidth = (await navigation.boundingBox())?.width ?? 0

    await expect(toggle).toBeVisible()
    await toggle.click()
    await expect(shell).toHaveAttribute('data-sidebar-collapsed', 'true')
    await expect.poll(async () => (await navigation.boundingBox())?.width ?? expandedWidth).toBeLessThan(expandedWidth)

    await page.setViewportSize({ height: 844, width: 390 })
    await page.reload()
    await waitForPanelReady(page)
    await expect(navigation).not.toBeInViewport()
    await toggle.click()
    const drawer = page.getByRole('dialog', { name: 'Sidebar' })
    await expect(drawer).toBeVisible()
    await expect(navigation).toBeInViewport()
    await expect.poll(async () => drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    const entranceMotion = await drawer.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        duration: style.animationDuration,
        easing: style.animationTimingFunction,
      }
    })
    expect(entranceMotion).toEqual({
      duration: '0.2s',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    })

    await page.keyboard.press('Escape')
    await expect(drawer).toHaveAttribute('data-state', 'closed')
    const exitMotionDuration = await drawer.evaluate(element => getComputedStyle(element).animationDuration)
    expect(exitMotionDuration).toBe('0.2s')
    await expect(drawer).toBeHidden()
    await expect(toggle).toBeFocused()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await toggle.click()
    await expect(drawer).toBeVisible()
    const reducedMotionDuration = await drawer.evaluate(element => Number.parseFloat(getComputedStyle(element).animationDuration))
    expect(reducedMotionDuration).toBeLessThanOrEqual(0.001)
    await page.keyboard.press('Tab')
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  })

  test('collapses navigation groups without hiding unrelated destinations', async ({ page }) => {
    await login(page)
    const navigation = page.getByRole('navigation', { name: 'Panel navigation' })
    await expect(navigation.getByRole('link')).toHaveText([
      'Overview',
      'Posts',
      'Categories',
      'Tags',
      'Post tags',
      'Comments',
      'Media',
      'Memberships',
      'Users',
    ])
    const content = navigation.getByText('Content', { exact: true })
    const groupedDestination = navigation.getByRole('link', { name: 'Categories', exact: true })
    const ungroupedDestination = navigation.getByRole('link', { name: 'Posts', exact: true })

    await expect(groupedDestination).toBeVisible()
    await content.click()
    await expect(groupedDestination).toBeHidden()
    await expect(ungroupedDestination).toBeVisible()
    await content.click()
    await expect(groupedDestination).toBeVisible()
  })

  test('navigates between panel pages without replacing the browser document', async ({ page }) => {
    await login(page)
    const sentinel = await markDocument(page)

    await page.getByRole('navigation', { name: 'Panel navigation' }).getByRole('link', { name: 'Posts', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/posts$/u)
    await expect(page.getByRole('row').filter({ hasText: 'Acme draft' })).toBeVisible()
    await expectSameDocument(page, sentinel)

    await page.getByRole('button', { name: 'Row actions', exact: true }).first().click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit Post' })).toBeVisible()
    await expectSameDocument(page, sentinel)
  })

  test('keeps the replacement client usable when navigation interrupts a form submission', async ({ page }) => {
    const disposedSessionErrors = collectDisposedSessionErrors(page)
    await login(page)
    await gotoPanelPage(page, '/admin/posts')
    await page.getByRole('button', { name: 'Row actions', exact: true }).first().click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit Post' })).toBeVisible()

    let releaseSubmission = (): void => undefined
    const submissionGate = new Promise<void>((resolve) => {
      releaseSubmission = resolve
    })
    let delayed = false
    const formSubmitRoute = '**/holo/panels/admin/form-submit'
    await page.route(formSubmitRoute, async (route) => {
      if (delayed) {
        await route.continue()
        return
      }
      delayed = true
      await submissionGate
      await route.continue().catch(() => undefined)
    })

    try {
      const submission = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/holo/panels/admin/form-submit'))
      await page.getByRole('button', { name: /^Save\b/iu }).click()
      await submission
      await page.getByRole('navigation', { name: 'Panel navigation' }).getByRole('link', { name: 'Categories', exact: true }).click()
      await expect(page).toHaveURL(/\/admin\/categories$/u)
      await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible()
    } finally {
      releaseSubmission()
      await page.unroute(formSubmitRoute)
    }

    expect(disposedSessionErrors).toEqual([])
  })

  test('searches tenant-scoped resources from the generated shell', async ({ page }) => {
    await login(page)
    const search = page.getByRole('combobox', { name: 'Global search' })
    await expect(search).toBeVisible()
    await search.fill('draft')
    const result = page.getByRole('option').filter({ hasText: 'Acme draft' })
    await expect(result).toBeVisible()
    await result.click()
    await expect(page).toHaveURL(/\/admin\/posts\/(?:post-)?acme-draft$/u)
  })

  test('passes the active list query to resource widgets', async ({ page }) => {
    await login(page)
    await gotoPanelPage(page, '/admin/posts?search=draft')

    await expect(page.getByText('Search: draft', { exact: true })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Acme draft' })).toBeVisible()
  })

  test('rejects wrong-owner and wrong-tenant relation mutations at the framework route', async ({ page }) => {
    await login(page)

    const wrongOwner = await panelOperation(page, 'action', {
      intent: 'relation',
      managerId: 'comments',
      ownerId: 'post-acme-draft',
      relatedId: 'comment-acme-pending',
      relationOperation: 'edit',
      resourceId: 'posts',
      values: { body: 'This mutation must not escape its owner.' },
    })
    expect(wrongOwner.status).toBeGreaterThanOrEqual(400)
    expect(wrongOwner.status).toBeLessThan(500)
    expect(wrongOwner.body).toMatchObject({ ok: false })

    const wrongTenantOwner = await panelOperation(page, 'action', {
      intent: 'relation',
      managerId: 'comments',
      ownerId: 'post-globex-platform',
      relationOperation: 'create',
      resourceId: 'posts',
      values: { authorName: 'Intruder', body: 'Cross-tenant content', status: 'pending' },
    })
    expect(wrongTenantOwner.status).toBeGreaterThanOrEqual(400)
    expect(wrongTenantOwner.status).toBeLessThan(500)
    expect(wrongTenantOwner.body).toMatchObject({ ok: false })

    const wrongTenantRelated = await panelOperation(page, 'action', {
      intent: 'relation',
      managerId: 'tags',
      ownerId: 'post-acme-release',
      pivot: { position: 9 },
      relatedId: 'tag-globex-holo',
      relationOperation: 'attach',
      resourceId: 'posts',
    })
    expect(wrongTenantRelated.status).toBeGreaterThanOrEqual(400)
    expect(wrongTenantRelated.status).toBeLessThan(500)
    expect(wrongTenantRelated.body).toMatchObject({ ok: false })
  })

  test('creates, edits, relates, and deletes tenant-scoped content', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const disposedSessionErrors = collectDisposedSessionErrors(page)
    await login(page)
    const suffix = `${testInfo.project.name}-${Date.now()}`
    const title = `Browser journey ${suffix}`
    const editedTitle = `${title} edited`
    const slug = `browser-journey-${suffix}`

    await gotoPanelPage(page, '/admin/posts/create')
    await page.getByRole('textbox', { name: /^Title/iu }).fill(title)
    const slugInput = page.getByRole('textbox', { name: /^Slug/iu })
    await expect(slugInput).toHaveValue(slug)
    await slugInput.fill(`editorial-${slug}`)
    await page.getByRole('textbox', { name: /^Title/iu }).fill(`${title} draft`)
    await expect(slugInput).toHaveValue(`editorial-${slug}`)
    await slugInput.fill(slug)
    await page.getByRole('textbox', { name: /^Title/iu }).fill(title)
    await expect(slugInput).toHaveValue(slug)
    await fillOptionalField(page, /^Excerpt$/iu, 'Created through the shared Holo Panels browser journey.')
    await fillOptionalField(page, /^Body$/iu, 'This tenant-scoped record proves the production CRUD transport.')
    await fillOptionalField(page, /^Status$/iu, 'draft')
    await fillOptionalField(page, /^Category ?ID$/iu, 'category-acme-guides')
    await fillOptionalField(page, /^Author ?ID$/iu, 'user-super-admin')
    await selectField(page, 'Category', ['Guides', 'engineering', 'News', 'product'])
    await selectField(page, 'City', ['Cairo', 'Giza', 'Alexandria'])
    const uploadResponsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/upload'))
    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8ZkAAAAASUVORK5CYII=', 'base64'),
      mimeType: 'image/png',
      name: `${slug}.png`,
    })
    const uploadResponse = await uploadResponsePromise
    expect(uploadResponse.ok()).toBe(true)
    await expect(page.getByText('stored', { exact: true })).toBeVisible()
    await submitResourceForm(page)

    await gotoPanelPage(page, '/admin/posts')
    const createdRow = page.getByRole('row').filter({ hasText: title }).first()
    await expect(createdRow).toBeVisible()
    await createdRow.getByRole('button', { name: 'Row actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/u)
    await waitForPanelReady(page)
    await page.getByRole('textbox', { name: /^Title/iu }).fill(editedTitle)
    await submitResourceForm(page)
    const relationDocument = await markDocument(page)

    const tags = page.getByRole('region', { name: 'Tags' })
    await expect(tags).toBeVisible()
    const relationOptionsResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/options'))
    await tags.getByRole('button', { name: 'Attach', exact: true }).click()
    const relationOptions = await relationOptionsResponse
    if (!relationOptions.ok()) throw new Error(await relationOptions.text())
    const relatedTag = page.getByLabel('Related record', { exact: true })
    await expect(relatedTag).toBeVisible()
    await expect.poll(async () => relatedTag.locator('option').count()).toBeGreaterThan(1)
    const tagOptions = await relatedTag.locator('option').evaluateAll(options => options.map(option => ({ label: option.textContent?.trim() ?? '', value: option.getAttribute('value') ?? '' })))
    const selectedTag = tagOptions.find(option => option.label === 'TypeScript') ?? tagOptions.find(option => option.value)
    if (!selectedTag) throw new Error('The generated relation selector has no tenant-scoped tag option')
    await relatedTag.selectOption(selectedTag.value)
    await page.getByRole('spinbutton', { name: 'Position', exact: true }).fill('2')
    const attachResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Attach', exact: true }).last().click()
    const attached = await attachResponse
    if (!attached.ok()) throw new Error(await attached.text())
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    const attachedTagRow = page.getByRole('row').filter({ hasText: selectedTag.label }).first()
    await expect(attachedTagRow).toBeVisible()
    await attachedTagRow.getByRole('button', { name: 'Edit pivot', exact: true }).click()
    const pivotPosition = page.getByRole('dialog').getByRole('spinbutton', { name: 'Position', exact: true })
    await expect(pivotPosition).toHaveValue('2')
    await pivotPosition.fill('7')
    const editPivotResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Edit pivot', exact: true }).last().click()
    const editedPivot = await editPivotResponse
    if (!editedPivot.ok()) throw new Error(await editedPivot.text())
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    const editedTagRow = page.getByRole('row').filter({ hasText: selectedTag.label }).first()
    await editedTagRow.getByRole('button', { name: 'Edit pivot', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('spinbutton', { name: 'Position', exact: true })).toHaveValue('7')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    let viewMutations = 0
    const countViewMutation = (request: Request): void => {
      if (request.method() === 'POST' && request.url().endsWith('/holo/panels/admin/action')) viewMutations++
    }
    page.on('request', countViewMutation)
    await editedTagRow.getByRole('button', { name: 'View', exact: true }).click()
    const viewTagDialog = page.getByRole('dialog')
    await expect(viewTagDialog).toContainText(selectedTag.label)
    await viewTagDialog.getByRole('button', { name: 'Close', exact: true }).last().click()
    await expect.poll(() => viewMutations).toBe(0)
    page.off('request', countViewMutation)
    await editedTagRow.getByRole('button', { name: 'Detach', exact: true }).click()
    const detachResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Detach', exact: true }).last().click()
    const detached = await detachResponse
    if (!detached.ok()) throw new Error(await detached.text())
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    await expect(page.getByRole('row').filter({ hasText: selectedTag.label })).toHaveCount(0)

    const commentAuthor = `Panel reviewer ${suffix}`
    const commentBody = `Created through the ${testInfo.project.name} relation manager.`
    const editedCommentBody = `${commentBody} Edited.`
    const comments = page.getByRole('region', { name: 'Comments' })
    await expect(comments).toBeVisible()
    await comments.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByLabel('Author Name', { exact: true }).fill(commentAuthor)
    await page.getByLabel('Body', { exact: true }).fill(commentBody)
    await page.getByLabel('Status', { exact: true }).fill('pending')
    const createCommentResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Create', exact: true }).last().click()
    const createdComment = await createCommentResponse
    if (!createdComment.ok()) throw new Error(await createdComment.text())
    const createdCommentPayload = await createdComment.json() as {
      readonly data?: {
        readonly relations?: readonly {
          readonly id?: unknown
          readonly records?: readonly { readonly id?: unknown, readonly values?: { readonly authorName?: unknown } }[]
        }[]
      }
    }
    const commentId = createdCommentPayload.data?.relations
      ?.find(relation => relation.id === 'comments')
      ?.records?.find(candidate => candidate.values?.authorName === commentAuthor)
      ?.id
    if (typeof commentId !== 'number' && typeof commentId !== 'string') throw new Error('The created relation response has no record identifier')
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    let commentRow = page.getByRole('row').filter({ hasText: commentAuthor }).first()
    await expect(commentRow).toContainText(commentBody)
    await commentRow.getByRole('button', { name: 'Dissociate', exact: true }).click()
    const dissociateResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Dissociate', exact: true }).last().click()
    const dissociatedComment = await dissociateResponse
    if (!dissociatedComment.ok()) throw new Error(await dissociatedComment.text())
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    await expect(page.getByRole('row').filter({ hasText: commentAuthor })).toHaveCount(0)
    const associateOptionsResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/options'))
    await comments.getByRole('button', { name: 'Associate', exact: true }).click()
    const associateOptions = await associateOptionsResponse
    if (!associateOptions.ok()) throw new Error(await associateOptions.text())
    const relatedComment = page.getByLabel('Related record', { exact: true })
    await expect.poll(async () => relatedComment.locator('option').count()).toBeGreaterThan(1)
    await relatedComment.selectOption(String(commentId))
    const associateResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Associate', exact: true }).last().click()
    const associatedComment = await associateResponse
    if (!associatedComment.ok()) throw new Error(await associatedComment.text())
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    commentRow = page.getByRole('row').filter({ hasText: commentAuthor }).first()
    await expect(commentRow).toContainText(commentBody)
    await commentRow.getByRole('button', { name: 'Edit', exact: true }).click()
    const editCommentDialog = page.getByRole('dialog')
    await editCommentDialog.getByRole('textbox', { name: 'Body', exact: true }).fill(editedCommentBody)
    const editCommentResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Edit', exact: true }).last().click()
    const editedComment = await editCommentResponse
    if (!editedComment.ok()) throw new Error(await editedComment.text())
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    const editedCommentRow = page.getByRole('row').filter({ hasText: commentAuthor }).first()
    await expect(editedCommentRow).toContainText(editedCommentBody)
    await editedCommentRow.getByRole('button', { name: 'Delete', exact: true }).click()
    const deleteCommentResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/holo/panels/admin/action'))
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    const deletedComment = await deleteCommentResponse
    if (!deletedComment.ok()) throw new Error(await deletedComment.text())
    await waitForPanelReady(page)
    await expectSameDocument(page, relationDocument)
    await expect(page.getByRole('row').filter({ hasText: commentAuthor })).toHaveCount(0)

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
    expect(disposedSessionErrors).toEqual([])
  })
  test('switches only to an authorized tenant', async ({ page }) => {
    await login(page)
    await gotoPanelPage(page, '/admin/tenants')
    await page.getByLabel('Tenant').selectOption('globex')
    await page.getByRole('button', { name: 'Switch tenant' }).click()
    await expect(page.getByText('Active tenant: globex')).toBeVisible()

    const token = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')?.value ?? ''
    const rejected = await page.evaluate(async (csrfToken) => {
      const response = await fetch('/holo/panels/admin/tenant/switch', {
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
    const secret = await page.locator('p').filter({ hasText: 'Manual key:' }).locator('code').innerText()
    await page.getByLabel('Authentication code').fill(totp(secret))
    await page.getByRole('button', { name: 'Confirm enrollment' }).click()
    const recoveryCodesRegion = page.getByRole('region', { name: 'Recovery codes' })
    await expect(recoveryCodesRegion).toBeVisible()
    const recoveryCodes = await recoveryCodesRegion.getByRole('listitem').allTextContents()
    expect(recoveryCodes.length).toBeGreaterThan(1)

    await logout(page)
    await login(page)
    await expect(page).toHaveURL(/\/admin\/mfa-challenge$/u)
    await page.getByLabel('Verification method').selectOption('recovery')
    await page.getByLabel('Authentication code').fill(recoveryCodes[0]!)
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page).toHaveURL(/\/admin\/?$/u)

    const token = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')?.value ?? ''
    const disabled = await page.evaluate(async ({ code, csrfToken }) => {
      const response = await fetch('/holo/panels/admin/auth/mfa-disable', {
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
