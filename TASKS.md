# TASKS.md

# Plataforma SaaS de Fidelización + Recuperación de Clientes

> Este archivo es el backlog operativo principal del proyecto.
> El agente de desarrollo debe ejecutarlo de manera incremental, respetando dependencias, criterios de aceptación y checkpoints humanos.

---

# PLAN POR FASES (manda sobre el orden de la sección 80)

> Desde 2026-10-08 el proyecto es una plataforma núcleo + módulos (`DECISIONS.md` D-005 a D-013, `docs/ARCHITECTURE.md`).
> Las secciones 1–78 siguen siendo los checklists de detalle; esta lista define **en qué orden** se ejecutan.
> No se empieza una fase sin terminar la anterior (salvo tareas marcadas como paralelas).

## Fase 0 — Base del repositorio

* [x] Convertir a monorepo con npm workspaces: `app/` → `apps/admin/`
* [x] Crear `packages/config` (tsconfig, eslint, tailwind compartidos)
* [x] Crear `packages/ui` (vacío, listo para componentes)
* [x] Crear `packages/sdk` (cliente Supabase tipado + lectura de variables de entorno)
* [x] Configurar Prettier y aliases de imports
* [x] `supabase/config.toml` creado a mano (equivale a `supabase init`). El proyecto remoto se maneja con el conector de Supabase; `supabase link` solo hace falta para usar la CLI contra el remoto
* [x] Exponer esquema `core` en `supabase/config.toml` (`loyalty`/`recovery` se agregan con sus módulos)
* [ ] Exponer esquema `core` en el proyecto remoto (Project Settings → Data API) — HUMAN ACTION
* [ ] `npm install` y commitear `package-lock.json` de la raíz — HUMAN ACTION (npm bloqueado en el entorno del agente)
* [x] GitHub Actions: install, typecheck, lint, build (los tests de base se suman en la Fase 1)

## Fase 1 — Núcleo de base de datos (`core`)

Ver secciones 8–13 y 46 para detalle.

* [x] Migración: `core.businesses`, `core.locations`
* [x] Migración: `core.memberships`, `core.platform_admins`
* [x] Migración: helpers RLS `core.is_member`, `core.has_role`, `core.has_module`
* [x] Migración: `core.modules`, `core.plans`, `core.subscriptions`, `core.business_modules`
* [x] Migración: `core.customers`, `core.customer_consents`, `core.customer_accounts`
* [x] Migración: `core.visits` + función `core.record_visit()` (idempotente)
* [x] Migración: `core.customer_stats`, `core.customer_status_history` + cálculo de estado y riesgo
* [x] Job nocturno con `pg_cron` para recalcular estadísticas
* [x] Migración: `core.events` (outbox) y `core.audit_log` con trigger genérico
* [x] Storage: bucket de logos con policies por `business_id`
* [x] Tests pgTAP: meta-test (toda tabla de negocio con RLS + `business_id` + índice)
* [x] Tests pgTAP: acceso cross-tenant rechazado en todas las tablas del núcleo
* [x] Tests pgTAP: `record_visit` (idempotencia, anónimas, permisos) y cálculo de estados
* [x] Seed DEMO "Café Central" (+ un segundo negocio para probar aislamiento)
* [ ] Generar tipos TypeScript para todos los esquemas (bloqueado: exponer `core` en el remoto)
* [x] Aplicar migraciones y seed al proyecto Supabase de desarrollo
* [x] Sumar `supabase test db` al CI

## Fase 2 — Auth, onboarding y shell del panel

Ver secciones 3, 14, 16, 17.

* [x] Router, layout, error boundary, notificaciones, componentes base en `packages/ui`
* [x] Signup / login / logout / reset de contraseña del negocio
* [x] Onboarding: crea negocio + sucursal + membership owner + módulos de prueba (función en la base)
* [x] "Negocio activo" en el frontend
* [x] Sistema de `manifest` de módulos: el menú muestra solo los módulos habilitados
* [x] Test E2E (Playwright) del recorrido registro → onboarding → panel → login, en CI
* [x] Aplicar migración `core_onboarding` al proyecto de desarrollo

## Fase 3 — Clientes y registro de visitas en mostrador

Ver secciones 18–20.

* [x] CRUD de clientes (incluye clientes sin teléfono / sin app)
* [x] Pantalla de mostrador: buscar cliente o "+1 visita anónima", monto opcional, < 5 segundos
* [x] Importación CSV (plantilla, mapeo de columnas, vista previa, lotes, reporte de errores)
* [x] Aplicar migración `core_customer_import` al proyecto de desarrollo
* [x] Ficha del cliente con estadísticas y estado
* [x] Búsqueda de clientes en la base (`core.search_customers`) + tests
* [x] Test E2E del mostrador
* [x] Aplicar migración `core_customer_search` al proyecto de desarrollo
* [ ] **CHECKPOINT DE PRODUCTO:** probar con un negocio real que el personal registre visitas durante 2 semanas. Si no lo hace, rediseñar la carga antes de seguir.

## Fase 4 — Módulo Fidelización (`loyalty`)

Ver secciones 21–26.

* [ ] Programa por negocio (puntos por visita y/o por monto, sellos)
* [ ] `loyalty.members` (alta opcional al programa) + QR personal
* [ ] Ledger de puntos append-only, acreditación al recibir `visit.recorded`
* [ ] Recompensas, desbloqueos, canjes con código único (función transaccional, anti doble canje)
* [ ] Tests de reglas y de abuso
* [ ] App del cliente (`apps/client`): login, puntos, progreso, recompensas, QR, historial

## Fase 5 — Dashboard y módulo Recuperación (`recovery`)

Ver secciones 30–38.

* [ ] Dashboard del negocio
* [ ] Listas de clientes en riesgo / inactivos con valor histórico
* [ ] Segmentos, campañas, destinatarios con grupo de control
* [ ] Envío MVP sin API de WhatsApp: el dueño envía desde su WhatsApp con links `wa.me` armados por el sistema (sin costo ni aprobación de Meta)
* [ ] Atribución (cupón y ventana) y "dinero recuperado" (total + incremental)
* [ ] Tests de atribución y de las fórmulas

## Fase 6 — Mensajería real

Ver secciones 39–41. **CHECKPOINT HUMANO** antes de conectar WhatsApp real.

* [ ] Edge Function `send-message` con adaptadores, cola, reintentos, webhooks de estado

## Fase 7 — PWA, white-label, deploy y primer cliente

Ver secciones 27–29, 56, 63–67.

## Fase 8+ — Siguientes módulos y cobro

Turnos (`booking`), reputación (`reputation`), WhatsApp vendedor (`seller`), billing. Solo después de validar Fidelización + Recuperación con negocios reales (secciones 68–71).

