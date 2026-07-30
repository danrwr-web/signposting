/**
 * Extracts the ids of uploaded handbook assets (inline images, uploaded PDFs)
 * referenced by a piece of sanitized handbook HTML. Used by the create/update
 * item actions to claim uploads that were stored before the item existed
 * (adminItemId = null) — once claimed, the serving routes enforce the item's
 * category visibility and the item-delete cascade removes the bytes.
 */
export function extractAdminToolkitUploadIds(html: string): { imageIds: string[]; fileIds: string[] } {
  const imageIds = new Set<string>()
  const fileIds = new Set<string>()
  if (html) {
    const re = /\/api\/admin-toolkit\/(images|files)\/([a-z0-9]+)/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(html)) !== null) {
      ;(match[1].toLowerCase() === 'images' ? imageIds : fileIds).add(match[2])
    }
  }
  return { imageIds: [...imageIds], fileIds: [...fileIds] }
}
