import { describe, expect, it } from 'vitest'
import { buildImportRows, detectColumns } from './customerImport.ts'

describe('detectColumns', () => {
  it('recognizes Spanish headers with accents and case', () => {
    expect(detectColumns(['Nombre', 'Apellido', 'TELÉFONO', 'Correo', 'Observaciones'])).toEqual({
      name: 0,
      lastName: 1,
      phone: 2,
      email: 3,
      notes: 4,
    })
  })

  it('leaves unknown columns unmapped', () => {
    expect(detectColumns(['Cliente', 'Puntos'])).toEqual({
      name: 0,
      lastName: null,
      phone: null,
      email: null,
      notes: null,
    })
  })
})

describe('buildImportRows', () => {
  const mapping = { name: 0, lastName: null, phone: 1, email: 2, notes: null }

  it('normalizes valid rows and reports invalid ones with their line number', () => {
    const { valid, invalid } = buildImportRows(
      [
        ['Ana', '11 2233-4455', 'ANA@mail.com'],
        ['', '11 5555-5555', ''],
        ['Pedro', '123', ''],
        ['Luis', '', 'no-es-mail'],
        ['Ana bis', '+54 9 11 2233 4455', ''],
        ['Don Carlos', '', ''],
      ],
      mapping,
    )
    expect(valid).toEqual([
      { line: 2, name: 'Ana', phone: '+5491122334455', email: 'ana@mail.com', notes: null },
      { line: 7, name: 'Don Carlos', phone: null, email: null, notes: null },
    ])
    expect(invalid.map((row) => [row.line, row.reason])).toEqual([
      [3, 'invalid_name'],
      [4, 'invalid_phone'],
      [5, 'invalid_email'],
      [6, 'duplicate_phone'],
    ])
  })

  it('joins first and last name columns', () => {
    const { valid } = buildImportRows([['Ana', 'Gómez']], {
      name: 0,
      lastName: 1,
      phone: null,
      email: null,
      notes: null,
    })
    expect(valid[0]?.name).toBe('Ana Gómez')
  })
})
