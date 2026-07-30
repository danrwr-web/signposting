import {
  computeSmartVisualFingerprint,
  buildSmartVisualSourceText,
  smartVisualItemHasContent,
  generateSmartVisualLayout,
  getAdminToolkitSmartVisualForItem,
} from '@/server/adminToolkitSmartVisual'
import { callAzureOpenAI } from '@/server/azureOpenAI'
import { prisma } from '@/lib/prisma'
import type { AdminToolkitPageItem } from '@/server/adminToolkit'

jest.mock('@/server/azureOpenAI', () => ({
  ...jest.requireActual('@/server/azureOpenAI'),
  callAzureOpenAI: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    tokenUsageLog: { create: jest.fn() },
    adminItemSmartVisual: { findUnique: jest.fn() },
  },
}))

const mockedCallAzureOpenAI = callAzureOpenAI as jest.MockedFunction<typeof callAzureOpenAI>
const mockedFindUnique = prisma.adminItemSmartVisual.findUnique as jest.Mock
const mockedUsageCreate = prisma.tokenUsageLog.create as jest.Mock

const pageItem = (overrides: Partial<AdminToolkitPageItem> = {}): AdminToolkitPageItem => ({
  id: 'item-1',
  type: 'PAGE',
  title: 'Fire safety',
  categoryId: null,
  warningLevel: null,
  contentHtml: null,
  contentJson: {
    blocks: [
      { type: 'INTRO_TEXT', html: '<p>What to do in a fire.</p>' },
      {
        type: 'ROLE_CARDS',
        id: 'rc-1',
        title: 'Who does what',
        layout: 'grid',
        columns: 3,
        cards: [
          { id: 'card-a', title: 'Reception', body: '- Raise the alarm', orderIndex: 0 },
          { id: 'card-b', title: 'Manager', body: '- Sweep the floor', orderIndex: 1 },
        ],
      },
      { type: 'FOOTER_TEXT', html: '<p>Assemble in the rear car park.</p>' },
    ],
  },
  lastReviewedAt: null,
  updatedAt: new Date('2026-07-01'),
  createdAt: new Date('2026-06-01'),
  ownerUserId: null,
  editors: [],
  editGrants: [],
  attachments: [],
  ...overrides,
})

const listItem = (overrides: Partial<AdminToolkitPageItem> = {}): AdminToolkitPageItem => ({
  ...pageItem(),
  id: 'item-2',
  type: 'LIST',
  title: 'Phone directory',
  contentJson: null,
  listColumns: [
    { id: 'col-b', key: 'phone', label: 'Phone', fieldType: 'PHONE', orderIndex: 1 },
    { id: 'col-a', key: 'name', label: 'Name', fieldType: 'TEXT', orderIndex: 0 },
  ],
  listRows: [
    { id: 'row-2', dataJson: { name: 'District nurses', phone: '0113 200 0002', ignored: 'x' }, orderIndex: 1 },
    { id: 'row-1', dataJson: { name: 'Podiatry', phone: '0113 200 0001' }, orderIndex: 0 },
  ],
  ...overrides,
})

const aiResponse = (content: string) => ({
  content,
  model: 'gpt-4o-mini',
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
})

