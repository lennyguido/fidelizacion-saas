# Progreso del proyecto

## Current phase

Fase 1 — Núcleo de base de datos: **terminada** (falta generar tipos, ver bloqueos). Siguiente: Fase 2.

## Current task

Fase 2 — Auth, onboarding y shell del panel.

## Last completed task

Fase 0 y Fase 1:

* Monorepo con npm workspaces (`apps/admin`, `packages/config|ui|sdk`), Prettier, ESLint compartido, alias `@`.
* Núcleo `core` en 6 migraciones: tenancy y helpers RLS, módulos/planes/suscripciones, clientes y consentimientos, visitas + estadísticas + estados, auditoría + storage + job nocturno, índices de FKs.
* 71 tests pgTAP: meta-test de seguridad, aislamiento entre negocios, `record_visit`/`void_visit`, estados del cliente.
* Seed DEMO (Café Central, Panadería Sur).
* CI en GitHub Actions: frontend (typecheck, lint, format, build) + base (migraciones + pgTAP en Supabase real).
* Migraciones y seed aplicados al proyecto Supabase de desarrollo `fidelizacion-saas` (ref `dqpnqcumlyfifewgzyvh`) con el conector de Supabase.

## Next task

Fase 2: función de onboarding en la base (`core.create_business`), signup/login, negocio activo, shell del panel con manifest de módulos.

## Current blockers

HUMAN ACTION REQUIRED:

1. **Exponer el esquema `core`** en Supabase: Project Settings → Data API → Exposed schemas → agregar `core`. Sin esto la app no puede leer las tablas y no se pueden generar los tipos TypeScript.
2. **`package-lock.json`**: correr `npm install` en la raíz (Codespaces o una compu con Node) y commitearlo. El entorno del agente no tiene acceso a npm.

## Last test result

* Local (Postgres 16 + pgTAP): 71/71 OK.
* CI `f4471ae`: Frontend OK, Database OK.

## Last commit

Ver `git log`.

## Important decisions

* Stack inicial: React + TypeScript + Vite + Tailwind.
* Backend: Supabase + PostgreSQL.
* Arquitectura: multi-tenant (`business_id` + RLS).
* Plataforma núcleo (`core`) + módulos por esquema; los módulos nunca dependen entre sí.
* La visita (`core.visits`) es el dato central; identidad del cliente separada del programa de puntos.
* Monorepo: `apps/admin`, `apps/client`, `packages/*`, `supabase/`.
* Migraciones del remoto aplicadas con el conector de Supabase: los nombres de archivo usan la misma versión que registra el remoto.
* El backlog operativo principal se encuentra en `TASKS.md`.
