import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Verificar que el llamante es un ADMIN autenticado ─────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No authorization header' }, 401);

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: perfil } = await callerClient
      .from('usuarios')
      .select('rol')
      .eq('id', caller.id)
      .single();

    if (perfil?.rol !== 'ADMIN') return json({ error: 'Forbidden' }, 403);

    // ── Cliente con service role para operaciones de admin ────────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { action } = body;

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { email, password, nombre, rol, cliente_id, horas_disponibles_semana } = body;

      if (!email || !password || !nombre || !rol) {
        return json({ error: 'Faltan campos obligatorios: email, password, nombre, rol' }, 400);
      }

      // Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,   // no requiere confirmación de email
        user_metadata: { nombre },
      });
      if (authErr) return json({ error: authErr.message }, 400);

      // Insertar perfil en tabla usuarios
      const { data: usuario, error: dbErr } = await admin
        .from('usuarios')
        .insert({
          id: authData.user.id,
          nombre,
          rol,
          cliente_id: cliente_id || null,
          horas_disponibles_semana: horas_disponibles_semana ?? 40,
        })
        .select()
        .single();
      if (dbErr) {
        // Revertir: eliminar el usuario de auth si falla el insert
        await admin.auth.admin.deleteUser(authData.user.id);
        return json({ error: dbErr.message }, 400);
      }

      return json({ usuario });
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { userId } = body;
      if (!userId) return json({ error: 'userId requerido' }, 400);
      if (userId === caller.id) return json({ error: 'No puedes eliminarte a ti mismo' }, 400);

      await admin.from('usuarios').delete().eq('id', userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    // ── RESET PASSWORD (reenviar acceso) ──────────────────────────────────────
    if (action === 'reset_password') {
      const { email, redirectTo } = body;
      if (!email) return json({ error: 'email requerido' }, 400);

      const { error } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo ?? 'https://tudominio.com/update-password',
      });
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    // ── UPDATE EMAIL ──────────────────────────────────────────────────────────
    if (action === 'update_email') {
      const { userId, email } = body;
      if (!userId || !email) return json({ error: 'userId y email requeridos' }, 400);

      const { error } = await admin.auth.admin.updateUserById(userId, { email });
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    // ── GET AUTH METADATA (último login, estado confirmación) ─────────────────
    if (action === 'get_metadata') {
      const { userIds } = body as { userIds: string[] };
      if (!Array.isArray(userIds) || userIds.length === 0) return json({ users: [] });

      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (error) return json({ error: error.message }, 400);

      const idSet = new Set(userIds);
      const users = (data.users ?? [])
        .filter(u => idSet.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email,
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          created_at: u.created_at,
        }));

      return json({ users });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);

  } catch (err: any) {
    return json({ error: err?.message ?? 'Error interno' }, 500);
  }
});
