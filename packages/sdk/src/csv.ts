/**
 * Lector de CSV sin dependencias. Soporta comillas, comillas escapadas (""),
 * saltos de línea dentro de comillas, BOM y separador ',', ';' o tab
 * (Excel en castellano suele exportar con ';').
 */
const BOM = String.fromCharCode(0xfeff)

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text
}

export function detectDelimiter(text: string): string {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? ''
  const candidates = [';', ',', '\t']
  let best = ','
  let bestCount = 0
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

export function parseCsv(input: string, delimiter = detectDelimiter(input)): string[][] {
  const text = stripBom(input)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Descartar filas completamente vacías.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/** Genera un CSV (separador ';' para que Excel en castellano lo abra bien). */
export function toCsv(rows: string[][], delimiter = ';'): string {
  const escape = (value: string) =>
    /["\n\r]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value
  return BOM + rows.map((row) => row.map(escape).join(delimiter)).join('\r\n') + '\r\n'
}
