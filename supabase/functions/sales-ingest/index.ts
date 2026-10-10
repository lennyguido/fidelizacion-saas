// Edge Function `sales-ingest`: la caja manda cada venta y entra como visita.
// Guía: docs/CAPTURA-AUTOMATICA.md. verify_jwt = false (supabase/config.toml): la
// caja no tiene sesión; cada pedido se autentica con la clave del negocio.
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: Deno.env.toObject() }))
