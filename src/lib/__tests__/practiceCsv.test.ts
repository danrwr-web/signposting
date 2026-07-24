import { parseListSizeCsv, parseExtractDate } from '../practiceCsv'

describe('parseListSizeCsv', () => {
  it('parses the standard all-practices file', () => {
    const csv = [
      'PUBLICATION,EXTRACT_DATE,TYPE,CODE,POSTCODE,SEX,AGE,NUMBER_OF_PATIENTS',
      'GP_PRAC_PAT_LIST,01JUL2026,GP,A12345,EX1 1AA,ALL,ALL,8900',
      'GP_PRAC_PAT_LIST,01JUL2026,GP,B67890,EX2 2BB,ALL,ALL,12345',
    ].join('\n')
    const result = parseListSizeCsv(csv)
    expect(result.rows).toEqual([
      { odsCode: 'A12345', listSize: 8900 },
      { odsCode: 'B67890', listSize: 12345 },
    ])
    expect(result.extractDate?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(result.skipped).toBe(0)
  })

  it('finds the header row when preceded by preamble lines', () => {
    const csv = [
      'Some title line',
      '',
      'CODE,NUMBER_OF_PATIENTS',
      'A12345,5000',
    ].join('\n')
    expect(parseListSizeCsv(csv).rows).toEqual([{ odsCode: 'A12345', listSize: 5000 }])
  })

  it('is column-order independent and strips quotes', () => {
    const csv = ['"NUMBER_OF_PATIENTS","CODE"', '"7000","C11111"'].join('\r\n')
    expect(parseListSizeCsv(csv).rows).toEqual([{ odsCode: 'C11111', listSize: 7000 }])
  })

  it('keeps only SEX=ALL / AGE=ALL rows when banded columns exist', () => {
    const csv = [
      'CODE,SEX,AGE,NUMBER_OF_PATIENTS',
      'A12345,MALE,0_4,120',
      'A12345,FEMALE,0_4,110',
      'A12345,ALL,ALL,8900',
    ].join('\n')
    const result = parseListSizeCsv(csv)
    expect(result.rows).toEqual([{ odsCode: 'A12345', listSize: 8900 }])
  })

  it('skips malformed rows and counts them', () => {
    const csv = [
      'CODE,NUMBER_OF_PATIENTS',
      'A12345,8900',
      'B67890,not-a-number',
      ',5000',
      'C22222,-5',
    ].join('\n')
    const result = parseListSizeCsv(csv)
    expect(result.rows).toEqual([{ odsCode: 'A12345', listSize: 8900 }])
    expect(result.skipped).toBe(3)
  })

  it('deduplicates ODS codes, last value winning', () => {
    const csv = ['CODE,NUMBER_OF_PATIENTS', 'A12345,100', 'A12345,200'].join('\n')
    expect(parseListSizeCsv(csv).rows).toEqual([{ odsCode: 'A12345', listSize: 200 }])
  })

  it('throws a descriptive error when the header is missing', () => {
    expect(() => parseListSizeCsv('foo,bar\n1,2')).toThrow(/CODE and NUMBER_OF_PATIENTS/)
  })
})

describe('parseExtractDate', () => {
  it('parses DDMONYYYY, ISO, and DD/MM/YYYY formats', () => {
    expect(parseExtractDate('01JUL2026')?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(parseExtractDate('2026-07-01')?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(parseExtractDate('01/07/2026')?.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('returns null for garbage', () => {
    expect(parseExtractDate('yesterday')).toBeNull()
    expect(parseExtractDate('01XYZ2026')).toBeNull()
    expect(parseExtractDate('')).toBeNull()
  })
})
