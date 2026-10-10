// Edge Function `wallet`: tarjeta de puntos en Google Wallet y Apple Wallet.
// Configuración y pasos: docs/WALLET.md. Se publica con `supabase functions deploy wallet`
// (verify_jwt = false en supabase/config.toml: la tarjeta no tiene sesión y Apple llama
// directo; cada ruta se protege sola con el token de la tarjeta, del pase o del sync).
import { createHandler } from './router.ts'

Deno.serve(createHandler({ env: Deno.env.toObject() }))
