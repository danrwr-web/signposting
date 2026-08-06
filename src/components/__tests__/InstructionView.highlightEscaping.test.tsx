/**
 * InstructionView highlights two different kinds of content and must treat
 * them differently:
 *
 * - `instructionsHtml` (and variant instructions) is rich text: highlight the
 *   HTML in place, then sanitise. Tags have to survive.
 * - `briefInstruction` and `highlightedText` are plain-text fields authored in
 *   an <input>/<textarea>. Tags must NOT survive — they render as literal text.
 *
 * These tests pin both halves so neither path picks up the other's treatment.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import InstructionView from '@/components/InstructionView'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}))

jest.mock('@/context/SurgeryContext', () => ({
  useSurgery: () => ({ currentSurgeryId: 's1' }),
}))

jest.mock('@/context/CardStyleContext', () => ({
  useCardStyle: () => ({ cardStyle: 'default' }),
}))

jest.mock('react-hot-toast', () => {
  const toast = (..._args: any[]) => {}
  ;(toast as any).error = jest.fn()
  ;(toast as any).success = jest.fn()
  return { toast }
})

jest.mock('@/components/rich-text/RichTextEditor', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/SuggestFeatureDialog', () => ({
  __esModule: true,
  default: () => null,
}))

const HIGHLIGHT_RULE = {
  id: 'rule-1',
  phrase: 'pharmacy first',
  textColor: '#ffffff',
  bgColor: '#6A0DAD',
  isEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function installFetchMock() {
  // @ts-expect-error override global fetch for test
  global.fetch = jest.fn(async (input: any) => {
    const url = typeof input === 'string' ? input : input?.url
    if (typeof url === 'string' && url.startsWith('/api/highlights')) {
      return new Response(
        JSON.stringify({ highlights: [HIGHLIGHT_RULE], enableImageIcons: false }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })
}

const symptom = (overrides: Record<string, unknown>) =>
  ({
    id: 'base-1',
    name: 'Fever',
    ageGroup: 'Adult',
    briefInstruction: null,
    highlightedText: null,
    instructions: null,
    instructionsHtml: null,
    linkToPage: null,
    variants: null,
    source: 'base',
    ...overrides,
  }) as any

describe('InstructionView content highlighting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    installFetchMock()
  })

  it('keeps real markup in the instruction body', async () => {
    const { container } = render(
      <InstructionView
        symptom={symptom({
          instructionsHtml: '<p>Offer <strong>pharmacy first</strong> where suitable</p>',
        })}
        surgeryId="s1"
      />
    )

    await waitFor(() => {
      expect(container.querySelector('strong')).not.toBeNull()
    })
    expect(container.querySelector('strong')).toHaveTextContent('pharmacy first')
  })

  it('highlights a matching phrase inside the instruction body', async () => {
    const { container } = render(
      <InstructionView
        symptom={symptom({ instructionsHtml: '<p>Try pharmacy first</p>' })}
        surgeryId="s1"
      />
    )

    await waitFor(() => {
      expect(container.querySelector('span[style*="#6A0DAD"]')).not.toBeNull()
    })
  })

  it('does not create live elements from markup in briefInstruction', async () => {
    const { container } = render(
      <InstructionView
        symptom={symptom({
          briefInstruction: '<img src="x" onerror="window.__xss = true"> Route to pharmacy first',
        })}
        surgeryId="s1"
      />
    )

    await waitFor(() => {
      expect(container.querySelector('span[style*="#6A0DAD"]')).not.toBeNull()
    })
    // The rule still fired, but the tag never became an element.
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(/<img src="x" onerror="window.__xss = true">/)).toBeInTheDocument()
  })

  it('does not create live elements from markup in highlightedText', async () => {
    const { container } = render(
      <InstructionView
        symptom={symptom({
          highlightedText: '<iframe src="https://evil.example"></iframe> Do not book online',
        })}
        surgeryId="s1"
      />
    )

    await screen.findByText(/Do not book online/)
    expect(container.querySelector('iframe')).toBeNull()
  })
})