---

# 0. REGLAS DE EJECUCIÓN PARA EL AGENTE

## 0.1 Objetivo principal

Construir una plataforma white-label/multi-tenant para negocios locales que permita:

* registrar clientes;
* registrar compras;
* registrar visitas;
* otorgar puntos;
* crear recompensas;
* permitir canjes;
* mostrar progreso al cliente;
* detectar clientes que dejan de venir;
* recuperar clientes;
* ejecutar campañas;
* medir resultados;
* mostrar cuánto dinero fue recuperado;
* ofrecer una experiencia personalizada por negocio.

La plataforma debe poder servir a múltiples negocios desde una misma base tecnológica.

---

## 0.2 Stack objetivo

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS

Backend / plataforma:

* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Supabase Edge Functions cuando sea necesario
* Supabase CLI
* SQL migrations

Aplicación cliente:

* Web mobile-first
* PWA

Futuro:

* React Native / Expo
* iOS
* Android

---

## 0.3 Regla principal de desarrollo

NO construir toda la plataforma de una vez.

Trabajar siempre:

```text
TASK
↓
IMPLEMENTAR
↓
TESTEAR
↓
CORREGIR
↓
DOCUMENTAR
↓
COMMIT
↓
MARCAR TASK COMPLETADA
↓
SIGUIENTE TASK
```

---

## 0.4 Regla de dependencias

Nunca implementar una tarea si sus dependencias principales todavía están rotas.

Ejemplo:

NO construir recompensas si:

* clientes no funcionan;
* compras no funcionan;
* puntos no funcionan.

---

## 0.5 Regla de seguridad

Nunca:

* exponer secrets;
* incluir service-role keys en frontend;
* borrar producción;
* ejecutar migraciones destructivas en producción sin autorización;
* eliminar datos reales;
* modificar dominios de producción sin autorización;
* cambiar autenticación de producción sin validación.

---

## 0.6 Regla de producción

Durante desarrollo utilizar:

* ambiente local;
* ambiente de desarrollo/staging;
* datos ficticios.

La producción solamente se utiliza cuando la funcionalidad fue probada.

---

## 0.7 Regla de comunicación

Si una tarea requiere una acción humana:

```text
STOP
HUMAN ACTION REQUIRED
```

y explicar:

1. qué hay que hacer;
2. por qué;
3. dónde hacerlo;
4. qué resultado espera el agente.

No inventar credenciales, dominios, API keys ni datos.

---

## 0.8 Regla de calidad

Cada bloque importante debe:

* compilar;
* pasar tests relevantes;
* no introducir errores TypeScript;
* no introducir errores de lint;
* mantener la aplicación usable;
* mantener las reglas de seguridad.

---

## 0.9 Regla de documentación

Mantener actualizados:

```text
README.md
CLAUDE.md
TASKS.md
PROGRESS.md
DECISIONS.md
```

---

## 0.10 Regla de commits

Hacer commits pequeños y descriptivos.

Formato recomendado:

```text
feat: add customer creation
feat: implement points calculation
fix: prevent duplicate reward redemption
chore: configure supabase local development
test: add reward redemption tests
docs: update architecture
```

---

# 1. CONTROL DEL PROYECTO

## 1.1 Crear documentación base

* [x] Crear README.md
* [x] Crear CLAUDE.md
* [x] Crear TASKS.md
* [x] Crear PROGRESS.md
* [x] Crear DECISIONS.md
* [ ] Crear CHANGELOG.md
* [ ] Crear CONTRIBUTING.md
* [ ] Crear SECURITY.md

## 1.2 Configurar reglas del agente

* [ ] Definir orden de ejecución de tareas
* [ ] Definir formato de actualización de PROGRESS.md
* [ ] Definir cuándo hacer commit
* [ ] Definir cuándo detener ejecución
* [ ] Definir comandos oficiales de build
* [ ] Definir comandos oficiales de test
* [ ] Definir comandos oficiales de lint
* [ ] Definir reglas para migraciones
* [ ] Definir reglas para producción

## 1.3 Sistema de progreso

Crear en PROGRESS.md:

```text
Current phase
Current task
Last completed task
Next task
Current blockers
Last test result
Last commit
Important decisions
```

---

# 2. REPOSITORIO

* [x] Crear repositorio GitHub
* [x] Clonar repositorio localmente
* [x] Inicializar Git
* [x] Configurar branch principal
* [x] Crear `.gitignore`
* [x] Crear `.env.example`
* [ ] Configurar Git hooks si son necesarios
* [x] Crear commit inicial
* [x] Configurar README inicial

---

# 3. FRONTEND BASE

* [x] Crear proyecto Vite + React
* [x] Configurar TypeScript
* [x] Configurar Tailwind
* [x] Instalar Supabase client
* [ ] Instalar librerías necesarias
* [x] Configurar ESLint
* [ ] Configurar Prettier
* [ ] Configurar aliases de imports
* [ ] Configurar estructura de carpetas
* [ ] Configurar router
* [ ] Crear layout base
* [ ] Crear error boundary
* [ ] Crear loading system
* [ ] Crear notification system
* [ ] Crear modal reutilizable
* [ ] Crear button reutilizable
* [ ] Crear input reutilizable
* [ ] Crear card reutilizable
* [ ] Crear table reutilizable
* [ ] Crear badge reutilizable
* [ ] Crear empty state
* [ ] Crear skeleton loading

---

# 4. ESTRUCTURA FRONTEND

Crear estructura lógica similar a:

```text
src/
  app/
  components/
  layouts/
  pages/
  features/
    auth/
    business/
    customers/
    purchases/
    points/
    rewards/
    campaigns/
    recovery/
    dashboard/
  hooks/
  lib/
  services/
  types/
  utils/
```

* [ ] Crear estructura
* [ ] Definir responsabilidad de cada carpeta
* [ ] Documentar arquitectura frontend
* [ ] Evitar componentes gigantes
* [ ] Separar lógica de UI
* [ ] Separar acceso a datos de presentación

---

# 5. SUPABASE LOCAL

* [ ] Instalar Supabase CLI
* [ ] Ejecutar `supabase init`
* [ ] Crear configuración local
* [ ] Crear directorio migrations
* [ ] Crear seed.sql
* [ ] Configurar proyecto local
* [ ] Ejecutar Supabase local
* [ ] Verificar PostgreSQL local
* [ ] Verificar Auth local
* [ ] Verificar Storage local
* [ ] Verificar dashboard local
* [ ] Documentar comandos locales

Mantener:

```text
supabase/
  migrations/
  seed.sql
  config.toml
```

---

