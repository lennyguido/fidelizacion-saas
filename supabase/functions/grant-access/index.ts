// Edge Function `grant-access`: el administrador de la plataforma da accesos (D-043).
// Guía: docs/ACCESOS.md. Exige la sesión de quien llama (verify_jwt = true).
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: Deno.env.toObject() }))
