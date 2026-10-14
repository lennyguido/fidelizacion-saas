// Edge Function `send-email` (D-055): despacha la bandeja de mails del núcleo.
// La llama la página del turno (turnos.neriva.net/api/send-email, rewrite de Vercel)
// después de encolar un mail. Sin la clave de Brevo no envía nada.
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: Deno.env.toObject() }))
