import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RichContent } from '@/components/ui'

const IMAGE_SRC = '/api/appointment-images/img123'

const HTML_WITH_IMAGE = `<p>Room map below.</p><img src="${IMAGE_SRC}" alt="Room 4 map" width="320">`

/** The alt text is used both as the accessible name and the caption. */
function lightboxImage() {
  return screen.queryByRole('dialog')?.querySelector('img') ?? null
}

describe('RichContent', () => {
  it('renders the supplied HTML', () => {
    render(<RichContent html={HTML_WITH_IMAGE} />)

    expect(screen.getByText('Room map below.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enlarge image: Room 4 map' })).toBeInTheDocument()
  })

  it('makes inline images focusable and announced as buttons', () => {
    const { container } = render(<RichContent html={HTML_WITH_IMAGE} />)

    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toHaveAttribute('role', 'button')
    expect(img.tabIndex).toBe(0)
  })

  it('opens the lightbox with the clicked image when an image is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<RichContent html={HTML_WITH_IMAGE} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(container.querySelector('img') as HTMLImageElement)

    const dialog = screen.getByRole('dialog', { name: 'Enlarged image: Room 4 map' })
    expect(dialog).toBeInTheDocument()
    expect(lightboxImage()).toHaveAttribute('src', IMAGE_SRC)
    // The alt text doubles as a caption under the enlarged image.
    expect(dialog).toHaveTextContent('Room 4 map')
  })

  it('opens the lightbox when Enter is pressed on a focused image', async () => {
    const user = userEvent.setup()
    const { container } = render(<RichContent html={HTML_WITH_IMAGE} />)

    const img = container.querySelector('img') as HTMLImageElement
    img.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not open the lightbox when non-image content is clicked', async () => {
    const user = userEvent.setup()
    render(<RichContent html={HTML_WITH_IMAGE} />)

    await user.click(screen.getByText('Room map below.'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('leaves images inside links alone so the link still works', () => {
    const { container } = render(
      <RichContent html={`<a href="https://example.com"><img src="${IMAGE_SRC}" alt="Logo"></a>`} />
    )

    const img = container.querySelector('img') as HTMLImageElement
    expect(img).not.toHaveAttribute('role', 'button')
    expect(img.tabIndex).toBe(-1)
  })

  describe('closing the lightbox', () => {
    async function openLightbox() {
      const user = userEvent.setup()
      const { container } = render(<RichContent html={HTML_WITH_IMAGE} />)
      await user.click(container.querySelector('img') as HTMLImageElement)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      return user
    }

    it('closes on the close button', async () => {
      const user = await openLightbox()

      await user.click(screen.getByRole('button', { name: 'Close image' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes when the backdrop is clicked', async () => {
      const user = await openLightbox()
      const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]')

      await user.click(backdrop as HTMLElement)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes on Escape', async () => {
      const user = await openLightbox()

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('does not close when the enlarged image itself is clicked', async () => {
      const user = await openLightbox()

      await user.click(lightboxImage() as HTMLImageElement)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
