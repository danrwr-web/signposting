import 'server-only'

export const MAX_ADMIN_TOOLKIT_IMAGE_BYTES = 2 * 1024 * 1024 // 2MB

const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Identifies JPG/PNG from the file's leading bytes. The stored contentType
 * comes from here, never from the client-supplied MIME type.
 */
export function detectImageContentType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  const matches = (magic: number[]) =>
    bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b)
  if (matches(JPEG_MAGIC)) return 'image/jpeg'
  if (matches(PNG_MAGIC)) return 'image/png'
  return null
}
