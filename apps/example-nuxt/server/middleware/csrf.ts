import { csrfProtection } from '@holo-js/security/nuxt/server'
import { defineEventHandler, getRequestURL } from 'h3'

const csrf = csrfProtection()

export default defineEventHandler(event => getRequestURL(event).pathname.startsWith('/_holo/panels/')
  ? undefined
  : csrf(event))
