import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, formatPhone, normalizePhone, selfSignup } from '@plataforma/sdk'
import { Alert, Button, TextField } from '@plataforma/ui'
import { SIGNUP_MESSAGES } from './signupMessages'

/**
 * Alta por QR (D-032): la persona escanea el cartel del mostrador, pone su nombre
 * y su celular y recibe la tarjeta. Las dos casillas van sin tildar.
 */
export function SignupPage({
  code,
  onCreated,
}: {
  code: string
  onCreated: (token: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [terms, setTerms] = useState(false)
  const [whatsapp, setWhatsapp] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const normalized = normalizePhone(phone)
  const phoneInvalid = phone.trim() !== '' && normalized === null

  const signUp = useMutation({
    mutationFn: () =>
      selfSignup.signUp(code, {
        name: name.trim(),
        phone: normalized ?? '',
        termsAccepted: terms,
        whatsapp,
      }),
    onSuccess: (result) => {
      if (result.status === 'created' && result.token) onCreated(result.token)
      else setMessage(SIGNUP_MESSAGES[result.status])
    },
    onError: (err) => setMessage(errorMessage(err)),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    signUp.mutate()
  }

  const canSubmit = name.trim().length >= 2 && normalized !== null && terms

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sumate al club</h1>
        <p className="text-sm text-slate-600">
          Anotate en un minuto y juntá puntos cada vez que venís.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {message && <Alert tone="error">{message}</Alert>}
        <TextField
          label="Tu nombre"
          autoComplete="given-name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Tu celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="11 2233-4455"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneInvalid ? 'No reconocemos ese número. Ej: 11 2233-4455' : null}
          hint={normalized ? `Se guarda como ${formatPhone(normalized)}` : undefined}
        />
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
          />
          <span>
            Acepto que el negocio guarde mi nombre y celular para el programa de puntos. Puedo pedir
            que los borren cuando quiera.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5"
            checked={whatsapp}
            onChange={(e) => setWhatsapp(e.target.checked)}
          />
          <span>Quiero recibir promociones por WhatsApp (opcional).</span>
        </label>
        <Button type="submit" size="lg" loading={signUp.isPending} disabled={!canSubmit}>
          Quiero mi tarjeta
        </Button>
      </form>
    </main>
  )
}
