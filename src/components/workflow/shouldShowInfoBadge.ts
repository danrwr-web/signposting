export function shouldShowInfoBadge(node: { type?: string; data?: any; style?: any }): boolean {
  const data = node.data ?? {}
  const style = node.style ?? data?.style ?? data?.nodeStyle ?? data?.node?.style ?? null

  // A) Linked workflows exist (not shown on node face)
  const linkedCount =
    (typeof data?.linkedWorkflowsCount === 'number' && data.linkedWorkflowsCount) ||
    (Array.isArray(data?.linkedWorkflows) ? data.linkedWorkflows.length : 0) ||
    (Array.isArray(data?.workflowLinks) ? data.workflowLinks.length : 0)
  if (linkedCount > 0) return true

  // B) Reference node has meaningful content
  const refItems =
    (Array.isArray(data?.reference?.items) ? data.reference.items : null) ||
    (Array.isArray(style?.reference?.items) ? style.reference.items : null) ||
    null
  if (refItems && refItems.some((it: any) => String(it?.text ?? '').trim() !== '' || String(it?.info ?? '').trim() !== '')) {
    return true
  }

  // C) Node has extra details content not shown on the face (most nodes only show title)
  const bodyLike =
    String(data?.body ?? '').trim() ||
    String(data?.description ?? '').trim() ||
    String(data?.details ?? '').trim() ||
    String(style?.body ?? '').trim() ||
    String(style?.details ?? '').trim()
  if (bodyLike.length > 0) return true

  return false
}

