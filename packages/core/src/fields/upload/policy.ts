import type { UploadMimeInspector, UploadPolicy } from './contracts'

const extensionPattern = /^[a-z0-9][a-z0-9+.-]{0,15}$/u
const mimePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u
const pathSegmentPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u

function normalizedUnique(values: readonly string[], normalize: (value: string) => string, label: string): readonly string[] {
  const normalized = [...new Set(values.map(normalize))]
  if (normalized.length === 0) throw new Error(`Upload ${label} cannot be empty`)
  return Object.freeze(normalized)
}

function normalizeExtension(value: string): string {
  const extension = value.trim().toLowerCase().replace(/^\./u, '')
  if (!extensionPattern.test(extension)) throw new Error(`Invalid upload extension: ${value}`)
  return extension
}

function normalizeMime(value: string): string {
  const mime = value.trim().toLowerCase()
  if (!mimePattern.test(mime)) throw new Error(`Invalid upload MIME type: ${value}`)
  return mime
}

function normalizeDirectory(value: string): string {
  const segments = value.split('/').filter(Boolean)
  if (segments.length === 0 || segments.some(segment => !pathSegmentPattern.test(segment))) {
    throw new Error('Upload directory must contain safe relative path segments')
  }
  return segments.join('/')
}

export function defineUploadPolicy(policy: UploadPolicy): UploadPolicy {
  if (!pathSegmentPattern.test(policy.disk)) throw new Error('Upload disk must be a configured disk identifier')
  if (!Number.isSafeInteger(policy.maximumFiles) || policy.maximumFiles < 1 || policy.maximumFiles > 100) {
    throw new Error('Upload maximum files must be an integer from 1 to 100')
  }
  if (!Number.isSafeInteger(policy.maximumSize) || policy.maximumSize < 1 || policy.maximumSize > 1024 * 1024 * 1024) {
    throw new Error('Upload maximum size must be from 1 byte to 1 GiB')
  }
  if (!Number.isSafeInteger(policy.expiresInSeconds) || policy.expiresInSeconds < 60 || policy.expiresInSeconds > 86_400) {
    throw new Error('Temporary upload expiry must be from 60 seconds to 24 hours')
  }
  const acceptedExtensions = normalizedUnique(policy.acceptedExtensions, normalizeExtension, 'extensions')
  const acceptedMimeTypes = normalizedUnique(policy.acceptedMimeTypes, normalizeMime, 'MIME types')
  if (policy.imageOnly && acceptedMimeTypes.some(mime => !mime.startsWith('image/'))) {
    throw new Error('Image upload policies may accept only image MIME types')
  }
  return Object.freeze({
    ...policy,
    acceptedExtensions,
    acceptedMimeTypes,
    conversions: Object.freeze([...(policy.conversions ?? [])]),
    directory: normalizeDirectory(policy.directory),
  })
}

function startsWith(contents: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => contents[index] === byte)
}

export const defaultUploadMimeInspector: UploadMimeInspector = Object.freeze({
  inspect(contents: Uint8Array): string {
    if (startsWith(contents, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
    if (startsWith(contents, [0xff, 0xd8, 0xff])) return 'image/jpeg'
    if (startsWith(contents, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
    if (startsWith(contents, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'
    if (startsWith(contents, [0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...contents.slice(8, 12)) === 'WEBP') return 'image/webp'
    return 'application/octet-stream'
  },
})

export function uploadExtension(fileName: string): string {
  const normalized = fileName.trim()
  const extension = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.') + 1) : ''
  return normalizeExtension(extension)
}
