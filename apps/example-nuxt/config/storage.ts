import { defineStorageConfig } from '@holo-js/storage'

export default defineStorageConfig({
  defaultDisk: 'private',
  disks: {
    private: {
      driver: 'local',
      root: './storage/app',
      visibility: 'private',
    },
  },
})
