/** Texto para los clientes que ya están en otra campaña con la ventana abierta. */
export function busyText(busy: number): string {
  if (busy === 0) return ''
  return busy === 1
    ? ' 1 ya está en otra campaña activa y no se incluye.'
    : ` ${busy} ya están en otra campaña activa y no se incluyen.`
}
