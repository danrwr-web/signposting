import { extractAdminToolkitUploadIds } from '@/lib/adminToolkitUploads'

describe('extractAdminToolkitUploadIds', () => {
  it('extracts image and file ids from handbook HTML', () => {
    const html =
      '<p><img src="/api/admin-toolkit/images/clximg1" alt="" /> ' +
      '<a href="/api/admin-toolkit/files/clxfile1">SOP</a> ' +
      '<img src="/api/admin-toolkit/images/clximg2" alt="x" /></p>'
    expect(extractAdminToolkitUploadIds(html)).toEqual({
      imageIds: ['clximg1', 'clximg2'],
      fileIds: ['clxfile1'],
    })
  })

  it('dedupes repeated references', () => {
    const html =
      '<p><img src="/api/admin-toolkit/images/clximg1" /><img src="/api/admin-toolkit/images/clximg1" /></p>'
    expect(extractAdminToolkitUploadIds(html)).toEqual({ imageIds: ['clximg1'], fileIds: [] })
  })

  it('ignores other urls and empty input', () => {
    expect(extractAdminToolkitUploadIds('<p><a href="https://nhs.uk">x</a></p>')).toEqual({
      imageIds: [],
      fileIds: [],
    })
    expect(extractAdminToolkitUploadIds('')).toEqual({ imageIds: [], fileIds: [] })
  })
})
