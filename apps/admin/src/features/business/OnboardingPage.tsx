import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { auth, businesses, errorMessage, isValidSlug, slugify } from '@plataforma/sdk'
import { Alert, Button, TextField } from '@plataforma/ui'
import { AuthLayout } from '../auth/AuthLayout'
import { useSession } from '../auth/AuthContext'
import { businessKeys } from './queries'

type SlugCheck = { slug: string; available: boolean }

/** Primer paso: crear el negocio. Los demás pasos del onboarding llegan con sus módulos. */
export function OnboardingPage() {
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [customSlug, setCustomSlug] = useState<string | null>(null)
  const [check, setCheck] = useState<SlugCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const slug = customSlug ?? slugify(name)
  const slugValid = isValidSlug(slug)

  // Consulta disponibilidad con un pequeño retardo mientras escribe.
  useEffect(() => {
    if (!slugValid) return
    const timer = window.setTimeout(() => {
      businesses
        .isSlugAvailable(slug)
        .then((available) => setCheck({ slug, available }))
        .catch(() => setCheck(null))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [slug, slugValid])

  const status: 'idle' | 'checking' | 'available' | 'taken' = !slugValid
    ? 'idle'
    : !check || check.slug !== slug
      ? 'checking'
      : check.available
        ? 'available'
        : 'taken'

  const slugError =
    slug.length > 0 && !slugValid
      ? 'Solo minúsculas, números y guiones.'
      : status === 'taken'
        ? 'Esa dirección ya está en uso.'
        : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (status !== 'available') return
    setError(null)
    setSubmitting(true)
    try {
      const created = await businesses.createBusiness(name.trim(), slug)
      await queryClient.invalidateQueries({ queryKey: businessKeys.mine(session.user.id) })
      navigate(`/b/${created.slug}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Creá tu negocio" subtitle="Después vas a poder cambiar todo esto.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Nombre del negocio"
          placeholder="Café Central"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Dirección de tu club"
          required
          value={slug}
          onChange={(e) => setCustomSlug(e.target.value.toLowerCase())}
          error={slugError}
          hint={
            status === 'checking'
              ? 'Verificando…'
              : status === 'available'
                ? `Disponible: tus clientes entran en /${slug}`
                : 'Se usa en el link que van a abrir tus clientes.'
          }
        />
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!name.trim() || status !== 'available'}
        >
          Crear negocio
        </Button>
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="text-center text-sm text-slate-500 underline-offset-4 hover:underline"
        >
          Salir ({session.user.email})
        </button>
      </form>
    </AuthLayout>
  )
}
