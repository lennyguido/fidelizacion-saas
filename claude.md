# Reglas del proyecto

## Objetivo

Construir una plataforma SaaS multi-tenant de fidelización y recuperación de clientes para negocios locales.

El backlog completo se encuentra en `TASKS.md`.

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
