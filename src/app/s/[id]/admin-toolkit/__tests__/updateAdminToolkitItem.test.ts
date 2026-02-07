/**
 * Tests for updateAdminToolkitItem server action
 *
 * These tests verify the update behaviour:
 * - categoryId is preserved when not provided in the payload
 * - Admin users (canManage=true) CAN change categoryId, including to subcategories
 * - Non-admin users cannot change categoryId
 * - contentJson blocks should only be updated when explicitly provided
 *
 * @see https://github.com/your-org/signposting/issues/XXX (subcategory save fix)
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
  canManage: boolean,
): { resultCategoryId: string | null } {
  // Only include categoryId if user can manage AND it's explicitly provided
  if (canManage && payload.categoryId !== undefined) {
    return {
      resultCategoryId: payload.categoryId ?? null,
    }
  }

  // categoryId is preserved when not provided or when user cannot manage
  return {
    resultCategoryId: existing.categoryId,
  }
}

describe('updateAdminToolkitItem - categoryId handling', () => {
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

  it('preserves categoryId when not provided in payload (admin user)', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      // categoryId NOT provided
    }

    const result = simulateUpdateLogic(existingItem, payload, true)

    expect(result.resultCategoryId).toBe('category-abc')
  })

  it('preserves categoryId when not provided in payload (non-admin user)', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      // categoryId NOT provided
    }

    const result = simulateUpdateLogic(existingItem, payload, false)

    expect(result.resultCategoryId).toBe('category-abc')
  })

  it('allows admin user to change categoryId to a different category', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: 'different-category',
    }

    const result = simulateUpdateLogic(existingItem, payload, true)

    expect(result.resultCategoryId).toBe('different-category')
  })

  it('allows admin user to change categoryId to a subcategory', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: 'subcategory-paediatrics',
    }

    const result = simulateUpdateLogic(existingItem, payload, true)

    expect(result.resultCategoryId).toBe('subcategory-paediatrics')
  })

  it('allows admin user to uncategorise an item (set categoryId to null)', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: null,
    }

    const result = simulateUpdateLogic(existingItem, payload, true)

    expect(result.resultCategoryId).toBeNull()
  })

  it('ignores categoryId changes from non-admin users', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: 'different-category',
    }

    const result = simulateUpdateLogic(existingItem, payload, false)

    // categoryId should remain the ORIGINAL, not the payload's value
    expect(result.resultCategoryId).toBe('category-abc')
  })

  it('ignores categoryId null from non-admin users', () => {
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-123',
      title: 'New Title',
      categoryId: null,
    }

    const result = simulateUpdateLogic(existingItem, payload, false)

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

describe('updateAdminToolkitItem - subcategory save regression test', () => {
  it('admin user can save a subcategory ID and it is not reverted to the parent', () => {
    const existingItem: MockAdminItem = {
      id: 'item-handbook',
      type: 'PAGE',
      title: 'Paediatrics referral',
      categoryId: 'parent-ers-category', // Currently assigned to parent "ERS"
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

    // Admin changes category to the "Paediatrics" subcategory under "ERS"
    const payload: UpdatePayload = {
      surgeryId: 'surgery-1',
      itemId: 'item-handbook',
      title: 'Paediatrics referral',
      categoryId: 'subcategory-paediatrics', // Subcategory under ERS
    }

    const result = simulateUpdateLogic(existingItem, payload, true)

    // The subcategory ID must be saved, NOT reverted to the parent
    expect(result.resultCategoryId).toBe('subcategory-paediatrics')
    expect(result.resultCategoryId).not.toBe('parent-ers-category')
  })
})
