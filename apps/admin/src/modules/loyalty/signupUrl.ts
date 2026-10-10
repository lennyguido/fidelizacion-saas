import { selfSignup } from '@plataforma/sdk'
import { clientAppUrl } from '../../lib/clientAppUrl'

/** Link público del alta por QR (lo que lleva el cartel). */
export function signupUrl(code: string): string {
  return `${clientAppUrl(import.meta.env, window.location)}${selfSignup.signupPath(code)}`
}