const validLayoutJson = JSON.stringify({
  version: 1,
  sections: [{ type: 'summary', text: 'Fire safety at a glance.' }],
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('computeSmartVisualFingerprint', () => {
  it('is deterministic for identical content', () => {
    expect(computeSmartVisualFingerprint(pageItem())).toBe(computeSmartVisualFingerprint(pageItem()))
    expect(computeSmartVisualFingerprint(pageItem())).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes when the title, warning level, intro or a role card body changes', () => {
    const base = computeSmartVisualFingerprint(pageItem())
    expect(computeSmartVisualFingerprint(pageItem({ title: 'Fire safety v2' }))).not.toBe(base)
    expect(computeSmartVisualFingerprint(pageItem({ warningLevel: 'Urgent' }))).not.toBe(base)

    const changedIntro = pageItem()
    ;(changedIntro.contentJson as { blocks: Array<{ type: string; html?: string }> }).blocks[0].html = '<p>Changed.</p>'
    expect(computeSmartVisualFingerprint(changedIntro)).not.toBe(base)

    const changedCard = pageItem()
    ;(changedCard.contentJson as { blocks: Array<{ type: string; cards?: Array<{ body: string }> }> }).blocks[1].cards![0].body =
      '- Do something else'
    expect(computeSmartVisualFingerprint(changedCard)).not.toBe(base)
  })

  it('does not change when role card ids change', () => {
    const base = computeSmartVisualFingerprint(pageItem())
    const newIds = pageItem()
    const blocks = (newIds.contentJson as { blocks: Array<{ type: string; cards?: Array<{ id: string }> }> }).blocks
    blocks[1].cards![0].id = 'totally-different-id'
    expect(computeSmartVisualFingerprint(newIds)).toBe(base)
  })

  it('uses legacy contentHtml as the footer when no FOOTER_TEXT block exists', () => {
    const legacy = pageItem({
      contentJson: null,
      contentHtml: '<p>Legacy body text.</p>',
    })
    const legacyChanged = pageItem({
      contentJson: null,
      contentHtml: '<p>Different legacy body.</p>',
    })
    expect(computeSmartVisualFingerprint(legacy)).not.toBe(computeSmartVisualFingerprint(legacyChanged))
  })

  it('changes when a list cell or column order changes', () => {
    const base = computeSmartVisualFingerprint(listItem())
    const changedCell = listItem()
    ;(changedCell.listRows![0].dataJson as Record<string, unknown>).phone = '0113 999 9999'
    expect(computeSmartVisualFingerprint(changedCell)).not.toBe(base)

    const reordered = listItem()
    reordered.listColumns = reordered.listColumns!.map((c) =>
      c.key === 'phone' ? { ...c, orderIndex: 0 } : { ...c, orderIndex: 1 },
    )
    expect(computeSmartVisualFingerprint(reordered)).not.toBe(base)
  })

  it('does not change when list row ids change', () => {
    const base = computeSmartVisualFingerprint(listItem())
    const newIds = listItem()
    newIds.listRows = newIds.listRows!.map((r, i) => ({ ...r, id: `new-${i}` }))
    expect(computeSmartVisualFingerprint(newIds)).toBe(base)
  })
})

describe('buildSmartVisualSourceText', () => {
  it('serializes PAGE content with intro, role cards and footer', () => {
    const { text, truncated } = buildSmartVisualSourceText(pageItem({ warningLevel: 'High' }))
    expect(truncated).toBe(false)
    expect(text).toContain('TITLE: Fire safety')
    expect(text).toContain('WARNING LEVEL: High')
    expect(text).toContain('What to do in a fire.')
    expect(text).toContain('### Reception')
    expect(text).toContain('- Raise the alarm')
    expect(text).toContain('Assemble in the rear car park.')
  })

  it('serializes LIST content in column order and ignores undeclared keys', () => {
    const { text } = buildSmartVisualSourceText(listItem())
    expect(text).toContain('Name (TEXT) | Phone (PHONE)')
    expect(text).toContain('Podiatry | 0113 200 0001')
    expect(text).not.toContain('ignored')
  })

  it('caps LIST rows at 60 and flags truncation', () => {
    const bigList = listItem({
      listRows: Array.from({ length: 75 }, (_, i) => ({
        id: `row-${i}`,
        dataJson: { name: `Service ${i}`, phone: `0113 ${i}` },
        orderIndex: i,
      })),
    })
    const { text, truncated } = buildSmartVisualSourceText(bigList)
    expect(truncated).toBe(true)
    expect(text).toContain('... and 15 more rows (omitted)')
    expect(text).not.toContain('Service 70 |')
  })

  it('truncates very long content at the character guard', () => {
    const huge = pageItem({
      contentJson: { blocks: [{ type: 'INTRO_TEXT', html: `<p>${'word '.repeat(10000)}</p>` }] },
    })
    const { text, truncated } = buildSmartVisualSourceText(huge)
    expect(truncated).toBe(true)
    expect(text.length).toBeLessThan(16200)
    expect(text).toContain('[truncated')
  })
})

describe('smartVisualItemHasContent', () => {
  it('is true for a PAGE with blocks and false for an empty PAGE', () => {
    expect(smartVisualItemHasContent(pageItem())).toBe(true)
    expect(smartVisualItemHasContent(pageItem({ contentJson: null, contentHtml: null }))).toBe(false)
  })

  it('requires both columns and rows for a LIST', () => {
    expect(smartVisualItemHasContent(listItem())).toBe(true)
    expect(smartVisualItemHasContent(listItem({ listRows: [] }))).toBe(false)
  })
})

describe('generateSmartVisualLayout', () => {
  it('returns a validated layout and logs one usage row on the happy path', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(aiResponse(validLayoutJson))

    const result = await generateSmartVisualLayout(pageItem(), 'admin@example.nhs.uk')

    expect(result.layout.sections[0]).toEqual({ type: 'summary', text: 'Fire safety at a glance.' })
    expect(result.modelUsed).toBe('gpt-4o-mini')
    expect(result.sourceFingerprint).toBe(computeSmartVisualFingerprint(pageItem()))
    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(1)
    expect(mockedUsageCreate).toHaveBeenCalledTimes(1)
    expect(mockedUsageCreate.mock.calls[0][0].data).toMatchObject({
      route: 'handbookSmartVisual',
      userEmail: 'admin@example.nhs.uk',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    })
  })

  it('retries once with the validation errors and sums tokens across attempts', async () => {
    mockedCallAzureOpenAI
      .mockResolvedValueOnce(aiResponse(JSON.stringify({ version: 1, sections: [{ type: 'nonsense' }] })))
      .mockResolvedValueOnce(aiResponse(validLayoutJson))

    const result = await generateSmartVisualLayout(pageItem(), 'admin@example.nhs.uk')

    expect(result.layout.sections).toHaveLength(1)
    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(2)

    // The corrective turn feeds back the first raw answer plus the problems.
    const retryMessages = mockedCallAzureOpenAI.mock.calls[1][0].messages
    expect(retryMessages).toHaveLength(4)
    expect(retryMessages[2].role).toBe('assistant')
    expect(retryMessages[3].content).toContain('not a valid layout')

    expect(mockedUsageCreate).toHaveBeenCalledTimes(1)
    expect(mockedUsageCreate.mock.calls[0][0].data).toMatchObject({
      promptTokens: 200,
      completionTokens: 100,
      totalTokens: 300,
    })
  })

  it('throws after two invalid responses but still logs usage', async () => {
    mockedCallAzureOpenAI
      .mockResolvedValueOnce(aiResponse('not json at all'))
      .mockResolvedValueOnce(aiResponse('still not json'))

    await expect(generateSmartVisualLayout(pageItem(), 'admin@example.nhs.uk')).rejects.toThrow(
      'invalid layout',
    )
    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(2)
    expect(mockedUsageCreate).toHaveBeenCalledTimes(1)
  })
})

describe('getAdminToolkitSmartVisualForItem', () => {
  const storedLayout = { version: 1, sections: [{ type: 'summary', text: 'Stored visual.' }] }

  it('returns the stored layout with isStale=false when fingerprints match', async () => {
    const item = pageItem()
    mockedFindUnique.mockResolvedValueOnce({
      layoutJson: storedLayout,
      sourceFingerprint: computeSmartVisualFingerprint(item),
      generatedAt: new Date('2026-07-10'),
      modelUsed: 'gpt-4o-mini',
    })

    const visual = await getAdminToolkitSmartVisualForItem(item)
    expect(visual).not.toBeNull()
    expect(visual!.isStale).toBe(false)
    expect(visual!.layout.sections[0]).toEqual({ type: 'summary', text: 'Stored visual.' })
  })

  it('flags the visual stale when the item content has changed', async () => {
    mockedFindUnique.mockResolvedValueOnce({
      layoutJson: storedLayout,
      sourceFingerprint: computeSmartVisualFingerprint(pageItem()),
      generatedAt: new Date('2026-07-10'),
      modelUsed: 'gpt-4o-mini',
    })

    const visual = await getAdminToolkitSmartVisualForItem(pageItem({ title: 'Fire safety v2' }))
    expect(visual!.isStale).toBe(true)
  })

  it('returns null when no row exists or the stored layout is invalid', async () => {
    mockedFindUnique.mockResolvedValueOnce(null)
    expect(await getAdminToolkitSmartVisualForItem(pageItem())).toBeNull()

    mockedFindUnique.mockResolvedValueOnce({
      layoutJson: { version: 99, sections: [] },
      sourceFingerprint: 'x',
      generatedAt: new Date(),
      modelUsed: null,
    })
    expect(await getAdminToolkitSmartVisualForItem(pageItem())).toBeNull()
  })
})
