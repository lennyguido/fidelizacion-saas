export function NoCard({ message }: { message?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Tu tarjeta de puntos</h1>
      <p className="text-slate-600">
        {message ??
          'Para ver tu tarjeta, abrí el link que te mandó el negocio. Si no lo tenés, pedíselo en la caja.'}
      </p>
    </main>
  )
}
