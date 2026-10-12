import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { card as cardApi, errorMessage } from '@plataforma/sdk'

/**
 * "¿Cómo te atendimos?" después de una visita (D-036). A todos se les ofrece el
 * link de Google al final, sin importar la nota: Google prohíbe filtrar o premiar.
 */
export function FeedbackSurvey({ token, visitId }: { token: string; visitId: string }) {
  const queryClient = useQueryClient()
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const send = useMutation({
    mutationFn: () => cardApi.submitFeedback(token, visitId, rating ?? 0, comment),
  })

  if (send.isSuccess) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl bg-white p-5 text-center shadow-sm">
        <p className="font-semibold">¡Gracias por contarnos!</p>
        {send.data.reviewUrl && (
          <>
            <p className="text-sm text-slate-600">
              Si querés, también podés dejar tu opinión en Google.
            </p>
            <a
              href={send.data.reviewUrl}
              target="_blank"
              rel="noreferrer"
              className="self-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              Opinar en Google
            </a>
          </>
        )}
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['card', token] })}
          className="text-xs text-slate-500 underline"
        >
          Cerrar
        </button>
      </section>
    )
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm"
      data-testid="survey"
    >
      <h2 className="font-semibold">¿Cómo te atendimos hoy?</h2>
      <div className="flex justify-center gap-2" role="radiogroup" aria-label="Tu nota">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} de 5`}
            onClick={() => setRating(value)}
            className={`text-3xl ${rating !== null && value <= rating ? 'text-amber-400' : 'text-slate-300'}`}
          >
            ★
          </button>
        ))}
      </div>
      {rating !== null && (
        <>
          <textarea
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Algo para contarnos? (opcional)"
            className="rounded-lg border border-slate-300 p-2 text-sm"
            rows={2}
          />
          <button
            type="button"
            disabled={send.isPending}
            onClick={() => send.mutate()}
            className="self-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {send.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </>
      )}
      {send.isError && (
        <p role="alert" className="text-center text-sm text-red-600">
          {errorMessage(send.error)}
        </p>
      )}
    </section>
  )
}
