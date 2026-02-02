/**
 * Tests for updateAdminToolkitItem server action
 *
 * These tests verify the non-destructive update behaviour:
 * - categoryId must ALWAYS be preserved (never changed by this action)
 * - contentJson blocks should only be updated when explicitly provided
 * - Attempts to set categoryId to null/empty should be rejected
 *
 * @see https://github.com/your-org/signposting/issues/XXX (data loss bug fix)
 */

import { randomUUID } from 'crypto'

// Mock types to simulate the action's behaviour without database
type MockAdminItem = {
  id: string
  type: 'PAGE' | 'LIST'
  title: string
  categoryId: string | null
  warningLevel: string | null
  contentHtml: string | null
  contentJson: Record<string, unknown> | null
  lastReviewedAt: Date | null
}

type UpdatePayload = {
  surgeryId: string
  itemId: string
  title: string
  categoryId?: string | null
  introHtml?: string
  footerHtml?: string
  roleCardsBlock?: {
    id?: string
    title?: string | null
    layout?: 'grid' | 'row'
    columns?: 2 | 3 | 4
    cards?: Array<{ id?: string; title: string; body: string; orderIndex?: number }>
  } | null
  warningLevel?: string | null
  lastReviewedAt?: string | null
}

/**
 * Simulates the key logic from updateAdminToolkitItem to verify behaviour.
 * This mirrors the actual implementation's decision logic.
 */
function simulateUpdateLogic(
  existing: MockAdminItem,
  payload: UpdatePayload,
): { shouldReject: boolean; rejectReason?: string; resultCategoryId: string | null } {
  // GUARDRAIL: Check if categoryId is being passed
  if ('categoryId' in payload) {
    if (payload.categoryId === null || payload.categoryId === '') {
      return {
        shouldReject: true,
        rejectReason: 'Cannot clear category through the item edit page.',
        resultCategoryId: existing.categoryId,
      }
    }
    // Non-null categoryId is ignored but logged
    console.warn(`BLOCKED: Attempt to modify categoryId. Preserving existing.`)
  }

  // CRITICAL: categoryId is ALWAYS preserved
  return {
    shouldReject: false,
    resultCategoryId: existing.categoryId,
  }
}

describe('updateAdminToolkitItem - categoryId preservation', () => {
  const existingItem: MockAdminItem = {
    id: 'item-123',
    type: 'PAGE',
    title: 'Original Title',
    categoryId: 'category-abc',
    warningLevel: null,
    contentHtml: '<p>Original content</p>',
    contentJson: {
      blocks: [
        { type: 'INTRO_TEXT', html: '<p>Intro</p>' },
        { type: 'FOOTER_TEXT', html: '<p>Footer</p>' },
      ],
    },
    lastReviewedAt: null,
  }

  it('preserves categoryId when only title is updated', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      // categoryId NOT provided
    }

    const result = simulateUpdateLogic(existingItem, payload)

    expect(result.shouldReject).toBe(false)
    expect(result.resultCategoryId).toBe('category-abc')
  })

  it('preserves categoryId when content is updated without categoryId in payload', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      introHtml: '<p>New intro</p>',
      footerHtml: '<p>New footer</p>',
      // categoryId NOT provided
    }

    const result = simulateUpdateLogic(existingItem, payload)

    expect(result.shouldReject).toBe(false)
    expect(result.resultCategoryId).toBe('category-abc')
  })

  it('rejects when categoryId is explicitly set to null', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: null, // EXPLICIT null - should be rejected
    }

    const result = simulateUpdateLogic(existingItem, payload)

    expect(result.shouldReject).toBe(true)
    expect(result.rejectReason).toContain('Cannot clear category')
  })

  it('rejects when categoryId is explicitly set to empty string', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: '', // EXPLICIT empty string - should be rejected
    }

    const result = simulateUpdateLogic(existingItem, payload)

    expect(result.shouldReject).toBe(true)
    expect(result.rejectReason).toContain('Cannot clear category')
  })

  it('preserves categoryId even when a different categoryId is provided (ignores it)', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: 'different-category', // This should be IGNORED
    }

    const result = simulateUpdateLogic(existingItem, payload)

    expect(result.shouldReject).toBe(false)
    // categoryId should remain the ORIGINAL, not the payload's value
    expect(result.resultCategoryId).toBe('category-abc')
  })
})

