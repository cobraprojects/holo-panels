import { describe, expect, it } from 'vitest'
import { FileUpload } from '../src'

describe('FileUpload', () => {
  it('compiles the Filament-facing configuration into the shared secure upload protocol', () => {
    const manifest = FileUpload.make('avatar')
      .image()
      .disk('private')
      .directory('users/avatars')
      .acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
      .maxSize(5_242_880)
      .compile()

    expect(manifest).toMatchObject({
      properties: {
        uploadPolicy: {
          acceptedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
          acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          directory: 'users/avatars',
          disk: 'private',
          expiresInSeconds: 3_600,
          imageOnly: true,
          maximumFiles: 1,
          maximumSize: 5_242_880,
          private: true,
        },
      },
      type: 'panels:field:upload',
    })
  })
})