# 6. SUPABASE REMOTO

* [ ] Crear proyecto Supabase de desarrollo
* [ ] Obtener project reference
* [ ] Conectar CLI con proyecto
* [ ] Verificar conexión
* [ ] Documentar cómo vincular el proyecto
* [ ] Crear proyecto de producción separado cuando corresponda
* [ ] Documentar diferencias development/production

---

# 7. VARIABLES Y SECRETS

* [ ] Crear variables locales
* [ ] Crear `.env.example`
* [ ] No subir `.env`
* [ ] Documentar variables necesarias
* [ ] Separar development/staging/production
* [ ] Identificar variables públicas
* [ ] Identificar secrets
* [ ] Verificar que service-role no aparezca en frontend
* [ ] Verificar repositorio en busca de secrets

---

# 8. ARQUITECTURA MULTI-TENANT

Principio:

```text
Una plataforma
    ↓
Muchos negocios
    ↓
Cada negocio tiene sus propios datos
```

* [ ] Definir `business_id`
* [ ] Definir aislamiento de datos
* [ ] Definir usuario → negocio
* [ ] Definir empleado → negocio
* [ ] Definir cliente → negocio
* [ ] Definir compra → negocio
* [ ] Definir recompensa → negocio
* [ ] Definir campaña → negocio
* [ ] Definir métricas → negocio
* [ ] Documentar arquitectura multi-tenant

---

# 9. MODELO DE BASE DE DATOS

## Businesses

* [ ] Crear `businesses`
* [ ] Crear id
* [ ] Crear name
* [ ] Crear slug
* [ ] Crear logo_url
* [ ] Crear primary_color
* [ ] Crear secondary_color
* [ ] Crear address
* [ ] Crear phone
* [ ] Crear email
* [ ] Crear timezone
* [ ] Crear settings
* [ ] Crear created_at
* [ ] Crear updated_at

## Profiles / Users

* [ ] Crear perfil de usuario
* [ ] Relacionar usuario con Auth
* [ ] Relacionar usuario con business
* [ ] Crear role
* [ ] Definir OWNER
* [ ] Definir EMPLOYEE
* [ ] Preparar futuro ADMIN

## Customers

* [ ] Crear customers
* [ ] Crear id
* [ ] Crear business_id
* [ ] Crear name
* [ ] Crear phone
* [ ] Crear email
* [ ] Crear birthdate
* [ ] Crear registered_at
* [ ] Crear points
* [ ] Crear status
* [ ] Crear last_purchase_at
* [ ] Crear total_purchases
* [ ] Crear total_spend
* [ ] Crear average_ticket
* [ ] Crear frequency_days
* [ ] Crear risk_score
* [ ] Crear consent/preferences cuando corresponda

## Purchases

* [ ] Crear purchases
* [ ] Crear id
* [ ] Crear business_id
* [ ] Crear customer_id
* [ ] Crear amount
* [ ] Crear purchased_at
* [ ] Crear description
* [ ] Crear metadata
* [ ] Crear employee_id opcional

## Point movements

* [ ] Crear tabla de movimientos de puntos
* [ ] Registrar puntos ganados
* [ ] Registrar puntos usados
* [ ] Registrar puntos anulados
* [ ] Registrar ajustes manuales
* [ ] Registrar motivo
* [ ] Registrar referencia al evento original

## Rewards

* [ ] Crear rewards
* [ ] Crear id
* [ ] Crear business_id
* [ ] Crear name
* [ ] Crear description
* [ ] Crear type
* [ ] Crear requirement
* [ ] Crear reward_value
* [ ] Crear active
* [ ] Crear expiration settings

## Reward unlocks

* [ ] Crear tabla de recompensas desbloqueadas
* [ ] Relacionar customer
* [ ] Relacionar reward
* [ ] Registrar fecha
* [ ] Registrar estado

## Redemptions

* [ ] Crear redemptions
* [ ] Relacionar customer
* [ ] Relacionar reward
* [ ] Relacionar business
* [ ] Registrar código
* [ ] Registrar fecha
* [ ] Registrar employee
* [ ] Registrar status

## Campaigns

* [ ] Crear campaigns
* [ ] Crear campaign_events
* [ ] Crear recipients
* [ ] Crear attribution records

## Notifications

* [ ] Diseñar notifications
* [ ] Crear tipos
* [ ] Crear estados
* [ ] Crear timestamps

## Future

* [ ] employees
* [ ] branches
* [ ] business_subscriptions
* [ ] invoices
* [ ] plans
* [ ] audit_logs

---

# 10. RELACIONES

* [ ] business → users
* [ ] business → customers
* [ ] business → purchases
* [ ] business → rewards
* [ ] business → campaigns
* [ ] customer → purchases
* [ ] customer → point movements
* [ ] customer → reward unlocks
* [ ] customer → redemptions
* [ ] reward → unlocks
* [ ] reward → redemptions
* [ ] campaign → recipients
* [ ] campaign → events
* [ ] campaign → attribution

---

# 11. MIGRACIONES

Todas las modificaciones estructurales importantes deben quedar versionadas.

* [ ] Crear migration inicial
* [ ] Crear migration businesses
* [ ] Crear migration profiles
* [ ] Crear migration customers
* [ ] Crear migration purchases
* [ ] Crear migration points
* [ ] Crear migration rewards
* [ ] Crear migration redemptions
* [ ] Crear migration campaigns
* [ ] Crear seed data
* [ ] Probar `db reset`
* [ ] Probar migrations desde cero
* [ ] Verificar que un nuevo entorno pueda reconstruirse
* [ ] Generar tipos TypeScript desde database schema

---

# 12. CONSTRAINTS E ÍNDICES

* [ ] Agregar foreign keys
* [ ] Agregar not null donde corresponda
* [ ] Agregar unique constraints
* [ ] Crear unique slug por negocio
* [ ] Crear índices business_id
* [ ] Crear índices customer_id
* [ ] Crear índices purchased_at
* [ ] Crear índices status
* [ ] Revisar índices adicionales
* [ ] Revisar performance de queries principales

---

# 13. RLS Y SEGURIDAD DE BASE

Activar RLS donde corresponda.

* [ ] RLS businesses
* [ ] RLS profiles
* [ ] RLS customers
* [ ] RLS purchases
* [ ] RLS points
* [ ] RLS rewards
* [ ] RLS unlocks
* [ ] RLS redemptions
* [ ] RLS campaigns
* [ ] RLS notifications
* [ ] Crear policies de lectura
* [ ] Crear policies de inserción
* [ ] Crear policies de update
* [ ] Crear policies de delete
* [ ] Revisar políticas de employee
* [ ] Revisar políticas de owner
* [ ] Intentar cross-tenant access
* [ ] Confirmar que sea rechazado
* [ ] Crear tests de seguridad

