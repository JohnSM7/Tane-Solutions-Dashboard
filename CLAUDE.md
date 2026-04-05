# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Type-check with vue-tsc, then build for production
npm run preview   # Preview the production build locally
```

There is no test runner or linter configured in this project.

## Architecture

**Stack:** Vue 3 (Composition API + `<script setup>`) · TypeScript · Vite · Vue Router 4 · Supabase (auth + DB) · jsPDF · Native CSS with variables (no CSS framework).

### Backend: Supabase

`src/supabase.ts` exports the Supabase client. The DB schema is in `supabase_schema_v2.sql` (run once) plus `supabase_patch_facturas.sql` (adds invoice numbering and project-invoice linking).

Key tables: `clientes`, `sedes`, `documentos`, `perfiles`, `leads`, `facturas`, `proyectos_rentabilidad`, `proyectos`, `miembros_equipo`, `tickets`, `servidores`. All have Row Level Security policies enforced via `get_my_role()` and `get_my_client_id()` helper functions.

`src/services/seed.ts` seeds demo data (Bar La Flecha client + admin/client users). Run once from the browser console or a one-off script.

### Auth & Role System

`src/store/auth.ts` is a plain Vue `reactive()` object — no Pinia or Vuex. It exposes `authStore`, `login()`, `logout()`, and `initAuth()`. Auth uses real Supabase credentials (`supabase.auth.signInWithPassword`). On app boot, `main.ts` awaits `initAuth()` before mounting, so auth state is always resolved before the router guards fire.

Roles are stored in the `perfiles` table (`rol` field: `'ADMIN'` or `'CLIENT'`). `loadProfile()` fetches the profile after every sign-in and populates `authStore.role` and `authStore.user`.

The router (`src/router/index.ts`) enforces access via `beforeEach` guards:
- `meta: { requiresAuth: true, roles: ['ADMIN'] }` — admin-only routes
- `meta: { requiresAuth: true, roles: ['CLIENT'] }` — client-only routes
- `meta: { requiresGuest: true }` — redirects authenticated users away from `/login`
- `/update-password` — accessible without auth (for password reset flow)

### Services layer (`src/services/`)

Each module exports composables and CRUD helpers:
- `clients.ts` — `useClientsList()`, `useClientProfile(clientId)`, `createClient()`
- `financial.ts` — `useFinancialData()`, CRUD for `facturas` and `proyectos_rentabilidad`, `createFacturasFromPlan()`, `generateInvoicePDF()`
- `commercial.ts`, `operations.ts`, `support.ts` — module-specific composables
- `seed.ts` — one-time demo data seeder

`useClientProfile` returns all data for a client (facturas, proyectos, sedes, documentos, usuarios) plus mutation functions. Only call it **once** per component — it creates independent reactive state each invocation.

### Views & Layout

`App.vue` is a flex layout: `Sidebar` (hidden when unauthenticated) + `<RouterView>`.

Admin routes: `/commercial`, `/financial`, `/operations`, `/support`, `/clients`, `/clients/:id`  
Client route: `/client-panel`  
Auth routes: `/login`, `/update-password`

### Styling

All dashboard UI uses CSS custom properties defined per-component/view:
- `--color-primary` — lime green `#E3FF04` (brand color)
- `--color-bg-dark` — main background
- `--color-bg-card` — card/sidebar background
- `--color-bg-lighter` — input backgrounds
- `--color-border` — borders
- `--color-text-light` / `--color-text-muted` — text hierarchy

`DashboardCard` (`src/components/DashboardCard.vue`) is the base card container: `title` prop + default slot + `actions` slot (header right side).

Mobile breakpoint: `768px`. Sidebar hides off-screen, toggled by hamburger button.
