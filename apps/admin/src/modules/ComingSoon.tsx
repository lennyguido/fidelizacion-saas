import { EmptyState } from '@plataforma/ui'

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <EmptyState title="Próximamente" description={description} />
    </section>
  )
}