---

# 14. AUTH DEL NEGOCIO

* [ ] Crear signup
* [ ] Crear login
* [ ] Crear logout
* [ ] Crear session handling
* [ ] Crear protected routes
* [ ] Crear reset password
* [ ] Crear email verification
* [ ] Crear auth error states
* [ ] Crear auth loading states
* [ ] Crear owner profile
* [ ] Crear business automáticamente durante onboarding

---

# 15. AUTH DEL CLIENTE

Definir estrategia antes de implementarla.

Opciones posibles:

* magic link;

* OTP;

* phone-based authentication;

* token seguro asociado a una experiencia QR.

* [ ] Elegir estrategia

* [ ] Documentar decisión

* [ ] Implementar autenticación

* [ ] Crear session

* [ ] Crear logout

* [ ] Proteger datos del cliente

* [ ] Testear recuperación de sesión

---

# 16. ONBOARDING DEL NEGOCIO

* [ ] Crear onboarding
* [ ] Paso negocio
* [ ] Paso logo
* [ ] Paso colores
* [ ] Paso reglas de puntos
* [ ] Paso primera recompensa
* [ ] Paso clientes
* [ ] Paso QR
* [ ] Paso resumen
* [ ] Crear progreso
* [ ] Permitir continuar luego
* [ ] Validar datos
* [ ] Crear estado de onboarding
* [ ] Crear onboarding completion

---

# 17. CONFIGURACIÓN DEL NEGOCIO

* [ ] Editar nombre
* [ ] Editar logo
* [ ] Editar colores
* [ ] Editar dirección
* [ ] Editar teléfono
* [ ] Editar email
* [ ] Editar reglas de puntos
* [ ] Editar reglas de recompensas
* [ ] Editar preferencias
* [ ] Guardar cambios
* [ ] Previsualizar branding

---

# 18. SISTEMA DE CLIENTES

## CRUD

* [ ] Crear cliente
* [ ] Leer cliente
* [ ] Actualizar cliente
* [ ] Desactivar cliente
* [ ] Buscar cliente
* [ ] Filtrar cliente
* [ ] Ordenar cliente
* [ ] Paginar cliente

## Perfil

* [ ] Mostrar información
* [ ] Mostrar puntos
* [ ] Mostrar compras
* [ ] Mostrar gasto
* [ ] Mostrar ticket
* [ ] Mostrar frecuencia
* [ ] Mostrar estado
* [ ] Mostrar riesgo
* [ ] Mostrar recompensas
* [ ] Mostrar historial

---

# 19. IMPORTACIÓN

* [ ] Crear importador CSV
* [ ] Crear plantilla CSV
* [ ] Crear parser
* [ ] Detectar columnas
* [ ] Validar datos
* [ ] Detectar teléfonos inválidos
* [ ] Detectar emails inválidos
* [ ] Detectar duplicados
* [ ] Mostrar preview
* [ ] Permitir mapear columnas
* [ ] Importar en batch
* [ ] Mostrar progreso
* [ ] Mostrar errores
* [ ] Descargar reporte de errores

---

# 20. SISTEMA DE COMPRAS

* [ ] Crear nueva compra
* [ ] Buscar cliente
* [ ] Crear cliente desde compra
* [ ] Ingresar monto
* [ ] Ingresar descripción
* [ ] Guardar compra
* [ ] Actualizar estadísticas
* [ ] Actualizar última compra
* [ ] Actualizar total gastado
* [ ] Actualizar ticket promedio
* [ ] Registrar empleado
* [ ] Evitar duplicados
* [ ] Permitir corrección segura
* [ ] Registrar auditoría de modificaciones

---

# 21. SISTEMA DE PUNTOS

## Configuración

* [ ] Definir sistema por negocio
* [ ] Puntos por monto
* [ ] Puntos por visita
* [ ] Puntos por acción
* [ ] Definir mínimo
* [ ] Definir redondeo
* [ ] Definir multiplicadores
* [ ] Activar/desactivar puntos

## Motor

* [ ] Crear point engine
* [ ] Calcular puntos
* [ ] Aplicar reglas
* [ ] Registrar movimiento
* [ ] Actualizar balance
* [ ] Evitar doble acreditación
* [ ] Permitir reversión
* [ ] Registrar razón
* [ ] Crear tests unitarios

---

# 22. PROGRAMA DE VISITAS

* [ ] Crear regla de visitas
* [ ] Registrar visita
* [ ] Crear sello
* [ ] Mostrar progreso
* [ ] Permitir 10 visitas → recompensa
* [ ] Configurar cantidad requerida
* [ ] Crear tests
* [ ] Evitar visitas duplicadas

---

# 23. RECOMPENSAS

* [ ] Crear reward CRUD
* [ ] Crear tipo de recompensa
* [ ] Definir requisito
* [ ] Definir beneficio
* [ ] Definir activo/inactivo
* [ ] Definir vencimiento opcional
* [ ] Mostrar recompensas
* [ ] Mostrar progreso
* [ ] Detectar desbloqueo
* [ ] Crear reward unlock
* [ ] Notificar desbloqueo
* [ ] Crear pantalla de recompensa

---

# 24. CANJE

* [ ] Crear código único
* [ ] Crear validación
* [ ] Crear expiración
* [ ] Crear redemption flow
* [ ] Validar customer
* [ ] Validar reward
* [ ] Validar business
* [ ] Confirmar canje
* [ ] Registrar employee
* [ ] Registrar timestamp
* [ ] Evitar reutilización
* [ ] Crear auditoría
* [ ] Crear tests de abuso

---

# 25. QR

## QR negocio

* [ ] Crear QR
* [ ] Definir destino
* [ ] Generar imagen
* [ ] Mostrar QR
* [ ] Descargar QR
* [ ] Regenerar QR
* [ ] Crear instrucciones de uso

## QR cliente

* [ ] Generar QR personal
* [ ] Mostrar QR
* [ ] Escanear QR
* [ ] Identificar cliente
* [ ] Crear operación
* [ ] Confirmar operación
* [ ] Manejar QR inválido
* [ ] Manejar QR expirado

---

# 26. EXPERIENCIA DEL CLIENTE

* [ ] Crear app web mobile-first
* [ ] Crear home
* [ ] Crear login
* [ ] Crear perfil
* [ ] Crear puntos
* [ ] Crear progreso
* [ ] Crear recompensas
* [ ] Crear historial
* [ ] Crear QR
* [ ] Crear beneficios
* [ ] Crear notificaciones
* [ ] Crear estado del cliente
* [ ] Crear empty states
* [ ] Crear error states
* [ ] Crear loading states

