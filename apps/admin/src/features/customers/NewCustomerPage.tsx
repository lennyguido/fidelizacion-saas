import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { customers, errorMessage, type CustomerInput } from '@plataforma/sdk'
import { Card, useToast } from '@plataforma/ui'
import { useActiveBusiness } from '../business/ActiveBusinessContext'
import { CustomerForm } from './CustomerForm'
import { useInvalidateCustomers } from './queries'

export function NewCustomerPage() {
  const { business } = useActiveBusiness()
  const navigate = useNavigate()
  const toast = useToast()
  const invalidate = useInvalidateCustomers(business.id)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (input: CustomerInput) => customers.create(business.id, input),
    onSuccess: async (customer) => {
      await invalidate()
      toast.show(`${customer.name} quedó cargado`, 'success')
      navigate(`/b/${business.slug}/clientes/${customer.id}`, { replace: true })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <section className="flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo cliente</h1>
      <Card>
        <CustomerForm
          submitLabel="Guardar cliente"
          submitting={create.isPending}
          error={error}
          onSubmit={(input) => {
            setError(null)
            create.mutate(input)
          }}
          onCancel={() => navigate(-1)}
        />
      </Card>
    </section>
  )
}
