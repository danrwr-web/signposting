import 'server-only'

// 4MB — must stay under Vercel's 4.5MB serverless request body limit.
export const MAX_ADMIN_TOOLKIT_FILE_BYTES = 4 * 1024 * 1024

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"

/**
 * Identifies a PDF from the file's leading bytes. The stored contentType
 * comes from here, never from the client-supplied MIME type.
 */
export function detectPdfContentType(bytes: Uint8Array): 'application/pdf' | null {
  const matches = PDF_MAGIC.length <= bytes.length && PDF_MAGIC.every((b, i) => bytes[i] === b)
  return matches ? 'application/pdf' : null
}

/**
 * The only url shape an uploaded handbook PDF is served from. Shared with the
 * sanitizer/link tooling so internal document links can be recognised.
 */
export const ADMIN_TOOLKIT_FILE_URL_PREFIX = '/api/admin-toolkit/files/'
