// Edge Function `tap`: link corto de los carteles NFC/QR de reseñas (D-048).
// neriva.net/r/<código> llega acá (rewrite de Vercel). Sin sesión (verify_jwt = false).
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: Deno.env.toObject() }))
