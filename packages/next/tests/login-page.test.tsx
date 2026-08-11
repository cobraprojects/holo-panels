import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NextPanelLoginPage } from '../src/login-page'

describe('Next panel login page', () => {
  it('renders the internal themed component with configured account links', () => {
    const html = renderToString(<NextPanelLoginPage
      brandName="Control Center"
      forgotPasswordPath="/admin/forgot-password"
      panelId="admin"
      registrationPath="/admin/register"
      simplePageMaxContentWidth="screen-sm"
      theme="system"
      themeColors={{ primary: '#7c3aed' }}
    />)

    expect(html).toContain('data-holo-panel')
    expect(html).toContain('data-slot="card"')
    expect(html).toContain('data-slot="input"')
    expect(html).toContain('data-slot="button"')
    expect(html).toContain('data-theme="system"')
    expect(html).toContain('--holo-color-primary:#7c3aed')
    expect(html).toContain('--hp-auth-max-width:40rem')
    expect(html).toContain('href="/admin/forgot-password"')
    expect(html).toContain('href="/admin/register"')
    expect(html).toContain('Control Center')
  })
})
