import { csrfProtection } from '@holo-js/security/sveltekit/server'
import type { Handle } from '@sveltejs/kit'

const csrf = csrfProtection()

export const handle: Handle = input => input.event.url.pathname.startsWith('/holo/panels/')
  ? input.resolve(input.event)
  : csrf(input)
