import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '@plataforma/sdk'
import { useToast } from '@plataforma/ui'
import { downloadText } from './download'

/** Pide un CSV a la base y lo descarga con ese nombre de archivo. */
export function useCsvDownload(fetchCsv: () => Promise<string>, filename: () => string) {
  const toast = useToast()
  return useMutation({
    mutationFn: fetchCsv,
    onSuccess: (csv) => downloadText(filename(), csv),
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
}
