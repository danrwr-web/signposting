import { extractAppointmentImageIds } from '@/lib/appointmentUploads'

describe('extractAppointmentImageIds', () => {
  it('collects ids from appointment image URLs in HTML', () => {
    const html =
      '<p><img src="/api/appointment-images/clxaaa111" alt="" /></p>' +
      '<p><img src="/api/appointment-images/clxbbb222" width="320" /></p>'
    expect(extractAppointmentImageIds(html)).toEqual(['clxaaa111', 'clxbbb222'])
  })

  it('deduplicates repeated ids and skips null/empty content', () => {
    const html = '<img src="/api/appointment-images/clxaaa111"><img src="/api/appointment-images/clxaaa111">'
    expect(extractAppointmentImageIds(html, null, undefined, '')).toEqual(['clxaaa111'])
  })

  it('ignores other modules\' image routes', () => {
    expect(
      extractAppointmentImageIds(
        '<img src="/api/symptom-images/clxccc333"><img src="/api/admin-toolkit/images/clxddd444">'
      )
    ).toEqual([])
  })

  it('returns an empty array for content without images', () => {
    expect(extractAppointmentImageIds('<p>No images here</p>')).toEqual([])
  })
})