---

# 27. WHITE-LABEL

* [ ] Crear branding dinámico
* [ ] Nombre dinámico
* [ ] Logo dinámico
* [ ] Colores dinámicos
* [ ] Textos configurables
* [ ] Recompensas dinámicas
* [ ] Puntos dinámicos
* [ ] Favicon dinámico
* [ ] Metadata dinámica
* [ ] Title dinámico
* [ ] Open Graph dinámico
* [ ] Test business A
* [ ] Test business B
* [ ] Test business C
* [ ] Confirmar aislamiento

---

# 28. SLUGS

* [ ] Crear slug
* [ ] Validar slug
* [ ] Crear disponibilidad
* [ ] Evitar duplicados
* [ ] Crear route dinámica
* [ ] Detectar business
* [ ] Cargar branding
* [ ] Cargar datos correctos
* [ ] Manejar negocio inexistente
* [ ] Manejar slug inválido

---

# 29. DOMINIOS PERSONALIZADOS DEL FRONTEND

Separar frontend hosting de Supabase.

* [ ] Definir proveedor de hosting
* [ ] Definir arquitectura de dominios
* [ ] Definir wildcard subdomain
* [ ] Diseñar `club.negocio.com`
* [ ] Diseñar custom domains
* [ ] Asociar dominio a business
* [ ] Crear tabla de domains
* [ ] Verificar dominio
* [ ] Configurar DNS
* [ ] Configurar HTTPS
* [ ] Resolver host → business
* [ ] Cargar branding según host
* [ ] Manejar dominio no verificado
* [ ] Manejar dominio duplicado
* [ ] Documentar onboarding de dominio

---

# 30. DASHBOARD

* [ ] Crear dashboard layout
* [ ] Crear sidebar
* [ ] Crear header
* [ ] Crear summary cards
* [ ] Clientes totales
* [ ] Clientes activos
* [ ] Clientes nuevos
* [ ] Clientes en riesgo
* [ ] Clientes inactivos
* [ ] Clientes recuperados
* [ ] Compras
* [ ] Ticket promedio
* [ ] Puntos
* [ ] Recompensas
* [ ] Canjes
* [ ] Dinero recuperado
* [ ] Actividad reciente
* [ ] Alertas
* [ ] Empty states

---

# 31. ESTADOS DEL CLIENTE

Crear:

```text
NEW
ACTIVE
AT_RISK
INACTIVE
RECOVERED
```

* [ ] Definir reglas
* [ ] Definir transiciones
* [ ] Implementar cálculo
* [ ] Implementar actualización
* [ ] Mostrar estado
* [ ] Crear tests

---

# 32. INTELIGENCIA DE FRECUENCIA

* [ ] Calcular intervalos
* [ ] Calcular media
* [ ] Calcular mediana si conviene
* [ ] Ignorar outliers extremos cuando corresponda
* [ ] Comparar último intervalo
* [ ] Detectar retraso
* [ ] Crear score básico
* [ ] Crear niveles de riesgo
* [ ] Mostrar explicación del riesgo
* [ ] Crear tests con diferentes frecuencias

Ejemplo:

Cliente A:

```text
Compra cada 7 días
Día 14 sin comprar
→ riesgo
```

Cliente B:

```text
Compra cada 35 días
Día 14
→ activo
```

---

# 33. RISK SCORE

* [ ] Definir fórmula inicial
* [ ] Recency
* [ ] Frequency
* [ ] Purchase count
* [ ] Spend
* [ ] Trend
* [ ] Campaign response
* [ ] Normalizar 0–100
* [ ] Mostrar riesgo
* [ ] Crear tests
* [ ] Documentar fórmula

No utilizar IA para esta primera versión si no es necesaria.

---

# 34. SEGMENTACIÓN

Crear segmentos:

* [ ] New

* [ ] Active

* [ ] Frequent

* [ ] VIP

* [ ] At Risk

* [ ] Inactive

* [ ] High Spend

* [ ] Low Spend

* [ ] Near Reward

* [ ] Reward Available

* [ ] Birthday

* [ ] Crear motor de filtros

* [ ] Combinar condiciones

* [ ] Guardar segmentos

* [ ] Mostrar cantidad estimada

* [ ] Testear segmentos

---

# 35. CAMPAÑAS

* [ ] Crear campaign CRUD
* [ ] Definir objetivo
* [ ] Definir segmento
* [ ] Definir mensaje
* [ ] Definir beneficio
* [ ] Definir canal
* [ ] Crear preview
* [ ] Crear confirmación
* [ ] Crear historial
* [ ] Crear estados

Estados:

```text
DRAFT
SCHEDULED
PROCESSING
SENT
COMPLETED
FAILED
CANCELLED
```

---

# 36. RECUPERACIÓN

* [ ] Crear lista de clientes en riesgo
* [ ] Crear lista de inactivos
* [ ] Mostrar valor histórico
* [ ] Seleccionar segmento
* [ ] Crear campaña
* [ ] Crear beneficio
* [ ] Registrar envío
* [ ] Registrar respuesta
* [ ] Registrar vuelta
* [ ] Registrar compra
* [ ] Marcar RECOVERED
* [ ] Medir ventas recuperadas

---

# 37. ATRIBUCIÓN

* [ ] Definir ventana de atribución
* [ ] Definir evento de conversión
* [ ] Diseñar attribution model
* [ ] Crear campaign attribution
* [ ] Relacionar compra con campaña
* [ ] Crear código/coupon attribution cuando convenga
* [ ] Evitar atribuciones falsas
* [ ] Mostrar ventas atribuidas
* [ ] Mostrar recuperados
* [ ] Documentar limitaciones

---

# 38. ROI

* [ ] Mostrar costo mensual
* [ ] Mostrar ventas atribuidas
* [ ] Mostrar ratio ventas/costo
* [ ] Diferenciar revenue de profit
* [ ] Crear explicación
* [ ] Evitar claims garantizados
* [ ] Mostrar evolución mensual

---

# 39. NOTIFICACIONES

* [ ] Diseñar notification system
* [ ] Recompensa desbloqueada
* [ ] Recompensa próxima
* [ ] Puntos obtenidos
* [ ] Campaña
* [ ] Cumpleaños
* [ ] Cliente en riesgo
* [ ] Cliente recuperado
* [ ] Preferencias
* [ ] Opt-out

---

# 40. WHATSAPP

Antes de implementar:

