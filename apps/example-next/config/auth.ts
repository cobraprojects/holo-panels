import { defineAuthConfig } from '@holo-js/auth'

export default defineAuthConfig({
  defaults: {
    guard: 'web',
    passwords: 'users',
  },
  guards: {
    web: {
      driver: 'session',
      provider: 'users',
    },
  },
  providers: {
    users: {
      identifiers: ['email'],
      model: 'User',
    },
  },
  passwords: {
    users: {
      expire: 60,
      provider: 'users',
      table: 'password_reset_tokens',
      throttle: 60,
    },
  },
  multiFactor: true,
})
