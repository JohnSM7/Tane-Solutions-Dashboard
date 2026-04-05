# Dashboard Tane Solutions

Panel de control interno desarrollado para **Tane Solutions** — agencia de marketing digital — con el objetivo de centralizar en una sola herramienta la gestión comercial, financiera, operativa, de soporte y de clientes. Diseñado en modo oscuro con el verde lima `#E3FF04` como color de marca y la tipografía *Unbounded*.

---

## Tecnologías

| Capa | Tecnología | Versión |
|---|---|---|
| Framework UI | Vue 3 — Composition API + `<script setup>` | ^3.5 |
| Lenguaje | TypeScript | ~5.9 |
| Build tool | Vite | ^7.2 |
| Routing | Vue Router 4 | ^4.6 |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + RLS) | ^2.101 |
| PDF | jsPDF | ^4.2 |
| Estilos | CSS nativo con variables (sin framework CSS) | — |
| Fuente | Unbounded (Google Fonts) | — |
| Node.js mínimo | v20 LTS | — |

**Sin Pinia, sin Vuex, sin Axios.** El estado global de auth se gestiona con un `reactive()` plano (`src/store/auth.ts`). Las peticiones van directamente a través del cliente Supabase.

---

## Desarrollo con IA

Este proyecto fue desarrollado íntegramente con asistencia de **Claude Code (Anthropic)** como par de programación. El flujo de trabajo habitual fue:

- Diseño de arquitectura y esquema de base de datos iterativo con Claude
- Implementación de componentes, servicios y lógica de negocio
- Detección y corrección de bugs (PGRST204, race conditions en carga, manejo de errores async)
- Cumplimiento fiscal español (facturas conformes a RD 1619/2012)
- Refactorizaciones continuas (separar joins de writes, strip de campos nested antes de INSERT/UPDATE, etc.)

**Modelo utilizado:** `claude-sonnet-4-6` vía Claude Code CLI.

---

## Arquitectura del Proyecto

```
src/
├── components/
│   ├── DashboardCard.vue        # Tarjeta base reutilizable (título + slot + slot actions)
│   └── layout/
│       └── Sidebar.vue          # Navegación lateral con badge de alertas dinámico
├── router/
│   └── index.ts                 # Vue Router con guards por rol (ADMIN / CLIENT)
├── services/                    # Capa de datos — composables + CRUD puro
│   ├── alerts.ts                # useAlertas() + fetchAlertasCount()
│   ├── clients.ts               # useClientsList(), useClientProfile(), createClient(), deleteClient()
│   ├── commercial.ts            # useCommercialData(), CRUD leads
│   ├── financial.ts             # useFinancialData(), CRUD facturas/proyectos, generateInvoicePDF()
│   ├── operations.ts            # useOperationsData(), CRUD proyectos/equipo
│   ├── seed.ts                  # Seed de datos demo (ejecutar una vez)
│   └── support.ts               # useSupportData(), CRUD tickets/servidores
├── store/
│   └── auth.ts                  # Estado global de autenticación (reactive sin Pinia)
├── views/
│   ├── AlertasView.vue          # /alerts — Centro de alertas cross-módulo
│   ├── AdminClientsView.vue     # /clients — Directorio CRM con CRUD
│   ├── AdminClientProfileView.vue # /clients/:id — Perfil completo 360º del cliente
│   ├── ClientPortalView.vue     # /client-panel — Portal del cliente (rol CLIENT)
│   ├── CommercialView.vue       # /commercial — Pipeline y leads
│   ├── FinancialView.vue        # /financial — Facturas, proyectos, tesorería
│   ├── OperationsView.vue       # /operations — Proyectos y equipo
│   ├── SupportView.vue          # /support — Tickets y servidores
│   ├── LoginView.vue            # /login
│   └── UpdatePasswordView.vue   # /update-password (flujo reset de contraseña)
├── supabase.ts                  # Cliente Supabase (singleton)
└── main.ts                      # Arranque: await initAuth() antes de montar la app
```

---

## Base de Datos (Supabase / PostgreSQL)

### Esquema

Los archivos SQL deben ejecutarse **en orden** en Supabase → SQL Editor:

| Archivo | Descripción |
|---|---|
| `supabase_schema_v2.sql` | Schema completo: tablas, RLS, políticas, datos demo |
| `supabase_patch_facturas.sql` | Añade `numero_factura`, `proyecto_id`, `pago_numero/total`, `plan_pago` |
| `supabase_patch_empresa.sql` | Añade `cif`, `direccion_facturacion` a clientes y `tipo_iva` a facturas |

### Tablas principales