* [ ] Investigar proveedor oficial
* [ ] Revisar costos
* [ ] Revisar templates
* [ ] Revisar consentimiento
* [ ] Revisar límites
* [ ] Diseñar integración
* [ ] Diseñar secrets
* [ ] Crear Edge Function si corresponde
* [ ] Implementar mensaje individual
* [ ] Implementar campañas
* [ ] Registrar delivery
* [ ] Registrar replies
* [ ] Registrar failures
* [ ] Registrar opt-out
* [ ] Crear rate limiting
* [ ] Crear logs
* [ ] Crear pruebas

---

# 41. EDGE FUNCTIONS

Utilizar Edge Functions solamente donde tenga sentido.

Posibles funciones:

* [ ] process-purchase

* [ ] redeem-reward

* [ ] send-campaign

* [ ] send-whatsapp

* [ ] calculate-customer-risk

* [ ] import-customers

* [ ] process-attribution

* [ ] domain-verification

* [ ] future billing webhook

* [ ] Crear estructura

* [ ] Validar auth

* [ ] Validar permisos

* [ ] Validar inputs

* [ ] Manejar errores

* [ ] Crear logs

* [ ] Crear tests

Supabase Edge Functions son funciones TypeScript server-side y pueden utilizarse para webhooks e integraciones con terceros.

---

# 42. STORAGE

* [ ] Configurar bucket logos
* [ ] Configurar bucket assets
* [ ] Crear políticas
* [ ] Validar MIME type
* [ ] Validar tamaño
* [ ] Crear upload
* [ ] Crear delete seguro
* [ ] Crear URLs
* [ ] Optimizar imágenes
* [ ] Evitar acceso cross-tenant

---

# 43. ADMIN INTERNO

Crear futuro panel de administración de TU empresa.

* [ ] Crear admin auth
* [ ] Crear businesses list
* [ ] Ver negocio
* [ ] Ver estado
* [ ] Ver métricas
* [ ] Ver plan
* [ ] Ver usuarios
* [ ] Ver incidencias
* [ ] Ver logs
* [ ] Suspender negocio
* [ ] Reactivar negocio

---

# 44. SOPORTE

* [ ] Crear soporte interno
* [ ] Crear contacto
* [ ] Crear FAQ
* [ ] Crear documentación básica
* [ ] Crear onboarding guide
* [ ] Crear troubleshooting guide
* [ ] Crear mensajes de error útiles

---

# 45. BILLING FUTURO

No bloquear MVP.

* [ ] Diseñar planes
* [ ] Diseñar pricing
* [ ] Diseñar subscription state
* [ ] Diseñar trial
* [ ] Diseñar payment provider
* [ ] Diseñar webhook
* [ ] Diseñar invoices
* [ ] Diseñar cancellation
* [ ] Diseñar grace period
* [ ] Implementar cuando exista demanda real

---

# 46. AUDITORÍA

Crear `audit_logs`.

Registrar eventos importantes:

* [ ] login

* [ ] logout

* [ ] customer_created

* [ ] customer_updated

* [ ] purchase_created

* [ ] points_adjusted

* [ ] reward_created

* [ ] reward_redeemed

* [ ] campaign_created

* [ ] business_settings_changed

* [ ] employee_added

* [ ] permission_changed

* [ ] Crear tabla

* [ ] Crear helper

* [ ] Integrar eventos críticos

* [ ] Proteger logs

---

# 47. VALIDACIÓN DE INPUTS

* [ ] Validar formularios
* [ ] Validar monto
* [ ] Validar teléfono
* [ ] Validar email
* [ ] Validar UUID
* [ ] Validar business_id
* [ ] Validar reward_id
* [ ] Validar campaign_id
* [ ] Sanitizar inputs
* [ ] Manejar campos vacíos
* [ ] Manejar valores negativos
* [ ] Manejar valores imposibles

---

# 48. ERROR HANDLING

Crear manejo consistente de:

* [ ] Network errors
* [ ] Auth errors
* [ ] Database errors
* [ ] Validation errors
* [ ] Permission errors
* [ ] Not found
* [ ] Timeout
* [ ] Rate limit
* [ ] Third-party errors

Crear:

* [ ] mensajes user-friendly
* [ ] logs técnicos
* [ ] error boundaries
* [ ] fallback UI

---

# 49. TESTING UNITARIO

Testear:

* [ ] puntos
* [ ] frecuencia
* [ ] risk score
* [ ] estados
* [ ] recompensas
* [ ] canjes
* [ ] segmentos
* [ ] atribución
* [ ] validaciones

---

# 50. TESTING INTEGRACIÓN

* [ ] signup
* [ ] login
* [ ] create business
* [ ] create customer
* [ ] create purchase
* [ ] points update
* [ ] reward unlock
* [ ] reward redemption
* [ ] campaign
* [ ] recovery
* [ ] QR flow

---

# 51. TESTING E2E

Crear escenarios:

### Scenario 1

Cliente nuevo:

```text
registrar
→ comprar
→ obtener puntos
```

### Scenario 2

Cliente frecuente:

```text
10 compras
→ recompensa
→ canje
```

### Scenario 3

Cliente inactivo:

```text
deja de comprar
→ detectado
→ campaña
→ vuelve
→ compra
→ recovered
```

### Scenario 4

Multi-tenant:

```text
Business A
→ customer A

Business B
→ customer B

A nunca ve B
```

---

# 52. SEGURIDAD DE LA APLICACIÓN

* [ ] Revisar auth
* [ ] Revisar RLS
* [ ] Revisar APIs
* [ ] Revisar Edge Functions
* [ ] Revisar Storage policies
* [ ] Revisar secrets
* [ ] Revisar CORS
* [ ] Revisar rate limiting
* [ ] Revisar CSRF si corresponde
* [ ] Revisar XSS
* [ ] Revisar abuso de QR
* [ ] Revisar reward abuse
* [ ] Revisar privilege escalation
* [ ] Revisar cross-tenant access

---

# 53. ANTI-FRAUDE

* [ ] Detectar doble compra
* [ ] Detectar doble canje
* [ ] Detectar códigos reutilizados
* [ ] Detectar manipulación de puntos
* [ ] Registrar empleado
* [ ] Registrar timestamps
* [ ] Registrar IP/device cuando sea apropiado y legal
* [ ] Crear límites
* [ ] Crear auditoría

---

# 54. PERFORMANCE

* [ ] Revisar queries
* [ ] Revisar índices
* [ ] Evitar N+1
* [ ] Agregar pagination
* [ ] Optimizar imágenes
* [ ] Optimizar bundles
* [ ] Lazy load donde convenga
* [ ] Revisar dashboard
* [ ] Revisar mobile
* [ ] Revisar tiempos de carga

---

# 55. UX MOBILE

