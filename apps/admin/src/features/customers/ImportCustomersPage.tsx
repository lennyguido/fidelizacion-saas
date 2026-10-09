import { useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import {
  IMPORT_TEMPLATE,
  buildImportRows,
  customers,
  detectColumns,
  errorMessage,
  formatPhone,
  importRejectionLabels,
  parseCsv,
  toCsv,
  type ColumnMapping,
  type ImportField,
  type ImportRejection,
} from '@plataforma/sdk'
import { Alert, Button, Card, EmptyState } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { downloadText } from '../../lib/download'
import { useInvalidateCustomers } from './queries'

const BATCH_SIZE = 200
const MAX_FILE_BYTES = 5 * 1024 * 1024

const fieldLabels: Record<ImportField, string> = {
  name: 'Nombre (obligatorio)',
  lastName: 'Apellido',
  phone: 'Teléfono',
  email: 'Email',
  notes: 'Notas',
}

interface ParsedFile {
  fileName: string
  headers: string[]
  rows: string[][]
}

interface Outcome {
  inserted: number
  rejected: Array<{ line: number; reason: ImportRejection | string; values: string[] }>
}

export function ImportCustomersPage() {
  const { business } = useActiveBusiness()
  const invalidate = useInvalidateCustomers(business.id)
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const preview = useMemo(
    () => (file && mapping ? buildImportRows(file.rows, mapping) : null),
    [file, mapping],
  )

  if (business.role === 'staff') {
    return <EmptyState title="Solo el dueño o un administrador puede importar clientes" />
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    setError(null)
    setOutcome(null)
    if (!selected) return
    if (selected.size > MAX_FILE_BYTES) {
      setError('El archivo es muy grande (máximo 5 MB).')
      return
    }
    const rows = parseCsv(await selected.text())
    const [headers, ...data] = rows
    if (!headers || data.length === 0) {
      setError('El archivo está vacío o no tiene filas debajo del encabezado.')
      return
    }
    setFile({ fileName: selected.name, headers, rows: data })
    setMapping(detectColumns(headers))
  }

  async function handleImport() {
    if (!preview || preview.valid.length === 0) return
    setError(null)
    const rejected: Outcome['rejected'] = preview.invalid.map((row) => ({ ...row }))
    let inserted = 0
    const total = preview.valid.length
    setProgress({ done: 0, total })

    try {
      for (let start = 0; start < total; start += BATCH_SIZE) {
        const batch = preview.valid.slice(start, start + BATCH_SIZE)
        const result = await customers.importBatch(
          business.id,
          batch.map(({ name, phone, email, notes }) => ({ name, phone, email, notes })),
        )
        inserted += result.inserted
        for (const skipped of result.skipped) {
          const row = batch[skipped.index]
          if (row) {
            rejected.push({
              line: row.line,
              reason: skipped.reason,
              values: [row.name, row.phone ?? '', row.email ?? '', row.notes ?? ''],
            })
          }
        }
        setProgress({ done: Math.min(start + BATCH_SIZE, total), total })
      }
      setOutcome({ inserted, rejected: rejected.sort((a, b) => a.line - b.line) })
      setFile(null)
      setMapping(null)
      await invalidate()
    } catch (err) {
      setError(`${errorMessage(err)} Se importaron ${inserted} clientes antes del error.`)
    } finally {
      setProgress(null)
    }
  }

  function downloadErrors() {
    if (!outcome) return
    downloadText(
      'clientes-no-importados.csv',
      toCsv([
        ['Línea', 'Motivo', 'Datos'],
        ...outcome.rejected.map((row) => [
          String(row.line),
          importRejectionLabels[row.reason as ImportRejection] ?? row.reason,
          row.values.join(' | '),
        ]),
      ]),
    )
  }

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <Link to={`/b/${business.slug}/clientes`} className="text-sm text-slate-500 hover:underline">
        ← Clientes
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Importar clientes</h1>

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Subí un archivo CSV (desde Excel: <em>Guardar como → CSV</em>). Necesita al menos una
          columna con el nombre. Teléfono, email y notas son opcionales.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
            Elegir archivo
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>
          <Button
            variant="ghost"
            onClick={() => downloadText('plantilla-clientes.csv', toCsv(IMPORT_TEMPLATE))}
          >
            Descargar plantilla
          </Button>
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}

      {outcome && (
        <Alert tone={outcome.rejected.length === 0 ? 'success' : 'info'}>
          <p>
            Se importaron <strong>{outcome.inserted}</strong> clientes.
            {outcome.rejected.length > 0 && ` ${outcome.rejected.length} filas no se importaron.`}
          </p>
          {outcome.rejected.length > 0 && (
            <button type="button" onClick={downloadErrors} className="mt-2 font-medium underline">
              Descargar detalle de las filas no importadas
            </button>
          )}
        </Alert>
      )}

      {file && mapping && preview && (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Columnas de “{file.fileName}”</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(fieldLabels) as ImportField[]).map((field) => (
                <label key={field} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-800">{fieldLabels[field]}</span>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        [field]: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="h-10 rounded-lg border border-slate-300 bg-white px-2"
                  >
                    <option value="">— No usar —</option>
                    {file.headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Columna ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Vista previa</h2>
            <p className="text-sm text-slate-600">
              {preview.valid.length} listos para importar
              {preview.invalid.length > 0 &&
                ` · ${preview.invalid.length} con problemas (no se importan)`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">Nombre</th>
                    <th className="py-1 pr-3">Teléfono</th>
                    <th className="py-1 pr-3">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.slice(0, 8).map((row) => (
                    <tr key={row.line} className="border-t border-slate-100">
                      <td className="py-1 pr-3">{row.name}</td>
                      <td className="py-1 pr-3">{formatPhone(row.phone)}</td>
                      <td className="py-1 pr-3">{row.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.invalid.length > 0 && (
              <ul className="text-sm text-amber-800">
                {preview.invalid.slice(0, 5).map((row) => (
                  <li key={row.line}>
                    Línea {row.line}: {importRejectionLabels[row.reason]}
                  </li>
                ))}
              </ul>
            )}
            <Button
              size="lg"
              loading={progress !== null}
              disabled={mapping.name === null || preview.valid.length === 0}
              onClick={() => void handleImport()}
            >
              {progress
                ? `Importando ${progress.done}/${progress.total}…`
                : `Importar ${preview.valid.length} clientes`}
            </Button>
          </Card>
        </>
      )}
    </section>
  )
}
