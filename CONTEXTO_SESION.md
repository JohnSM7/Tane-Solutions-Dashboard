# Contexto de sesión — Tane Solutions Dashboard

## Estado actual (2026-04-18)

### ✅ Ya hecho

1. **Fix proyectos ↔ clientes** — eliminado el join PostgREST problemático; ahora se hace consulta separada a `clientes` y se parchea client-side en `src/services/operations.ts`.
2. **`supabase_registros_horas.sql`** — SQL para crear la tabla `registros_horas` (ejecutar en Supabase > SQL Editor, **pendiente de ejecutar en producción**).
3. **`src/services/registros_horas.ts`** — servicio con:
   - `RegistroHoras` type
   - `getRegistrosByTarea(tareaId)`
   - `createRegistroHoras(form)`
   - `deleteRegistroHoras(id)`
   - `useResumenHoras()` — composable que agrega horas reales vs estimadas por proyecto/trabajador

---

## ❌ Pendiente de implementar

### 1. Reescribir `src/views/TareasView.vue`

Cambios requeridos respecto al archivo actual:

| Qué | Cómo |
|-----|------|
| **Drag-and-drop** entre columnas | HTML5 nativo: `draggable="true"` en cada card, `@dragstart` guarda `draggedId`, `@dragover.prevent` en la lista, `@drop` llama `updateTarea({estado})` |
| **Quitar botones ← →** | Eliminar el bloque `.card-actions` con `.move-btn` |
| **Campo "Asignado a"** en el modal crear/editar | `<select v-model="form.asignado_a">` con lista de `usuarios` donde `rol = 'ADMIN'` |
| **Filtro "Mis tareas"** | Toggle button en el header; filtra `tareas` por `asignado_a === currentUserId` |
| **Badge de iniciales** en cada card | `getUsuarioInitials(tarea.asignado_a)` — círculo con las iniciales del asignado |
| **Badge de horas reales** en cada card | `horasRealesMap.get(tarea.id)` — se carga al montar desde `registros_horas` |
| **Botón ⏱** en cada card | Abre modal de horas para esa tarea |
| **Modal de horas** | Resumen (estimadas / reales / desviación) + formulario añadir entrada + listado con botón eliminar |

#### Refs nuevos necesarios en el script:
```ts
const currentUserId   = ref<string | null>(null)   // supabase.auth.getUser()
const equipo          = ref<UsuarioAdmin[]>([])     // usuarios con rol ADMIN
const misTareasFilter = ref(false)
const draggedId       = ref<string | null>(null)
const dragOverColumn  = ref<string | null>(null)
const horasRealesMap  = ref(new Map<string, number>())

// Hours modal
const showHorasModal  = ref(false)
const horasModalTarea = ref<Tarea | null>(null)
const horasRegistros  = ref<RegistroHoras[]>([])
const horasForm       = ref({ fecha: '', horas: 0, descripcion: '' })
```

#### Imports nuevos:
```ts
import { getRegistrosByTarea, createRegistroHoras, deleteRegistroHoras } from '../services/registros_horas'
import type { RegistroHoras } from '../services/registros_horas'
```

---

### 2. Actualizar `src/views/OperationsView.vue`

Añadir una nueva `DashboardCard` con el resumen de horas por proyecto/trabajador.

```ts
// En <script setup>
import { useResumenHoras } from '../services/registros_horas'
const { resumen: resumenHoras, loading: loadingHoras } = useResumenHoras()
```

Tabla a mostrar:

| Proyecto | Trabajador | Estimadas | Reales | Desviación |
|----------|------------|-----------|--------|------------|

---

### 3. Ejecutar SQL en Supabase (manual)

Copiar y ejecutar en **Supabase > SQL Editor** el contenido de:
```
supabase_registros_horas.sql
```

---

### 4. Build, commit y push

```bash
npm run build
git add -A
git commit -m "feat: horas tracking, drag-and-drop kanban, asignación de tareas"
git push -u origin claude/client-report-module-kckNo
```

---

## Rama de trabajo

```
claude/client-report-module-kckNo
```

## Archivos clave

| Archivo | Estado |
|---------|--------|
| `src/services/registros_horas.ts` | ✅ Completo |
| `supabase_registros_horas.sql` | ✅ Listo (falta ejecutar en Supabase) |
| `src/views/TareasView.vue` | ❌ Pendiente reescribir |
| `src/views/OperationsView.vue` | ❌ Pendiente añadir resumen horas |
| `src/services/operations.ts` | ✅ Fix clientes join ya aplicado |

---

## Notas técnicas importantes

- **No usar joins PostgREST** con `proyectos ↔ clientes` — falla con 400. Usar consultas separadas + Map client-side.
- El join `usuarios!tareas_asignado_a_fkey(nombre)` en `tareas` **sí funciona** (FK está configurada).
- `useResumenHoras()` ya hace todo separado (4 queries sin joins) para evitar el mismo problema.
- La tabla `usuarios` = perfiles + miembros equipo (tras la migración `supabase_migrate_usuarios.sql`).
- RLS: la policy `rh_admin_all` en `registros_horas` usa `get_my_role() = 'ADMIN'`.