| Tabla | Módulo | Notas |
|---|---|---|
| `clientes` | CRM / global | UUID PK, incluye CIF y dirección de facturación |
| `perfiles` | Auth | Vincula `auth.users` con `rol` (ADMIN/CLIENT) y `cliente_id` |
| `sedes` | CRM | Ubicaciones del cliente con datos GMB (rating, reseñas, sin responder) |
| `documentos` | CRM | Archivos en Supabase Storage, vinculados a cliente y sede |
| `leads` | Comercial | Pipeline de ventas con CAC y valor estimado |
| `facturas` | Financiero | Con `numero_factura` auto, `tipo_iva`, `proyecto_id`, fechas de vencimiento/pago |
| `proyectos_rentabilidad` | Financiero | Presupuesto vs coste real, plan de pagos |
| `proyectos` | Operaciones | Estado semáforo, fases, fechas de entrega |
| `miembros_equipo` | Operaciones | Horas disponibles vs asignadas por semana |
| `tickets` | Soporte | Prioridad, tiempo de primera respuesta, satisfacción |
| `servidores` | Soporte | Estado Online/Mantenimiento/Offline, uptime % |

### Row Level Security (RLS)

Todas las tablas tienen RLS activado. Las políticas usan dos funciones helper:

```sql
get_my_role()      -- devuelve 'ADMIN' o 'CLIENT' del usuario autenticado
get_my_client_id() -- devuelve el cliente_id del perfil del usuario
```

- **ADMIN**: acceso total a todas las tablas
- **CLIENT**: solo lectura de sus propios datos (por `cliente_id`)
- Excepción: `documentos` permite INSERT al cliente para subir archivos

---

## Sistema de Autenticación

- Auth real de Supabase (`signInWithPassword`)
- Al autenticar se carga el perfil desde la tabla `perfiles`
- `main.ts` hace `await initAuth()` antes de montar la app → los guards del router siempre tienen el rol resuelto
- Flujo de reset de contraseña vía email de Supabase → `/update-password`
- Roles: `ADMIN` (agencia) y `CLIENT` (cliente titular)

### Variables de entorno requeridas

