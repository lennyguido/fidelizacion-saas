export function ConfigError({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">Falta configuración</h1>
      <p className="text-slate-600">{message}</p>
      <p className="text-sm text-slate-500">
        Copiá <code>apps/admin/.env.example</code> a <code>apps/admin/.env.local</code> y completá
        los valores del proyecto Supabase de desarrollo.
      </p>
    </main>
  )
}
