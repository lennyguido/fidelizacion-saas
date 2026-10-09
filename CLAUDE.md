# Reglas del proyecto

## Objetivo

Construir una plataforma SaaS multi-tenant para negocios locales, formada por un núcleo compartido (`core`) y módulos. El primer producto es Fidelización + Recuperación de clientes (módulos `loyalty` y `recovery`).

El backlog completo se encuentra en `TASKS.md`.

La arquitectura obligatoria está en `docs/ARCHITECTURE.md`. Leerla antes de crear tablas, funciones, módulos o carpetas nuevas.

## Regla principal

Antes de implementar cualquier cosa:

1. Leer `TASKS.md`.
2. Revisar el estado actual del repositorio.
3. Revisar `PROGRESS.md`.
4. Revisar `DECISIONS.md`.
5. Identificar la siguiente tarea disponible.
6. Verificar sus dependencias.
7. Implementarla de forma incremental.
8. Ejecutar las pruebas correspondientes.
9. Corregir errores.
10. Actualizar la documentación correspondiente.
11. Actualizar `PROGRESS.md`.
12. Crear un commit descriptivo.

## No avanzar arbitrariamente

No saltar tareas del backlog.

No implementar funcionalidades futuras solamente porque sean técnicamente interesantes.

Respetar el orden definido en `TASKS.md`.

## Seguridad

Nunca:

* exponer secrets;
* colocar service-role keys en el frontend;
* borrar datos reales;
* ejecutar migraciones destructivas en producción;
* modificar producción sin autorización;
* inventar credenciales;
* inventar API keys;
* publicar información sensible.

## Checkpoint humano

Detenerse y pedir autorización cuando una tarea requiera:

* credenciales reales;
* producción;
* migraciones destructivas;
* eliminación de datos;
* cambios importantes de arquitectura;
* cambios amplios de RLS;
* dominios reales;
* pagos reales;
* WhatsApp real;
* publicación de aplicaciones;
* datos reales de clientes.

Cuando sea necesario detenerse, explicar:

1. qué hay que hacer;
2. por qué;
3. dónde hacerlo;
4. qué resultado se espera.

## Calidad

Antes de marcar una tarea como terminada:

* debe compilar;
* debe pasar los tests relevantes;
* no debe tener errores TypeScript;
* no debe tener errores de lint;
* debe respetar multi-tenancy;
* debe respetar las políticas de seguridad;
* debe estar documentada cuando corresponda.

## Arquitectura

Mantener:

* React
* TypeScript
* Vite
* Tailwind
* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Supabase Edge Functions cuando sean necesarias
* PWA

No cambiar el stack principal sin una razón técnica clara y sin documentar la decisión.

## Multi-tenancy

La plataforma utiliza una única aplicación y una única base de datos.

Los datos deben aislarse mediante `business_id` y RLS.

Nunca permitir que un negocio pueda acceder a datos de otro negocio.

Toda tabla de negocio debe tener: `business_id not null`, RLS habilitado, índice por `business_id` y foreign keys compuestas `(business_id, id)` hacia otras tablas del mismo negocio. Las policies usan los helpers `core.is_member`, `core.has_role` y `core.has_module`.

## Núcleo y módulos

* Los módulos dependen del núcleo y **nunca** entre sí. Un módulo no lee ni escribe tablas de otro módulo.
* Cada módulo vive en su propio esquema de Postgres y en `src/modules/<modulo>/` en el frontend, con su `manifest.ts`.
* Las visitas se registran solo con `core.record_visit()`.
* Lógica crítica (puntos, canjes, estados, atribución, dinero) en funciones de Postgres. Las tablas sensibles no tienen policies de escritura para el cliente.
* El frontend no calcula nada que importe: muestra datos y llama funciones.
* Dinero en `bigint` (unidades menores). Fechas de estadísticas en la zona horaria del negocio.
* Mensajes solo a través de la mensajería del núcleo, que controla consentimiento y opt-out.
* Si algo nuevo parece necesitar romper estas reglas: STOP y preguntar.

## Estilo de código

Preferir:

* componentes pequeños;
* funciones pequeñas;
* nombres claros;
* separación entre UI, lógica y acceso a datos;
* código fácil de mantener;
* tipos TypeScript explícitos cuando aporten claridad.

Evitar:

* componentes gigantes;
* lógica duplicada;
* código innecesariamente complejo;
* soluciones temporales que luego queden olvidadas.

## Commits

Utilizar commits pequeños y descriptivos.

Ejemplos:

`feat: add customer creation`

`fix: prevent duplicate reward redemption`

`chore: configure supabase local development`

`test: add reward redemption tests`

`docs: update architecture`

## Regla de autonomía

Claude puede continuar automáticamente mientras:

* la tarea esté dentro del backlog;
* no requiera una decisión humana;
* no afecte producción;
* no requiera credenciales humanas;
* no implique riesgo de pérdida de datos;
* las pruebas estén pasando.

Si alguna de esas condiciones deja de cumplirse:

STOP.

## Fuente de verdad

`TASKS.md` es el backlog operativo principal.

`PROGRESS.md` indica el estado actual.

`DECISIONS.md` contiene decisiones arquitectónicas y de producto importantes.

`README.md` contiene la documentación general del proyecto.