Crear archivo `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Módulos

### Alertas (`/alerts`)
Centro de alertas cross-módulo. Detecta automáticamente:
- Facturas con estado `Vencida`
- Proyectos `En riesgo`, `Retrasado` o `Bloqueado`
- Sedes con reseñas GMB sin responder (`gmb_unanswered > 0`)
- Tickets de alta prioridad sin cerrar
- Servidores `Offline` o en `Mantenimiento`

El sidebar muestra un badge rojo con el recuento total al arrancar la app.

### Comercial (`/commercial`)
- KPIs: leads semanales, tasa de conversión, valor promedio ganado, CAC medio
- Embudo de ventas visual (pipeline por etapas)
- Tabla de leads con CRUD completo
- Ranking de servicios más vendidos

### Financiero (`/financial`)
- KPIs: facturación mensual, por cobrar, beneficio neto estimado, total cobrado
- Gráfico de facturación mes a mes (año actual vs anterior)
- **Previsión de tesorería**: gráfico de barras apiladas para los próximos 6 meses (cobrado / pendiente / vencido por `fecha_vencimiento`)
- Proyectos con facturación integrada: genera facturas automáticas según plan de pago (100%, 50/50, 40/60, 33/33/34)
- Facturas sueltas (sin proyecto)
- Generación de PDF de factura conforme a **RD 1619/2012** (España): datos fiscales agencia + cliente, base imponible, IVA desglosado, IBAN, número de factura

### Operaciones (`/operations`)
- KPIs: proyectos activos, tiempo medio de entrega, carga del equipo, entregas este mes
- Tabla de proyectos con estado semáforo y CRUD
- Barras de carga por miembro del equipo (horas asignadas / disponibles)
- CRUD completo de equipo

### Soporte (`/support`)
- KPIs: incidencias abiertas, tiempo de primera respuesta, satisfacción media, tickets cerrados
- CRUD de tickets con prioridad y estado
- CRUD de servidores con estado y uptime

### CRM — Clientes (`/clients`, `/clients/:id`)
- Directorio de clientes con búsqueda, filtro por estado y totales financieros (cobrado/pendiente)
- Crear y eliminar clientes
- Perfil 360º por cliente:
  - Datos fiscales (CIF, dirección de facturación)
  - Sedes con datos GMB
  - Documentos (upload a Supabase Storage)
  - Facturas del cliente
  - Proyectos
  - Usuarios vinculados

### Portal Cliente (`/client-panel`)
Vista de solo lectura para el rol `CLIENT`. Muestra sus proyectos, facturas y documentos.

---

## Generación de Facturas PDF

La función `generateInvoicePDF()` en `src/services/financial.ts` genera facturas conformes a la normativa española (RD 1619/2012). Incluye:

- Datos del emisor (agencia): nombre social, CIF, dirección, email, web
- Datos del receptor (cliente): nombre, CIF/NIF, dirección de facturación
- Número de factura (`FAC-YYYY-NNN` autonumérico)
- Fecha de emisión y vencimiento
- Base imponible + tipo IVA + cuota IVA + total
- Tipos de IVA soportados: 0%, 4%, 10%, 21%
- Nota de exención si IVA = 0% (art. 20 LIVA)
- Datos de pago: IBAN, concepto de transferencia
- Estado visual (Pagada / Pendiente / Vencida)

**Importante:** actualizar el objeto `AGENCIA` en `src/services/financial.ts` con los datos reales antes de generar facturas reales.

---

## Problemas conocidos y decisiones técnicas

### PGRST204 — "Could not find column in schema cache"
PostgREST (capa REST de Supabase) cachea el schema. Al hacer `ALTER TABLE`, el cache puede quedar desactualizado. **Síntoma:** los `INSERT`/`UPDATE` que incluyen campos de join (e.g. `clientes(nombre)`) en el `.select()` devuelven error 204.

**Solución aplicada:**
1. Todas las operaciones de escritura usan `.select('*')` — sin joins
2. Los helpers `stripFacturaJoins()` y `stripProyectoJoins()` eliminan campos de relación anidados del payload antes de enviarlo a Supabase (evita que objetos como `{ clientes: {...} }` lleguen al INSERT)
3. Tras cada escritura, los datos de cliente/proyecto se parchean en el frontend desde el estado reactivo ya cargado
4. Para forzar recarga del schema cache: `SELECT pg_notify('pgrst', 'reload schema');`

### Loading bloqueado / app congelada
Si una petición de carga falla (red, sesión expirada), `loading` se quedaba en `true` permanentemente.

**Solución:** todos los composables usan `.finally(() => { loading.value = false })`. El `initAuth()` tiene `try/catch/finally` para que `authStore.loading` siempre se desbloquee.

### Imágenes rotas (400 Storage)
Las URLs de logos guardadas en el campo `logo` de `clientes` que apunten a objetos privados de Supabase Storage devuelven 400. Los `<img>` tienen `@error` handler que oculta la imagen rota sin romper el layout.

Para que los logos funcionen, el bucket `documentos` debe tener acceso público activado en Supabase → Storage → Policies.

---

## Instalación

```bash
# 1. Clonar
git clone https://github.com/rankusx/Dashboard-TaneSolutions.git
cd Dashboard-TaneSolutions

# 2. Instalar dependencias
npm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 4. Base de datos
# Ejecutar en Supabase SQL Editor en este orden:
# 1. supabase_schema_v2.sql
# 2. supabase_patch_facturas.sql
# 3. supabase_patch_empresa.sql

# 5. Datos demo (opcional)
# Abrir la app, autenticarse como admin y ejecutar en consola del navegador:
# import('/src/services/seed.ts').then(m => m.seedDemo())

# 6. Desarrollo
npm run dev        # http://localhost:5173

# 7. Producción
npm run build
npm run preview
```

---

## Convenciones de código

- **Servicios** (`src/services/`): composables que devuelven estado reactivo + funciones CRUD. Nunca mezclan lógica de UI.
- **Vistas** (`src/views/`): consumen los servicios, gestionan modales y estado local de UI.
- **`useClientProfile`**: debe llamarse **una sola vez** por componente — crea estado reactivo independiente en cada invocación.
- **Moneda**: formato `es-ES` con sufijo ` €`. No usar `$`.
- **Fechas**: `toLocaleDateString('es-ES')` para display. ISO string para almacenamiento.
- **Errores async**: toda operación de escritura tiene `try/catch`. Toda carga inicial tiene `.finally()`.

---

## Pendiente / Roadmap

- [ ] Histórico GMB (snapshots periódicos para ver evolución del rating)
- [ ] Rentabilidad por cliente (cruzar facturas + proyectos_rentabilidad + leads.cac)
- [ ] Informe mensual PDF por cliente (GMB + proyectos + facturas + tickets)
- [ ] Scoring de salud del cliente (indicador 0-100 automático)
- [ ] Seguimiento de contratos y fechas de renovación
- [ ] Home real con KPIs globales (actualmente HomeView tiene datos de ejemplo)
- [ ] Notificaciones en tiempo real (Supabase Realtime)
