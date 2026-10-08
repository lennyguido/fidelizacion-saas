# Decisiones del proyecto

## Arquitectura

La plataforma será multi-tenant.

Una única aplicación servirá a múltiples negocios.

Una única base de datos almacenará los datos, aislados mediante `business_id` y Row Level Security.

## Stack inicial

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS

Backend:

* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Supabase Edge Functions cuando sean necesarias

## Cliente

La primera versión será web mobile-first y PWA.

No se desarrollará una aplicación nativa independiente por negocio antes de validar el producto web.

## Desarrollo

El desarrollo será incremental y guiado por `TASKS.md`.

Las decisiones importantes que cambien la arquitectura deberán registrarse en este archivo.
