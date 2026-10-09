import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { auth, errorMessage } from '@plataforma/sdk'
import { Alert, Button, TextField } from '@plataforma/ui'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await auth.sendPasswordReset(email.trim(), `${window.location.origin}/reset-password`)
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Recuperá tu contraseña">
      {sent ? (
        <Alert tone="success">
          Si existe una cuenta con ese email, te llega un link para elegir una contraseña nueva.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!email}>
            Enviar link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-slate-600 underline-offset-4 hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </AuthLayout>
  )
}