* [ ] Diseñar mobile-first
* [ ] Revisar botones
* [ ] Revisar formularios
* [ ] Revisar navegación
* [ ] Revisar tamaños
* [ ] Revisar accesibilidad
* [ ] Revisar teclado móvil
* [ ] Revisar QR
* [ ] Revisar reward flow
* [ ] Revisar install flow

---

# 56. PWA

* [ ] Crear manifest
* [ ] Crear app name dinámico
* [ ] Crear icon dinámico
* [ ] Crear favicon dinámico
* [ ] Configurar standalone
* [ ] Configurar theme color
* [ ] Configurar display
* [ ] Configurar service worker si necesario
* [ ] Test iPhone
* [ ] Test Android
* [ ] Test desktop
* [ ] Test install
* [ ] Test update

---

# 57. APPLE / ANDROID FUTURO

NO implementar hasta validar producto web.

* [ ] Evaluar React Native
* [ ] Evaluar Expo
* [ ] Reutilizar lógica
* [ ] Definir navegación
* [ ] Definir auth mobile
* [ ] Definir push notifications
* [ ] Crear iOS project
* [ ] Crear Android project
* [ ] Crear app icons
* [ ] Crear splash
* [ ] Crear deep links
* [ ] Crear universal links
* [ ] Crear app-specific branding
* [ ] Diseñar build pipeline
* [ ] Diseñar publicación
* [ ] Crear app de prueba
* [ ] Preparar App Store
* [ ] Preparar Google Play

No crear una app nativa independiente por cada negocio hasta validar que realmente sea comercialmente necesario.

---

# 58. SEO / PUBLIC

Para páginas públicas:

* [ ] Metadata
* [ ] title
* [ ] description
* [ ] favicon
* [ ] Open Graph
* [ ] robots
* [ ] sitemap cuando corresponda
* [ ] canonical
* [ ] 404
* [ ] social preview

---

# 59. LANDING COMERCIAL

* [ ] Crear landing principal
* [ ] Crear hero
* [ ] Crear problema
* [ ] Crear solución
* [ ] Crear puntos
* [ ] Crear recompensas
* [ ] Crear recuperación
* [ ] Crear dashboard
* [ ] Crear resultados
* [ ] Crear demo
* [ ] Crear pricing
* [ ] Crear CTA
* [ ] Crear FAQ
* [ ] Crear contacto

---

# 60. DEMO

Crear negocio ficticio:

```text
CAFÉ CENTRAL
```

* [ ] Crear clientes ficticios
* [ ] Crear compras ficticias
* [ ] Crear puntos
* [ ] Crear recompensas
* [ ] Crear clientes en riesgo
* [ ] Crear clientes inactivos
* [ ] Crear campañas
* [ ] Crear clientes recuperados
* [ ] Crear métricas
* [ ] Crear dinero recuperado ficticio
* [ ] Etiquetar claramente datos DEMO
* [ ] Crear recorrido de demo
* [ ] Crear reset de demo

---

# 61. SEED DATA

* [ ] Crear negocios demo
* [ ] Crear clientes demo
* [ ] Crear compras demo
* [ ] Crear rewards demo
* [ ] Crear campaigns demo
* [ ] Crear attribution demo
* [ ] Crear realistic datasets
* [ ] Evitar datos personales reales
* [ ] Crear script de reset

---

# 62. OBSERVABILIDAD

* [ ] Crear logging
* [ ] Crear error logging
* [ ] Crear performance monitoring
* [ ] Crear health check
* [ ] Crear status endpoint
* [ ] Crear alertas
* [ ] Crear logs de Edge Functions
* [ ] Documentar dónde mirar cuando algo falla

---

# 63. CI/CD

* [ ] Crear GitHub Actions
* [ ] Ejecutar install
* [ ] Ejecutar lint
* [ ] Ejecutar typecheck
* [ ] Ejecutar tests
* [ ] Ejecutar build
* [ ] Bloquear merge si falla
* [ ] Configurar deploy de preview
* [ ] Configurar deploy production
* [ ] Configurar secrets correctamente

---

# 64. ENVIRONMENTS

Separar:

```text
LOCAL
DEV
STAGING
PRODUCTION
```

* [ ] Definir arquitectura
* [ ] Crear dev
* [ ] Crear staging
* [ ] Crear production cuando corresponda
* [ ] Definir variables
* [ ] Definir migrations
* [ ] Definir deploy flow
* [ ] Documentar

---

# 65. BACKUPS Y RECOVERY

* [ ] Entender backups disponibles
* [ ] Documentar estrategia
* [ ] Definir disaster recovery
* [ ] Crear recovery checklist
* [ ] Testear restoration en entorno seguro
* [ ] Documentar restauración

---

# 66. DEPLOY

* [ ] Elegir hosting frontend
* [ ] Configurar repository
* [ ] Configurar build
* [ ] Configurar variables
* [ ] Configurar preview
* [ ] Configurar production
* [ ] Configurar dominio
* [ ] Configurar HTTPS
* [ ] Verificar PWA
* [ ] Verificar Supabase
* [ ] Verificar Auth
* [ ] Verificar Storage
* [ ] Ejecutar smoke tests

---

# 67. PRIMER CLIENTE REAL

* [ ] Seleccionar negocio piloto
* [ ] Crear business
* [ ] Configurar branding
* [ ] Crear programa
* [ ] Crear recompensa
* [ ] Importar clientes
* [ ] Generar QR
* [ ] Capacitar al dueño
* [ ] Registrar primera compra
* [ ] Registrar primer reward
* [ ] Registrar primer canje
* [ ] Ejecutar primera campaña
* [ ] Medir retorno
* [ ] Registrar problemas

---

# 68. VALIDACIÓN REAL

* [ ] Medir uso semanal
* [ ] Medir clientes registrados
* [ ] Medir clientes recurrentes
* [ ] Medir recompensas
* [ ] Medir canjes
* [ ] Medir recuperación
* [ ] Medir ventas atribuidas
* [ ] Entrevistar al dueño
* [ ] Registrar feedback
* [ ] Priorizar mejoras

---

# 69. SEGUNDO Y TERCER CLIENTE

* [ ] Onboard cliente 2
* [ ] Onboard cliente 3
* [ ] Comparar casos
* [ ] Encontrar problemas comunes
* [ ] Automatizar onboarding
* [ ] Mejorar producto
* [ ] Mejorar setup
* [ ] Mejorar documentación

---

# 70. CASO DE ÉXITO

Usar solamente datos reales.

* [ ] Registrar situación inicial
* [ ] Registrar clientes
* [ ] Registrar frecuencia
* [ ] Registrar inactivos
* [ ] Registrar campañas
* [ ] Registrar recuperados
* [ ] Registrar compras
* [ ] Registrar ventas atribuidas
* [ ] Crear before/after
* [ ] Pedir autorización para publicar
* [ ] Crear case study

