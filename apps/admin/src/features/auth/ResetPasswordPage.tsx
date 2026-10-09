import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { auth, errorMessage } from '@plataforma/sdk'
import { Alert, Button, FullPageSpinner, TextField, useToast } from '@plataforma/ui'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'

const MIN_PASSWORD = 8

/** Se llega desde el link del email de recuperación (que inicia una sesión temporal). */
export function ResetPasswordPage() {
  const state = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (state.status === 'loading') return <FullPageSpinner />

  if (state.status === 'signed_out') {
    return (
      <AuthLayout title="El link venció">
        <p className="text-sm text-slate-600">
          Pedí un link nuevo para cambiar tu contraseña.{' '}
          <Link to="/forgot-password" className="font-medium text-slate-900 underline">
            Pedir link
          </Link>
        </p>
      </AuthLayout>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD) return
    setError(null)
    setSubmitting(true)
    try {
      await auth.updatePassword(password)
      toast.show('Contraseña actualizada', 'success')
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Elegí una contraseña nueva">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`Al menos ${MIN_PASSWORD} caracteres.`}
        />
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={password.length < MIN_PASSWORD}
        >
          Guardar
        </Button>
      </form>
    </AuthLayout>
  )
}
