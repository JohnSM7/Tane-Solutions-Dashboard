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

    // Verificar JWT del llamante usando el cliente anon
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    // ── Cliente con service role para operaciones de admin ────────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Comprobar rol usando service role (bypasea RLS — evita 403 falsos)
    const { data: perfil } = await admin
      .from('usuarios')
      .select('rol')
      .eq('id', caller.id)
      .single();

    if (perfil?.rol !== 'ADMIN') return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const { action } = body;

    // ── CREATE (generateLink signup: crea usuario + link en una sola llamada) ──
    if (action === 'create') {
      const { email, nombre, rol, cliente_id, horas_disponibles_semana, redirectTo } = body;

      if (!email || !nombre || !rol) {
        return json({ error: 'Faltan campos obligatorios: email, nombre, rol' }, 400);
      }

      const fallbackRedirect = rol === 'CLIENT'
        ? 'https://tanesolutions-d86dc-6261c.web.app/update-password'
        : 'https://tanesolutions-d86dc-6261c.web.app/update-password';

      // Paso 1: crear el usuario via signup (evita el Internal Server Error de createUser)
      const { data: signupData, error: signupErr } = await admin.auth.admin.generateLink({
        type: 'signup',
        email,
        password: crypto.randomUUID(),
        options: { data: { nombre } },
      });
      if (signupErr) return json({ error: signupErr.message }, 400);

      const authUserId = (signupData as any)?.user?.id;
      if (!authUserId) return json({ error: 'No se pudo obtener el ID del usuario creado' }, 500);

      // Paso 2: generar link de tipo 'recovery' — dispara PASSWORD_RECOVERY en el cliente
      // y fuerza al usuario a crear su contraseña antes de acceder
      const { data: recoveryData } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: redirectTo ?? fallbackRedirect },
      });
      const setupLink = (recoveryData as any)?.properties?.action_link ?? null;

      // Paso 3: insertar perfil en tabla usuarios
      const { data: usuario, error: dbErr } = await admin
        .from('usuarios')
        .insert({
          id: authUserId,
          nombre,
          rol,
          cliente_id: cliente_id || null,
          horas_disponibles_semana: horas_disponibles_semana ?? 40,
        })
        .select()
        .single();

      if (dbErr) {
        await admin.auth.admin.deleteUser(authUserId);
        return json({ error: dbErr.message }, 400);
      }

      return json({ usuario, setupLink });
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

    // ── NOTIFY LINK (enviar email de nuevo link a todos los usuarios del cliente) ─
    if (action === 'notify-link') {
      const { cliente_id, clientName, titulo, url, descripcion } = body;
      if (!cliente_id || !titulo || !url) return json({ error: 'notify-link: faltan campos (cliente_id, titulo, url)' }, 400);

      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY no configurado' }, 500);

      // 1. Obtener usuarios CLIENT del cliente
      const { data: usuarios } = await admin
        .from('usuarios')
        .select('id, nombre')
        .eq('cliente_id', cliente_id)
        .eq('rol', 'CLIENT');

      if (!usuarios?.length) return json({ sent: 0 });

      // 2. Obtener emails desde auth
      const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const idSet = new Set(usuarios.map((u: any) => u.id));
      const targets = (authData?.users ?? [])
        .filter(u => idSet.has(u.id) && u.email)
        .map(u => ({ email: u.email!, nombre: (usuarios as any[]).find((us: any) => us.id === u.id)?.nombre || clientName || 'Cliente' }));

      if (!targets.length) return json({ sent: 0 });

      // 3. Enviar email a cada uno
      const descRow = descripcion ? `<tr><td style="padding:6px 0;color:#999;font-size:13px;white-space:nowrap;width:140px;">Descripción</td><td style="padding:6px 0;color:#e5e5e5;font-size:13px;">${descripcion}</td></tr>` : '';
      const results = await Promise.all(targets.map(async (t) => {
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;">
<tr><td style="background:#E3FF04;padding:16px 32px;font-size:20px;font-weight:800;color:#000;letter-spacing:0.08em;">TANE SOLUTIONS</td></tr>
<tr><td style="padding:32px;color:#e5e5e5;font-size:15px;line-height:1.7;">
  <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">Nuevo contenido en tu portal</h2>
  <p style="margin:0 0 24px;color:#aaa;font-size:14px;">Hola, <strong style="color:#e5e5e5;">${t.nombre}</strong>. Tu equipo de Tane Solutions ha compartido nuevo contenido contigo.</p>
  <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;"/>
  <div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:20px 24px;margin:0 0 24px;">
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr><td style="padding:6px 0;color:#999;font-size:13px;white-space:nowrap;width:140px;">Título</td><td style="padding:6px 0;color:#e5e5e5;font-size:13px;"><strong>${titulo}</strong></td></tr>
      ${descRow}
      <tr><td style="padding:6px 0;color:#999;font-size:13px;">Enlace</td><td style="padding:6px 0;font-size:13px;"><a href="${url}" style="color:#E3FF04;text-decoration:none;word-break:break-all;">${url}</a></td></tr>
    </table>
  </div>
  <table cellpadding="0" cellspacing="0" style="margin:28px 0 4px;">
    <tr><td style="border-radius:6px;background:#E3FF04;"><a href="https://clientes.tanesolutions.com/client-panel" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#000;text-decoration:none;border-radius:6px;">Ver en mi portal</a></td></tr>
  </table>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #2a2a2a;color:#666;font-size:12px;">© Tane Solutions · Mensaje automático.</td></tr>
</table></td></tr></table></body></html>`;

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Tane Solutions <noreply@tanesolutions.com>',
            to: [t.email],
            subject: `Nuevo contenido en tu portal — ${titulo}`,
            html,
          }),
        });
        return res.ok;
      }));

      return json({ sent: results.filter(Boolean).length });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);

  } catch (err: any) {
    return json({ error: err?.message ?? 'Error interno' }, 500);
  }
});
