import { useRef, useState, type ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  businesses,
  errorMessage,
  LOGO_ACCEPT,
  logoFileError,
  type MyBusiness,
} from '@plataforma/sdk'
import { Alert, Button, Card, useToast } from '@plataforma/ui'
import { useInvalidateMyBusinesses } from './queries'

/** Logo del negocio: se muestra en la tarjeta de los clientes. */
export function LogoUploader({ business }: { business: MyBusiness }) {
  const toast = useToast()
  const invalidate = useInvalidateMyBusinesses()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const src = businesses.logoUrl(business.logoPath)

  const upload = useMutation({
    mutationFn: (file: File) => businesses.uploadLogo(business.id, file),
    onSuccess: async () => {
      await invalidate()
      toast.show('Logo actualizado', 'success')
    },
    onError: (err) => setError(errorMessage(err)),
  })

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    setError(null)
    const invalid = logoFileError(file)
    if (invalid) return setError(invalid)
    upload.mutate(file)
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Logo</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex items-center gap-4">
        {src ? (
          <img
            src={src}
            alt={`Logo de ${business.name}`}
            className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-contain"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
            Sin logo
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button
            variant="secondary"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {src ? 'Cambiar logo' : 'Subir logo'}
          </Button>
          <p className="text-xs text-slate-500">PNG, JPG, WebP o SVG. Hasta 1 MB.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        aria-label="Archivo del logo"
        className="hidden"
        onChange={handleFile}
      />
    </Card>
  )
}
