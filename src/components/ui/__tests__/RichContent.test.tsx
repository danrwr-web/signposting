import { fireEvent, render, screen } from '@testing-library/react'
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

    it('closes when the empty area of the stage is tapped', async () => {
      const user = await openLightbox()

      await user.click(screen.getByTestId('image-lightbox-stage'))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('zoom', () => {
    async function openLightbox() {
      const user = userEvent.setup()
      const { container } = render(<RichContent html={HTML_WITH_IMAGE} />)
      await user.click(container.querySelector('img') as HTMLImageElement)
      return user
    }

    const transform = () => (lightboxImage() as HTMLImageElement).style.transform

    it('opens fitted to the viewport at 100% with no offset', async () => {
      await openLightbox()

      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(transform()).toBe('translate(0px, 0px) scale(1)')
      expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeDisabled()
    })

    it('zooms in and back out with the toolbar buttons', async () => {
      const user = await openLightbox()

      await user.click(screen.getByRole('button', { name: 'Zoom in' }))
      expect(screen.getByText('150%')).toBeInTheDocument()
      expect(transform()).toContain('scale(1.5)')

      await user.click(screen.getByRole('button', { name: 'Zoom out' }))
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('zooms with the + and - keys and resets with 0', async () => {
      const user = await openLightbox()

      await user.keyboard('+')
      expect(screen.getByText('150%')).toBeInTheDocument()

      await user.keyboard('+')
      expect(screen.getByText('225%')).toBeInTheDocument()

      await user.keyboard('0')
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(transform()).toBe('translate(0px, 0px) scale(1)')
    })

    it('caps zoom at 600% and never goes below the fitted view', async () => {
      const user = await openLightbox()

      for (let i = 0; i < 10; i++) await user.keyboard('+')
      expect(screen.getByText('600%')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()

      for (let i = 0; i < 10; i++) await user.keyboard('-')
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
    })

    it('resets zoom via the reset button', async () => {
      const user = await openLightbox()

      await user.click(screen.getByRole('button', { name: 'Zoom in' }))
      await user.click(screen.getByRole('button', { name: 'Reset zoom' }))

      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(transform()).toBe('translate(0px, 0px) scale(1)')
    })

    /**
     * Once zoomed, the stage takes pointer capture so panning survives the pointer
     * leaving the image — which retargets the following `pointerup` to the stage.
     * jsdom has no `setPointerCapture`, so `userEvent` can't reproduce that; these
     * dispatch the retargeted sequence a real browser delivers.
     */
    describe('while zoomed (stage holds pointer capture)', () => {
      async function openZoomed() {
        const user = await openLightbox()
        await user.click(screen.getByRole('button', { name: 'Zoom in' }))
        return user
      }

      it('a tap on the image does not close the viewer', async () => {
        await openZoomed()
        const image = lightboxImage() as HTMLImageElement

        fireEvent.pointerDown(image, { pointerId: 1 })
        fireEvent.pointerUp(screen.getByTestId('image-lightbox-stage'), { pointerId: 1 })

        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      it('a tap on the empty stage still closes the viewer', async () => {
        await openZoomed()
        const stage = screen.getByTestId('image-lightbox-stage')

        fireEvent.pointerDown(stage, { pointerId: 1 })
        fireEvent.pointerUp(stage, { pointerId: 1 })

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      it('double-clicking the image resets to the fitted view', async () => {
        const user = await openZoomed()
        expect(screen.getByText('150%')).toBeInTheDocument()

        await user.dblClick(lightboxImage() as HTMLImageElement)

        expect(screen.getByText('100%')).toBeInTheDocument()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('starts each newly opened image back at the fitted view', async () => {
      const user = await openLightbox()

      await user.click(screen.getByRole('button', { name: 'Zoom in' }))
      expect(screen.getByText('150%')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      await user.click(screen.getAllByRole('button', { name: /Enlarge image/ })[0])

      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })
})
