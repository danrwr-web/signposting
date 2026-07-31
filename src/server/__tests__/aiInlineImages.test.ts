import { stashInlineImages, restoreInlineImages } from '@/server/aiInlineImages'

const IMG_A = '<img src="/api/symptom-images/imgaaa111" alt="Triage chart" width="320" />'
const IMG_B = '<img src="/api/symptom-images/imgbbb222" alt="">'

describe('stashInlineImages', () => {
  it('replaces each img tag with a numbered placeholder', () => {
    const { html, images } = stashInlineImages(`<p>Before ${IMG_A} middle ${IMG_B} after</p>`)
    expect(html).toBe('<p>Before [[IMAGE_1]] middle [[IMAGE_2]] after</p>')
    expect(images).toEqual([IMG_A, IMG_B])
  })

  it('leaves image-free content untouched', () => {
    const { html, images } = stashInlineImages('<p>No images here</p>')
    expect(html).toBe('<p>No images here</p>')
    expect(images).toEqual([])
  })
})

describe('restoreInlineImages', () => {
  it('substitutes original tags back for their placeholders', () => {
    const { html, images } = stashInlineImages(`<p>${IMG_A}</p><p>${IMG_B}</p>`)
    expect(restoreInlineImages(html, images)).toBe(`<p>${IMG_A}</p><p>${IMG_B}</p>`)
  })

  it('restores placeholders the model moved', () => {
    const images = [IMG_A]
    const rewritten = '<ul><li>Step one [[IMAGE_1]]</li></ul>'
    expect(restoreInlineImages(rewritten, images)).toBe(`<ul><li>Step one ${IMG_A}</li></ul>`)
  })

  it('appends images whose placeholders the model dropped', () => {
    const images = [IMG_A, IMG_B]
    const rewritten = '<p>Rewritten with [[IMAGE_2]] only</p>'
    const restored = restoreInlineImages(rewritten, images)
    expect(restored).toContain(IMG_B)
    expect(restored).toContain(`<p>${IMG_A}</p>`)
  })

  it('appends all images when the model dropped every placeholder', () => {
    const restored = restoreInlineImages('<p>Plain rewrite</p>', [IMG_A, IMG_B])
    expect(restored).toBe(`<p>Plain rewrite</p>\n<p>${IMG_A} ${IMG_B}</p>`)
  })

  it('removes unknown and duplicated placeholders instead of leaking tokens', () => {
    const restored = restoreInlineImages('<p>[[IMAGE_1]] again [[IMAGE_1]] and [[IMAGE_9]]</p>', [IMG_A])
    expect(restored).toBe(`<p>${IMG_A} again  and </p>`)
    expect(restored).not.toContain('[[IMAGE')
  })

  it('is a no-op when nothing was stashed', () => {
    expect(restoreInlineImages('<p>Whatever [[IMAGE_1]]</p>', [])).toBe('<p>Whatever [[IMAGE_1]]</p>')
  })
})
