import type { NextConfig } from 'next'
import { withHolo } from '@holo-js/adapter-next/config'
import { relative, resolve } from 'node:path'

const localHoloRoot = process.env.HOLO_PANELS_HOLO_JS_ROOT
const localTurbopackTarget = (localRoot: string, target: string) => `./${relative(resolve(import.meta.dirname, '../../..'), resolve(localRoot, target))}`

const nextConfig: NextConfig = withHolo({
  turbopack: {
    root: resolve(import.meta.dirname, '../../..'),
    ...(localHoloRoot
      ? {
          resolveAlias: {
            '@holo-js/auth': localTurbopackTarget(localHoloRoot, 'packages/auth/dist/index.mjs'),
            '@holo-js/core': localTurbopackTarget(localHoloRoot, 'packages/core/dist/index.mjs'),
            '@holo-js/core/runtime': localTurbopackTarget(localHoloRoot, 'packages/core/dist/runtime/index.mjs'),
            '@holo-js/db': localTurbopackTarget(localHoloRoot, 'packages/db/dist/index.mjs'),
            '@holo-js/kernel': localTurbopackTarget(localHoloRoot, 'packages/kernel/dist/index.mjs'),
            '@holo-js/notifications': localTurbopackTarget(localHoloRoot, 'packages/notifications/dist/index.mjs'),
            '@holo-js/security': localTurbopackTarget(localHoloRoot, 'packages/security/dist/index.mjs'),
            '@holo-js/security/client': localTurbopackTarget(localHoloRoot, 'packages/security/dist/client.mjs'),
            '@holo-js/security/next/server': localTurbopackTarget(localHoloRoot, 'packages/security/dist/next/server.mjs'),
            '@holo-js/session': localTurbopackTarget(localHoloRoot, 'packages/session/dist/index.mjs'),
            '@holo-js/storage': localTurbopackTarget(localHoloRoot, 'packages/storage/dist/index.mjs'),
            '@holo-js/storage/runtime': localTurbopackTarget(
              localHoloRoot,
              'packages/storage/dist/runtime/composables/index.mjs',
            ),
          },
        }
      : {}),
  },
  webpack(config) {
    if (!localHoloRoot) return config
    config.resolve ??= {}
    config.resolve.alias = {
      ...config.resolve.alias,
      '@holo-js/auth$': resolve(localHoloRoot, 'packages/auth/dist/index.mjs'),
      '@holo-js/core$': resolve(localHoloRoot, 'packages/core/dist/index.mjs'),
      '@holo-js/core/runtime$': resolve(localHoloRoot, 'packages/core/dist/runtime/index.mjs'),
      '@holo-js/db$': resolve(localHoloRoot, 'packages/db/dist/index.mjs'),
      '@holo-js/kernel$': resolve(localHoloRoot, 'packages/kernel/dist/index.mjs'),
      '@holo-js/notifications$': resolve(localHoloRoot, 'packages/notifications/dist/index.mjs'),
      '@holo-js/security$': resolve(localHoloRoot, 'packages/security/dist/index.mjs'),
      '@holo-js/security/client$': resolve(localHoloRoot, 'packages/security/dist/client.mjs'),
      '@holo-js/security/next/server$': resolve(localHoloRoot, 'packages/security/dist/next/server.mjs'),
      '@holo-js/session$': resolve(localHoloRoot, 'packages/session/dist/index.mjs'),
      '@holo-js/storage$': resolve(localHoloRoot, 'packages/storage/dist/index.mjs'),
      '@holo-js/storage/runtime$': resolve(
        localHoloRoot,
        'packages/storage/dist/runtime/composables/index.mjs',
      ),
    }
    return config
  },
})

export default nextConfig
