// Edge Function `team-invite`: manda por mail la invitación de equipo (D-046).
// Guía: docs/PERMISOS.md. Exige la sesión de quien llama (verify_jwt = true).
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: Deno.env.toObject() }))
