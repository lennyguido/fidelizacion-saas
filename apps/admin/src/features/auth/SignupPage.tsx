import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { auth, errorMessage } from '@plataforma/sdk'
import { Alert, Button, TextField } from '@plataforma/ui'
import { AuthLayout } from './AuthLayout'

const MIN_PASSWORD = 8

export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Si venía de un link (por ejemplo una invitación), vuelve ahí; si no, a crear su negocio.
  const from = (location.state as { from?: string } | null)?.from
  const next = from && from !== '/' ? from : '/onboarding'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  const passwordError =
    password.length > 0 && password.length < MIN_PASSWORD
      ? `Mínimo ${MIN_PASSWORD} caracteres.`
      : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await auth.signUp(
        email.trim(),
        password,
        `${window.location.origin}/onboarding`,
      )
      if (result.hasSession) navigate('/onboarding', { replace: true })
      else setCheckEmail(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (checkEmail) {
    return (
      <AuthLayout title="Revisá tu email">
        <p className="text-sm text-slate-600">
          Te mandamos un link a <strong>{email}</strong> para confirmar tu cuenta. Abrilo desde este
          dispositivo para seguir con la configuración de tu negocio.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="En dos minutos tenés tu programa de fidelización.">
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
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          hint={`Al menos ${MIN_PASSWORD} caracteres.`}
        />
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!email || password.length < MIN_PASSWORD}
        >
          Crear cuenta
        </Button>
        <p className="text-center text-sm text-slate-600">
          ¿Ya tenés cuenta?{' '}
          <Link
            to="/login"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Ingresá
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
