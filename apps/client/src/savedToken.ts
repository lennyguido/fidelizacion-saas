// La tarjeta se recuerda en este teléfono para abrirla sin el link (por ejemplo,
// desde el ícono de la pantalla de inicio). Si el navegador no deja guardar, no pasa nada.
const KEY = 'plataforma.card-token'

export function readSavedToken(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token)
  } catch {
    // modo privado o almacenamiento bloqueado
  }
}

export function forgetToken(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // nada que hacer
  }
}
