/**
 * Smoke tests for the RichTextEditor public contract.
 *
 * The critical invariant: `onChange` must NEVER fire on mount with stored
 * HTML. `src/server/aiRerunPlan.ts` compares stored `instructionsHtml` to
 * history by exact string equality, so a mount-time re-serialization would
 * reclassify every AI-edited symptom as human-edited.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import RichTextEditor from '@/components/rich-text/RichTextEditor'

// TipTap needs a few DOM APIs jsdom does not implement.
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint = () => null
})

const STORED_HTML =
  '<p class="prose-p">If <span style="color: #DA020E;">chest pain</span> call 999.</p>'

describe('RichTextEditor', () => {
  it('renders stored HTML without firing onChange on mount', async () => {
    const onChange = jest.fn()
    render(<RichTextEditor docId="doc-1" value={STORED_HTML} onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByText(/chest pain/)).toBeInTheDocument()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the toolbar when editable', async () => {
    render(<RichTextEditor docId="doc-2" value="<p>x</p>" onChange={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByTitle('Bold')).toBeInTheDocument()
    })
    expect(screen.getByTitle('Bullet list')).toBeInTheDocument()
  })

  it('hides the toolbar when readOnly', async () => {
    render(<RichTextEditor docId="doc-3" value="<p>read only</p>" onChange={jest.fn()} readOnly />)

    await waitFor(() => {
      expect(screen.getByText('read only')).toBeInTheDocument()
    })
    expect(screen.queryByTitle('Bold')).not.toBeInTheDocument()
  })
})
