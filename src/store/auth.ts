import { reactive } from 'vue';
import { supabase } from '../supabase';

export type UserRole = 'ADMIN' | 'CLIENT' | null;

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole;
  user: { name: string; email: string; clientId: string | null } | null;
  loading: boolean;
}

export const authStore = reactive<AuthState>({
  isAuthenticated: false,
  role: null,
  user: null,
  loading: true,
});

async function loadProfile(userId: string, email: string): Promise<void> {
  const { data } = await supabase
    .from('usuarios')
    .select('nombre, rol, cliente_id')
    .eq('id', userId)
    .single();

  if (data) {
    authStore.isAuthenticated = true;
    authStore.role = data.rol;
    authStore.user = { name: data.nombre, email, clientId: data.cliente_id ?? null };
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
};

export const initAuth = async (): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadProfile(session.user.id, session.user.email!);
    }
  } catch (e) {
    console.error('initAuth error:', e);
  } finally {
    authStore.loading = false;
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await loadProfile(session.user.id, session.user.email!).catch(console.error);
    } else if (event === 'SIGNED_OUT') {
      authStore.isAuthenticated = false;
      authStore.role = null;
      authStore.user = null;
    } else if (event === 'PASSWORD_RECOVERY') {
      window.location.replace('/update-password');
    }
  });
};
