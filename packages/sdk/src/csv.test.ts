import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, toCsv } from './csv.ts'

describe('parseCsv', () => {
  it('parses Excel-style semicolon files with BOM', () => {
    const text =
      String.fromCharCode(0xfeff) + 'Nombre;Teléfono\r\nAna;11 2233-4455\r\nDon Carlos;\r\n'
    expect(detectDelimiter(text)).toBe(';')
    expect(parseCsv(text)).toEqual([
      ['Nombre', 'Teléfono'],
      ['Ana', '11 2233-4455'],
      ['Don Carlos', ''],
    ])
  })

  it('handles quotes, escaped quotes and newlines inside quotes', () => {
    const text = 'name,notes\n"Gómez, Ana","Dice ""hola""\ny chau"\n'
    expect(parseCsv(text)).toEqual([
      ['name', 'notes'],
      ['Gómez, Ana', 'Dice "hola"\ny chau'],
    ])
  })

  it('skips empty lines', () => {
    expect(parseCsv('a,b\n\n1,2\n   \n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('round-trips through toCsv', () => {
    const rows = [
      ['Nombre', 'Notas'],
      ['Ana; Gómez', 'Dice "hola"'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})
