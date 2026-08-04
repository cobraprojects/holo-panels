import { defineSessionConfig } from '@holo-js/session'

export default defineSessionConfig({
  absoluteLifetime: 120,
  cookie: { httpOnly: true, name: 'holo_panels_session', path: '/', sameSite: 'lax', secure: false },
  driver: 'file',
  idleTimeout: 120,
  rememberMeLifetime: 43_200,
  stores: { file: { driver: 'file', path: './storage/framework/sessions' } },
})
