// Edge Function `calendar`: calendario iCal de un profesional (D-051).
// turnos.neriva.net/cal/<código> llega acá (rewrite de Vercel). Sin sesión.
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: Deno.env.toObject() }))