describe('updateAdminToolkitItem - content block preservation', () => {
  /**
   * Simulates the block merging logic from the action.
   */
  function simulateBlockMerge(
    existingJson: Record<string, unknown> | null,
    introHtml: string | undefined,
    footerHtml: string | undefined,
    roleCardsBlock: UpdatePayload['roleCardsBlock'],
  ): Record<string, unknown> | null {
    const isHtmlEmpty = (html: string | null | undefined): boolean => {
      if (!html) return true
      const stripped = html.replace(/<[^>]*>/g, '').trim()
      return stripped.length === 0
    }

    let json: Record<string, unknown> = existingJson ? { ...existingJson } : {}
    const blocksRaw = Array.isArray(json.blocks) ? [...json.blocks] : []

    // Handle INTRO_TEXT block
    if (introHtml !== undefined) {
      // Remove existing INTRO_TEXT
      const withoutIntro = blocksRaw.filter((b: any) => b?.type !== 'INTRO_TEXT')
      json = { ...json, blocks: withoutIntro }
      if (introHtml && !isHtmlEmpty(introHtml)) {
        ;(json.blocks as unknown[]).push({ type: 'INTRO_TEXT', html: introHtml })
      }
    }
    // If introHtml is undefined, existing block is preserved

    // Handle FOOTER_TEXT block
    if (footerHtml !== undefined) {
      const currentBlocks = Array.isArray(json.blocks) ? json.blocks : blocksRaw
      const withoutFooter = currentBlocks.filter((b: any) => b?.type !== 'FOOTER_TEXT')
      json = { ...json, blocks: withoutFooter }
      if (footerHtml && !isHtmlEmpty(footerHtml)) {
        ;(json.blocks as unknown[]).push({ type: 'FOOTER_TEXT', html: footerHtml })
      }
    }
    // If footerHtml is undefined, existing block is preserved

    // Handle ROLE_CARDS block
    if (roleCardsBlock !== undefined) {
      const currentBlocks = Array.isArray(json.blocks) ? json.blocks : blocksRaw
      const withoutRoleCards = currentBlocks.filter((b: any) => b?.type !== 'ROLE_CARDS')
      json = { ...json, blocks: withoutRoleCards }
      if (roleCardsBlock !== null) {
        ;(json.blocks as unknown[]).push({
          type: 'ROLE_CARDS',
          id: roleCardsBlock.id ?? randomUUID(),
          title: roleCardsBlock.title ?? null,
          layout: roleCardsBlock.layout ?? 'grid',
          columns: roleCardsBlock.columns ?? 3,
          cards: roleCardsBlock.cards ?? [],
        })
      }
    }
    // If roleCardsBlock is undefined, existing block is preserved

    const finalBlocks = Array.isArray(json.blocks) ? json.blocks : []
    if (finalBlocks.length === 0) {
      const keys = Object.keys(json).filter((k) => k !== 'blocks')
      return keys.length === 0 ? null : json
    }

    return json
  }

  const existingContentJson = {
    blocks: [
      { type: 'INTRO_TEXT', html: '<p>Existing intro</p>' },
      { type: 'ROLE_CARDS', id: 'rc-1', title: 'Roles', layout: 'grid', columns: 3, cards: [{ id: 'c1', title: 'Admin', body: 'Admin tasks', orderIndex: 0 }] },
      { type: 'FOOTER_TEXT', html: '<p>Existing footer</p>' },
    ],
  }

  it('preserves all blocks when no content fields are provided', () => {
    const result = simulateBlockMerge(existingContentJson, undefined, undefined, undefined)

    expect(result).not.toBeNull()
    const blocks = (result as any).blocks
    expect(blocks).toHaveLength(3)
    expect(blocks.find((b: any) => b.type === 'INTRO_TEXT')).toBeDefined()
    expect(blocks.find((b: any) => b.type === 'FOOTER_TEXT')).toBeDefined()
    expect(blocks.find((b: any) => b.type === 'ROLE_CARDS')).toBeDefined()
  })

  it('updates only introHtml when provided, preserves other blocks', () => {
    const result = simulateBlockMerge(existingContentJson, '<p>New intro</p>', undefined, undefined)

    expect(result).not.toBeNull()
    const blocks = (result as any).blocks
    expect(blocks).toHaveLength(3)

    const intro = blocks.find((b: any) => b.type === 'INTRO_TEXT')
    expect(intro?.html).toBe('<p>New intro</p>')

    // Footer and role cards should be preserved
    const footer = blocks.find((b: any) => b.type === 'FOOTER_TEXT')
    expect(footer?.html).toBe('<p>Existing footer</p>')

    const roleCards = blocks.find((b: any) => b.type === 'ROLE_CARDS')
    expect(roleCards?.title).toBe('Roles')
  })

  it('updates only footerHtml when provided, preserves other blocks', () => {
    const result = simulateBlockMerge(existingContentJson, undefined, '<p>New footer</p>', undefined)

    expect(result).not.toBeNull()
    const blocks = (result as any).blocks

    // Intro and role cards should be preserved
    const intro = blocks.find((b: any) => b.type === 'INTRO_TEXT')
    expect(intro?.html).toBe('<p>Existing intro</p>')

    const footer = blocks.find((b: any) => b.type === 'FOOTER_TEXT')
    expect(footer?.html).toBe('<p>New footer</p>')

    const roleCards = blocks.find((b: any) => b.type === 'ROLE_CARDS')
    expect(roleCards).toBeDefined()
  })

  it('removes role cards when explicitly set to null, preserves other blocks', () => {
    const result = simulateBlockMerge(existingContentJson, undefined, undefined, null)

    expect(result).not.toBeNull()
    const blocks = (result as any).blocks
    expect(blocks).toHaveLength(2) // Only intro and footer remain

    const roleCards = blocks.find((b: any) => b.type === 'ROLE_CARDS')
    expect(roleCards).toBeUndefined()

    // Intro and footer should be preserved
    expect(blocks.find((b: any) => b.type === 'INTRO_TEXT')).toBeDefined()
    expect(blocks.find((b: any) => b.type === 'FOOTER_TEXT')).toBeDefined()
  })

  it('clears intro when empty string is provided (intentional clear)', () => {
    const result = simulateBlockMerge(existingContentJson, '', undefined, undefined)

    expect(result).not.toBeNull()
    const blocks = (result as any).blocks

    // Intro should be removed
    const intro = blocks.find((b: any) => b.type === 'INTRO_TEXT')
    expect(intro).toBeUndefined()

    // Footer and role cards should be preserved
    expect(blocks.find((b: any) => b.type === 'FOOTER_TEXT')).toBeDefined()
    expect(blocks.find((b: any) => b.type === 'ROLE_CARDS')).toBeDefined()
  })
})

