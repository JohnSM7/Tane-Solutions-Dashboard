import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error crítico: Faltan variables de entorno de Supabase. Revisa el archivo .env');
}

// Wraps data fetches with a 12-second timeout so queries that hang
// fail fast instead of leaving views stuck on "Cargando...".
// Auth requests (/auth/) are excluded: aborting a token-refresh mid-flight
// causes Supabase to fire SIGNED_OUT and lose the session.
const fetchWithTimeout = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input
    : input instanceof URL ? input.href
    : (input as Request).url;
  if (url.includes('/auth/')) return globalThis.fetch(input, init);
  const short = url.replace(/\?.*$/, '').replace(/.*\/rest\/v1\//, '').replace(/.*\/functions\/v1\//, 'fn/');
  const method = (init?.method ?? 'GET').toUpperCase();
  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
  // Mutations get a 30s timeout (some involve Edge Functions or slow writes).
  // Reads get 12s — enough for normal queries but fail fast when queued during auth init.
  const timeoutMs = isWrite ? 30_000 : 12_000;
  const t0 = Date.now();
  console.log(`[fetch →] ${method} ${short}`);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.warn(`[supabase timeout] Abortando request >${timeoutMs / 1000}s: ${method} ${short}`);
    controller.abort();
  }, timeoutMs);
  return globalThis.fetch(input, { ...init, signal: controller.signal })
    .then(r => { console.log(`[fetch ✓] ${method} ${short} (${Date.now() - t0}ms)`); return r; })
    .catch(e => { console.warn(`[fetch ✗] ${method} ${short} (${Date.now() - t0}ms)`, e.name); throw e; })
    .finally(() => clearTimeout(timer));
};

export const supabase = createClient(
  supabaseUrl as string,
  supabaseAnonKey as string,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: { fetch: fetchWithTimeout },
  }
);

