# Cambios

Formato: lo más nuevo arriba. "Aplicado" = está en el proyecto de desarrollo de Supabase.

## Sin publicar (en revisión)

* **Archivar clientes solo dueño/admin**, también desde la base (`fix/archive-owner-admin-only`). No aplicado.
* **Equipo**: invitar por link, aceptar con el mismo email, cambiar rol o desactivar (`feat/equipo-y-privacidad`). No aplicado.
* **Borrar datos personales** de un cliente (Ley 25.326), incluidos textos de visitas y auditoría. No aplicado.
* **Limpieza semanal** de registros internos viejos. No aplicado.
* Revisión de seguridad independiente: 5 arreglos (ver `docs/REVISION-PENDIENTE.md`).

## 2026-10-09

* Plan de marketing en `docs/marketing/` (nombre propuesto, marca, mercado, precios, ventas, textos de la web).
* Tipos de la base generados por CI; arreglo de Codespaces; mensajes de login más claros; visitas de hoy/7 días en Inicio; kit del piloto.
* Migraciones aplicadas: `core_onboarding`, `core_customer_search`, `core_customer_import`.
* Mostrador, clientes, búsqueda, importación CSV, historial y estadísticas por cliente (Fase 3).
* Registro, inicio de sesión, crear negocio y panel (Fase 2).

## 2026-10-08

* Núcleo de base de datos (Fase 1): negocios, miembros, módulos y planes, clientes, visitas, estados, auditoría, archivos, tareas programadas. Aplicado.
* Base del repositorio (Fase 0): monorepo, CI con tests de base, unitarios y punta a punta.