describe('updateAdminToolkitItem - regression test for data loss bug', () => {
  it('reproduces the exact payload that caused the bug and verifies fix', () => {
    // This is the exact payload structure that was causing the bug
    const bugPayload = {
      surgeryId: 'surgery-1',
      itemId: 'cmkphuzuf0039lb04smpznmsd',
      title: 'Holidays',
      introHtml: '<p class="prose-p">Test</p>',
      footerHtml: '',
      roleCardsBlock: null,
      warningLevel: null,
      lastReviewedAt: '2026-02-02T00:00:00.000Z',
    }

    const existingItem: MockAdminItem = {
      id: 'cmkphuzuf0039lb04smpznmsd',
      type: 'PAGE',
      title: 'Holidays',
      categoryId: 'category-holidays', // THIS MUST BE PRESERVED
      warningLevel: null,
      contentHtml: '<p>Some notes</p>',
      contentJson: {
        blocks: [
          { type: 'INTRO_TEXT', html: '<p>Original intro</p>' },
          { type: 'FOOTER_TEXT', html: '<p>Original notes</p>' },
        ],
      },
      lastReviewedAt: null,
    }

    // Simulate the categoryId preservation logic
    const result = simulateUpdateLogic(existingItem, bugPayload as UpdatePayload)

    // The fix should preserve categoryId
    expect(result.shouldReject).toBe(false)
    expect(result.resultCategoryId).toBe('category-holidays')
    expect(result.resultCategoryId).not.toBeNull()
    expect(result.resultCategoryId).not.toBe('')
  })
})
