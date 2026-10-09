import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { auth, errorMessage } from '@plataforma/sdk'
import { Alert, Button, TextField } from '@plataforma/ui'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await auth.signIn(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Ingresá a tu negocio">
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!email || !password}
        >
          Ingresar
        </Button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-slate-600 underline-offset-4 hover:underline">
            Olvidé mi contraseña
          </Link>
          <Link
            to="/signup"
            state={{ from }}
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Crear cuenta
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
