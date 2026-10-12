import { describe, expect, it } from 'vitest'
import { detectDelimiter, neutralizeFormula, parseCsv, toCsv } from './csv.ts'

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

  it('neutralizes cells that Excel would run as formulas', () => {
    expect(neutralizeFormula('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`)
    expect(neutralizeFormula('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(neutralizeFormula('+cmd|calc')).toBe("'+cmd|calc")
    expect(neutralizeFormula('-2+3+cmd')).toBe("'-2+3+cmd")
    expect(neutralizeFormula('+5491122334455')).toBe('+5491122334455')
    expect(neutralizeFormula('-150')).toBe('-150')
    expect(neutralizeFormula('Ana')).toBe('Ana')
    expect(parseCsv(toCsv([['=1+1']]))).toEqual([["'=1+1"]])
  })

  it('round-trips through toCsv', () => {
    const rows = [
      ['Nombre', 'Notas'],
      ['Ana; Gómez', 'Dice "hola"'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})
