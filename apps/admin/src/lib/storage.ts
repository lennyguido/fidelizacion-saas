// localStorage puede fallar (modo privado, permisos): nunca debe romper la app.
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // sin persistencia: no es crítico
  }
}
