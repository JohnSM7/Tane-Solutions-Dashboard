import { reactive } from 'vue';
import { supabase } from '../supabase';

export type UserRole = 'ADMIN' | 'CLIENT' | null;

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole;
  user: { name: string; email: string; clientId: string | null } | null;
  loading: boolean;
  sessionExpired: boolean;
}

export const authStore = reactive<AuthState>({
  isAuthenticated: false,
  role: null,
  user: null,
  loading: true,
  sessionExpired: false,
});

const log = (...args: unknown[]) =>
  console.log(`[auth ${new Date().toISOString()}]`, ...args);

async function loadProfile(userId: string, email: string): Promise<void> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('nombre, rol, cliente_id')
    .eq('id', userId)
    .single();

  if (error) { log('loadProfile ERROR', error.message); return; }

  if (data) {
    authStore.isAuthenticated = true;
    authStore.role = data.rol;
    authStore.user = { name: data.nombre, email, clientId: data.cliente_id ?? null };
    authStore.sessionExpired = false;
    log('loadProfile OK — rol:', data.rol);
  } else {
    log('loadProfile — sin datos de perfil');
  }
}

export const login = async (email: string, password: string): Promise<void> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.user) await loadProfile(data.user.id, data.user.email!);
};

export const logout = async (): Promise<void> => {
  await supabase.auth.signOut();
  authStore.isAuthenticated = false;
  authStore.role = null;
  authStore.user = null;
  authStore.sessionExpired = false;
};

export const initAuth = async (): Promise<void> => {
  if (
    window.location.hash.includes('type=recovery') &&
    !window.location.pathname.includes('/update-password')
  ) {
    authStore.loading = false;
    window.location.replace('/update-password' + window.location.hash);
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    log('initAuth getSession —', session ? `sesión activa (exp: ${new Date(session.expires_at! * 1000).toISOString()})` : 'sin sesión');
    if (session?.user) {
      await loadProfile(session.user.id, session.user.email!);
    }
  } catch (e) {
    console.error('initAuth error:', e);
  } finally {
    authStore.loading = false;
  }

  let wasAuthenticatedOnSignOut = false;
  let signOutTimer: ReturnType<typeof setTimeout> | null = null;

  supabase.auth.onAuthStateChange(async (event, session) => {
    log(`onAuthStateChange → ${event}`, session ? `(exp: ${new Date(session.expires_at! * 1000).toISOString()})` : '(sin sesión)');

    if (signOutTimer) { clearTimeout(signOutTimer); signOutTimer = null; }

    if (event === 'SIGNED_IN' && session?.user) {
      if (!authStore.isAuthenticated) {
        await loadProfile(session.user.id, session.user.email!).catch(console.error);
      } else {
        log('SIGNED_IN con sesión ya activa — omitiendo loadProfile redundante');
      }
      if (wasAuthenticatedOnSignOut) {
        log('SIGNED_IN tras SIGNED_OUT transitorio → dispatching auth:recovered');
        wasAuthenticatedOnSignOut = false;
        window.dispatchEvent(new CustomEvent('auth:recovered'));
      }

    } else if (event === 'TOKEN_REFRESHED' && session?.user) {
      if (!authStore.isAuthenticated) {
        await loadProfile(session.user.id, session.user.email!).catch(console.error);
      }
      if (wasAuthenticatedOnSignOut) {
        log('TOKEN_REFRESHED tras SIGNED_OUT transitorio → dispatching auth:recovered');
        wasAuthenticatedOnSignOut = false;
        window.dispatchEvent(new CustomEvent('auth:recovered'));
      } else {
        log('TOKEN_REFRESHED normal (sin SIGNED_OUT previo) — sin acción');
      }

    } else if (event === 'SIGNED_OUT') {
      wasAuthenticatedOnSignOut = authStore.isAuthenticated;
      log(`SIGNED_OUT — wasAuthenticated: ${wasAuthenticatedOnSignOut} — esperando 8s para comprobar rotación`);

      signOutTimer = setTimeout(async () => {
        log('SIGNED_OUT debounce (8s) — intentando refreshSession...');
        try {
          const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
          if (error) log('refreshSession error:', error.message);
          if (refreshed?.user) {
            log('refreshSession OK — sesión recuperada');
            if (!authStore.isAuthenticated) {
              await loadProfile(refreshed.user.id, refreshed.user.email!).catch(console.error);
            }
            if (wasAuthenticatedOnSignOut) {
              wasAuthenticatedOnSignOut = false;
              window.dispatchEvent(new CustomEvent('auth:recovered'));
            }
            return;
          }
          log('refreshSession devolvió sesión nula — pasando a getSession...');
        } catch (e) {
          log('refreshSession excepción:', e);
        }

        try {
          const { data: { session: current }, error } = await supabase.auth.getSession();
          if (error) log('getSession error:', error.message);
          log('getSession resultado:', current ? `sesión válida (exp: ${new Date(current.expires_at! * 1000).toISOString()})` : 'SIN sesión');
          if (!current) {
            log('⚠️ Sin sesión real — marcando sessionExpired');
            wasAuthenticatedOnSignOut = false;
            authStore.isAuthenticated = false;
            authStore.role = null;
            authStore.user = null;
            authStore.sessionExpired = true;
          } else if (wasAuthenticatedOnSignOut) {
            log('Sesión válida pero TOKEN_REFRESHED no llegó — dispatching auth:recovered');
            if (!authStore.isAuthenticated) {
              await loadProfile(current.user.id, current.user.email!).catch(console.error);
            }
            wasAuthenticatedOnSignOut = false;
            window.dispatchEvent(new CustomEvent('auth:recovered'));
          }
        } catch (e) {
          log('getSession excepción — sin acción para evitar falso logout:', e);
        }
      }, 8000);

    } else if (event === 'PASSWORD_RECOVERY') {
      if (!window.location.pathname.includes('/update-password')) {
        window.location.replace('/update-password');
      }
    }
  });
};
