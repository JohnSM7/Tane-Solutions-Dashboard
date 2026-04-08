import { ref } from 'vue';
import { supabase } from '../supabase';

export type UsuarioCompleto = {
  id: string;
  nombre: string;
  rol: 'ADMIN' | 'CLIENT';
  cliente_id: string | null;
  horas_disponibles_semana: number;
  clientes?: { nombre: string } | null;
  // Metadatos de auth (cargados por separado)
  email?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  created_at?: string;
};

/** Llama a la Edge Function admin-users */
async function callAdminFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useUsuariosAdmin() {
  const usuarios  = ref<UsuarioCompleto[]>([]);
  const loading   = ref(true);
  const loadingMeta = ref(false);

  const load = async () => {
    loading.value = true;
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, rol, cliente_id, horas_disponibles_semana, clientes(nombre)')
        .order('nombre');
      if (error) throw error;
      usuarios.value = (data ?? []) as unknown as UsuarioCompleto[];

      // Cargar metadatos de auth (email, último login) en segundo plano
      if (usuarios.value.length > 0) {
        loadingMeta.value = true;
        try {
          const result = await callAdminFn({
            action: 'get_metadata',
            userIds: usuarios.value.map(u => u.id),
          });
          const metaMap = new Map((result.users as any[]).map((u: any) => [u.id, u]));
          usuarios.value = usuarios.value.map(u => ({
            ...u,
            ...(metaMap.get(u.id) ?? {}),
          }));
        } catch { /* metadata es opcional, no bloquea */ }
        finally { loadingMeta.value = false; }
      }
    } finally { loading.value = false; }
  };

  load();

  return { usuarios, loading, loadingMeta, reload: load };
}

export async function crearUsuario(form: {
  email: string;
  password: string;
  nombre: string;
  rol: 'ADMIN' | 'CLIENT';
  cliente_id?: string | null;
  horas_disponibles_semana?: number;
}): Promise<UsuarioCompleto> {
  const result = await callAdminFn({ action: 'create', ...form });
  return result.usuario as UsuarioCompleto;
}

export async function eliminarUsuario(userId: string): Promise<void> {
  await callAdminFn({ action: 'delete', userId });
}

export async function enviarResetPassword(email: string): Promise<void> {
  await callAdminFn({
    action: 'reset_password',
    email,
    redirectTo: `${window.location.origin}/update-password`,
  });
}

export async function actualizarEmailUsuario(userId: string, email: string): Promise<void> {
  await callAdminFn({ action: 'update_email', userId, email });
}

export async function actualizarPerfilUsuario(
  id: string,
  updates: Partial<Pick<UsuarioCompleto, 'nombre' | 'rol' | 'cliente_id' | 'horas_disponibles_semana'>>
): Promise<UsuarioCompleto> {
  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select('id, nombre, rol, cliente_id, horas_disponibles_semana, clientes(nombre)')
    .single();
  if (error) throw error;
  return data as unknown as UsuarioCompleto;
}