---

# 71. 10 CLIENTES

* [ ] Llegar a 5 negocios
* [ ] Llegar a 10 negocios
* [ ] Revisar estabilidad
* [ ] Revisar costos
* [ ] Revisar soporte
* [ ] Revisar uso
* [ ] Revisar churn
* [ ] Revisar métricas
* [ ] Revisar arquitectura
* [ ] Revisar necesidad de escalar

---

# 72. PRICING

* [ ] Definir precio inicial
* [ ] Definir plan básico
* [ ] Definir plan profesional
* [ ] Definir plan premium
* [ ] Definir límites
* [ ] Definir setup fee si corresponde
* [ ] Definir costo adicional por sucursal
* [ ] Definir costo adicional por mensajes
* [ ] Revisar pricing después de clientes reales

---

# 73. MÉTRICAS DE TU PROPIA EMPRESA

Medir:

* [ ] MRR
* [ ] clientes activos
* [ ] clientes nuevos
* [ ] churn
* [ ] ARPU
* [ ] costo de adquisición
* [ ] tiempo de onboarding
* [ ] soporte
* [ ] uso por negocio
* [ ] dinero generado por cliente
* [ ] margen

---

# 74. SOPORTE Y OPERACIÓN

* [ ] Crear canal de soporte
* [ ] Crear onboarding guide
* [ ] Crear FAQs
* [ ] Crear troubleshooting
* [ ] Crear checklist de instalación
* [ ] Crear checklist de negocio nuevo
* [ ] Crear checklist de cierre
* [ ] Crear proceso para incidentes

---

# 75. DOCUMENTACIÓN TÉCNICA FINAL

* [ ] Documentar arquitectura
* [ ] Documentar frontend
* [ ] Documentar Supabase
* [ ] Documentar database
* [ ] Documentar migrations
* [ ] Documentar RLS
* [ ] Documentar Auth
* [ ] Documentar Edge Functions
* [ ] Documentar deployment
* [ ] Documentar domains
* [ ] Documentar PWA
* [ ] Documentar testing
* [ ] Documentar recovery

---

# 76. REVISIÓN FINAL DEL MVP

El MVP no se considera terminado hasta que funcione:

```text
BUSINESS
↓
LOGIN
↓
ONBOARDING
↓
CUSTOMER
↓
PURCHASE
↓
POINTS
↓
REWARD
↓
UNLOCK
↓
QR
↓
REDEMPTION
↓
DASHBOARD
↓
INACTIVE CUSTOMER
↓
RECOVERY CAMPAIGN
↓
RETURN
↓
MEASUREMENT
```

* [ ] Todo el flujo funciona
* [ ] Todo el flujo tiene tests
* [ ] Todo el flujo respeta multi-tenant
* [ ] Todo el flujo funciona en móvil
* [ ] No hay secrets expuestos
* [ ] No hay acceso cross-tenant
* [ ] Producción está separada
* [ ] Documentación actualizada

---

# 77. CHECKPOINT HUMANO OBLIGATORIO

El agente debe detenerse y pedir revisión humana antes de:

* [ ] tocar producción por primera vez
* [ ] ejecutar migraciones destructivas
* [ ] borrar datos
* [ ] cambiar arquitectura fundamental
* [ ] cambiar sistema de autenticación
* [ ] cambiar RLS de forma amplia
* [ ] configurar dominios reales
* [ ] configurar pagos reales
* [ ] conectar WhatsApp real
* [ ] publicar una app móvil
* [ ] utilizar credenciales reales
* [ ] cambiar datos de clientes reales

---

# 78. DEFINICIÓN DE "DONE"

Una tarea solamente puede marcarse como terminada cuando:

```text
[ ] Implementada
[ ] Revisada
[ ] Compila
[ ] Testeada
[ ] Sin errores conocidos
[ ] Documentada si corresponde
[ ] PROGRESS.md actualizado
[ ] TASKS.md actualizado
[ ] Commit realizado
```

---

# 79. REGLA DE AUTONOMÍA

Claude puede continuar automáticamente mientras:

* la tarea esté dentro del backlog;
* no requiera decisión de producto;
* no afecte producción;
* no requiera credenciales humanas;
* no implique riesgo de pérdida de datos;
* las pruebas estén pasando.

Cuando se cumpla cualquiera de estas condiciones:

```text
STOP
```

---

# 80. ORDEN OFICIAL DE CONSTRUCCIÓN

Reemplazado por **PLAN POR FASES** al inicio de este archivo (2026-10-08).

---

# 81. PRINCIPIO DE PRODUCTO

La aplicación existe para conseguir:

```text
CLIENTE
↓
COMPRA
↓
PUNTOS
↓
RECOMPENSA
↓
VUELVE
↓
COMPRA
↓
SE CONVIERTE EN FRECUENTE
```

Y cuando deja de venir:

```text
CLIENTE
↓
SE RETRASA
↓
RIESGO
↓
CAMPAÑA
↓
VUELVE
↓
RECUPERADO
```

---

# 82. MÉTRICA PRINCIPAL

La métrica comercial principal del producto es:

# DINERO RECUPERADO

Las demás métricas ayudan a explicar cómo se consiguió.

---

# 83. PRINCIPIO TÉCNICO

No duplicar aplicaciones por negocio.

No duplicar código por negocio.

No duplicar bases de datos por negocio.

Usar:

```text
UNA PLATAFORMA
+
UN BACKEND
+
UNA BASE DE DATOS
+
MUCHOS BUSINESS_ID
+
BRANDING DINÁMICO
```

---

# 84. VISIÓN FINAL

La plataforma debe poder convertirse en:

```text
Negocio A
→ su branding
→ sus clientes
→ sus puntos
→ sus recompensas
→ sus campañas

Negocio B
→ su branding
→ sus clientes
→ sus puntos
→ sus recompensas
→ sus campañas

Negocio C
→ su branding
→ sus clientes
→ sus puntos
→ sus recompensas
→ sus campañas
```

Todo funcionando sobre el mismo sistema.

---

# 85. REGLA FINAL

No construir una funcionalidad solamente porque sea técnicamente interesante.

Cada funcionalidad debe responder al menos una de estas preguntas:

```text
¿Ayuda a conseguir que el cliente vuelva?
¿Ayuda a aumentar la frecuencia?
¿Ayuda a recuperar un cliente?
¿Ayuda a demostrar que el cliente volvió?
¿Ayuda al negocio a operar mejor el sistema?
¿Ayuda a escalar el producto?
```

Si la respuesta es NO:

```text
NO ES PRIORIDAD.
```

# FIN DEL TASKS.MD
