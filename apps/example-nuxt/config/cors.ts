import { env } from '@holo-js/config'
import { defineCorsConfig } from '@holo-js/security'

export default defineCorsConfig({
  paths: ['/api/*', '/broadcasting/auth'],
  origins: [
    env('FRONTEND_URL', 'http://localhost:3000'),
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization', 'X-CSRF-TOKEN', 'X-Requested-With'],
  credentials: true,
  maxAge: 7200,
  statefulDomains: [
    env('FRONTEND_DOMAIN', 'localhost:3000'),
  ],
})
