import * as XLSX from 'xlsx'
import { parseExcelFile } from '@/lib/excel-parser'

function makeExcelBuffer(rows: Array<Record<string, string>>): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Symptoms')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

describe('parseExcelFile LinkToPage column', () => {
  it('splits semicolon-separated names into linkToPages', () => {
    const buffer = makeExcelBuffer([
      {
        Symptom: 'Chest pain',
        AgeGroup: 'Adult',
        Instructions: 'Call 999',
        // Semicolons, not commas: symptom names can contain commas.
        LinkToPage: 'Breathing problems; Coughs, colds and flu ;Palpitations',
      },
    ])
    const [symptom] = parseExcelFile(buffer)
    expect(symptom.linkToPages).toEqual(['Breathing problems', 'Coughs, colds and flu', 'Palpitations'])
    expect(symptom.linkToPage).toBe('Breathing problems')
  })

  it('keeps a single name as a one-entry array', () => {
    const buffer = makeExcelBuffer([
      { Symptom: 'Gout', AgeGroup: 'Adult', Instructions: 'Advise', LinkToPage: 'Joint pain' },
    ])
    const [symptom] = parseExcelFile(buffer)
    expect(symptom.linkToPages).toEqual(['Joint pain'])
    expect(symptom.linkToPage).toBe('Joint pain')
  })

  it('leaves both fields unset when the column is blank', () => {
    const buffer = makeExcelBuffer([
      { Symptom: 'Gout', AgeGroup: 'Adult', Instructions: 'Advise', LinkToPage: '' },
    ])
    const [symptom] = parseExcelFile(buffer)
    expect(symptom.linkToPages).toBeUndefined()
    expect(symptom.linkToPage).toBeUndefined()
  })
})
