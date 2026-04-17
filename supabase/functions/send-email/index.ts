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

// ── Shared HTML chrome ────────────────────────────────────────────────────────

function htmlWrap(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tane Solutions</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Card wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;">

          <!-- Header strip -->
          <tr>
            <td style="background:#E3FF04;padding:20px 32px;">
              <span style="font-size:20px;font-weight:800;color:#000;letter-spacing:0.08em;text-transform:uppercase;">
                TANE SOLUTIONS
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#e5e5e5;font-size:15px;line-height:1.7;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2a2a2a;color:#666;font-size:12px;line-height:1.5;">
              © Tane Solutions &nbsp;·&nbsp; Este es un mensaje automático, por favor no respondas a este correo.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 4px;">
    <tr>
      <td style="border-radius:6px;background:#E3FF04;">
        <a href="${url}"
           style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;
                  color:#000;text-decoration:none;border-radius:6px;letter-spacing:0.02em;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;" />`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#999;font-size:13px;white-space:nowrap;width:140px;">${label}</td>
    <td style="padding:6px 0;color:#e5e5e5;font-size:13px;">${value}</td>
  </tr>`;
}

// ── Email builders ────────────────────────────────────────────────────────────

function buildWelcome(data: {
  nombre: string;
  email: string;
  password: string;
  rol: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const subject = 'Bienvenido/a a Tane Solutions — Tu acceso al portal';

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">
      Bienvenido/a, ${data.nombre}
    </h2>
    <p style="margin:0 0 24px;color:#aaa;font-size:14px;">
      Tu cuenta en el portal de Tane Solutions ha sido creada. A continuación encontrarás tus credenciales de acceso.
    </p>

    ${divider()}

    <!-- Credentials block -->
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Tus credenciales</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:12px;">
        ${infoRow('Correo electrónico', data.email)}
        ${infoRow('Contraseña temporal', `<span style="font-family:monospace;background:#1e1e1e;padding:2px 8px;border-radius:4px;color:#E3FF04;">${data.password}</span>`)}
        ${infoRow('Rol asignado', data.rol)}
      </table>
    </div>

    <p style="margin:0 0 4px;color:#aaa;font-size:13px;">
      Haz clic en el botón para acceder al portal:
    </p>
    ${ctaButton('Acceder al portal', data.loginUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#888;">
      Por seguridad, te recomendamos <strong style="color:#e5e5e5;">cambiar tu contraseña</strong> en tu primer inicio de sesión.
      Si tienes algún problema para acceder, contacta con tu administrador.
    </p>
  `;

  return { subject, html: htmlWrap(body) };
}

function buildTicketNew(data: {
  ticketId: string | number;
  asunto: string;
  descripcion: string;
  clienteNombre: string;
  prioridad: string;
  adminEmail: string;
}): { subject: string; html: string } {
  const subject = `[Ticket #${data.ticketId}] Nuevo ticket de ${data.clienteNombre}`;

  const prioridadColor: Record<string, string> = {
    alta: '#ef4444',
    media: '#f59e0b',
    baja: '#22c55e',
  };
  const pColor = prioridadColor[data.prioridad?.toLowerCase()] ?? '#6b7280';
  const prioridadBadge = `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${pColor}22;color:${pColor};border:1px solid ${pColor}44;text-transform:capitalize;">${data.prioridad}</span>`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">
      Nuevo ticket de soporte
    </h2>
    <p style="margin:0 0 24px;color:#aaa;font-size:14px;">
      El cliente <strong style="color:#e5e5e5;">${data.clienteNombre}</strong> ha abierto una nueva solicitud.
    </p>

    ${divider()}

    <div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Detalles del ticket</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        ${infoRow('Ticket ID', `<strong style="color:#E3FF04;">#${data.ticketId}</strong>`)}
        ${infoRow('Asunto', `<strong style="color:#fff;">${data.asunto}</strong>`)}
        ${infoRow('Cliente', data.clienteNombre)}
        ${infoRow('Prioridad', prioridadBadge)}
      </table>
    </div>

    <!-- Description block -->
    <p style="margin:0 0 8px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Descripción</p>
    <div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:16px 20px;margin:0 0 24px;font-size:14px;color:#ccc;line-height:1.7;white-space:pre-wrap;">
${data.descripcion}
    </div>

    <p style="margin:0 0 4px;color:#aaa;font-size:13px;">
      Revisa y gestiona este ticket desde el panel de soporte:
    </p>
    ${ctaButton('Ir a Soporte', 'https://tanesolutions.com/support')}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#888;">
      Este aviso se ha enviado porque eres administrador del portal Tane Solutions.
    </p>
  `;

  return { subject, html: htmlWrap(body) };
}

function buildTicketUpdated(data: {
  ticketId: string | number;
  asunto: string;
  nuevoEstado: string;
  clienteEmail: string;
  clienteNombre: string;
}): { subject: string; html: string } {
  const subject = `Tu solicitud #${data.ticketId} ha sido actualizada`;

  const estadoColor: Record<string, string> = {
    abierto: '#3b82f6',
    'en proceso': '#f59e0b',
    resuelto: '#22c55e',
    cerrado: '#6b7280',
  };
  const eColor = estadoColor[data.nuevoEstado?.toLowerCase()] ?? '#6b7280';
  const estadoBadge = `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${eColor}22;color:${eColor};border:1px solid ${eColor}44;text-transform:capitalize;">${data.nuevoEstado}</span>`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">
      Actualización en tu solicitud
    </h2>
    <p style="margin:0 0 24px;color:#aaa;font-size:14px;">
      Hola, <strong style="color:#e5e5e5;">${data.clienteNombre}</strong>. Tu solicitud de soporte ha recibido una actualización por parte de nuestro equipo.
    </p>

    ${divider()}

    <div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Resumen de la solicitud</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        ${infoRow('Ticket ID', `<strong style="color:#E3FF04;">#${data.ticketId}</strong>`)}
        ${infoRow('Asunto', `<strong style="color:#fff;">${data.asunto}</strong>`)}
        ${infoRow('Nuevo estado', estadoBadge)}
      </table>
    </div>

    <p style="margin:0 0 4px;color:#aaa;font-size:13px;">
      Accede a tu portal para ver los detalles completos o responder al equipo:
    </p>
    ${ctaButton('Ver en mi portal', 'https://tanesolutions.com/client-panel')}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#888;">
      Si no reconoces esta solicitud o necesitas ayuda, escríbenos a
      <a href="mailto:soporte@tanesolutions.com" style="color:#E3FF04;text-decoration:none;">soporte@tanesolutions.com</a>.
    </p>
  `;

  return { subject, html: htmlWrap(body) };
}

function buildInformeNew(data: {
  titulo: string;
  periodo: string;
  clienteEmail: string;
  clienteNombre: string;
}): { subject: string; html: string } {
  const subject = `Nuevo informe disponible: ${data.titulo}`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">
      Nuevo informe disponible
    </h2>
    <p style="margin:0 0 24px;color:#aaa;font-size:14px;">
      Hola, <strong style="color:#e5e5e5;">${data.clienteNombre}</strong>. Tu equipo de Tane Solutions ha publicado un nuevo informe en tu portal.
    </p>

    ${divider()}

    <div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Detalles del informe</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        ${infoRow('Título', `<strong style="color:#fff;">${data.titulo}</strong>`)}
        ${infoRow('Período', data.periodo)}
      </table>
    </div>

    <p style="margin:0 0 4px;color:#aaa;font-size:13px;">
      Accede a tu portal para consultar el informe completo:
    </p>
    ${ctaButton('Ver informe', 'https://tanesolutions.com/client-panel')}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#888;">
      Recibes este mensaje porque eres cliente de Tane Solutions.
      Si tienes dudas sobre este informe, contacta con tu gestor de cuenta.
    </p>
  `;

  return { subject, html: htmlWrap(body) };
}

function buildPasswordReset(data: {
  nombre: string;
  email: string;
  resetUrl: string;
}): { subject: string; html: string } {
  const subject = 'Recuperación de acceso — Tane Solutions';

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">
      Recuperación de acceso
    </h2>
    <p style="margin:0 0 24px;color:#aaa;font-size:14px;">
      Hola, <strong style="color:#e5e5e5;">${data.nombre}</strong>. Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
    </p>

    ${divider()}

    <div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Cuenta afectada</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        ${infoRow('Correo electrónico', data.email)}
      </table>
    </div>

    <p style="margin:0 0 4px;color:#aaa;font-size:13px;">
      Haz clic en el botón para crear una nueva contraseña:
    </p>
    ${ctaButton('Restablecer contraseña', data.resetUrl)}

    ${divider()}

    <p style="margin:0 0 12px;font-size:13px;color:#888;">
      Este enlace <strong style="color:#e5e5e5;">expira en 1 hora</strong>.
      Si no has solicitado este restablecimiento, puedes ignorar este mensaje — tu cuenta permanece segura.
    </p>
    <p style="margin:0;font-size:13px;color:#888;">
      Si tienes problemas con el botón, copia y pega este enlace en tu navegador:
      <br />
      <span style="color:#E3FF04;font-size:12px;word-break:break-all;">${data.resetUrl}</span>
    </p>
  `;

  return { subject, html: htmlWrap(body) };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Validate environment ──────────────────────────────────────────────────
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY is not configured' }, 500);
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const body = await req.json();
    const { type } = body as { type: string };

    if (!type) {
      return json({ error: 'Campo "type" requerido' }, 400);
    }

    // ── Build email based on type ─────────────────────────────────────────────
    let recipient: string;
    let subject: string;
    let html: string;

    if (type === 'welcome') {
      const { nombre, email, password, rol, loginUrl } = body;
      if (!nombre || !email || !password || !rol || !loginUrl) {
        return json({ error: 'welcome: faltan campos (nombre, email, password, rol, loginUrl)' }, 400);
      }
      recipient = email;
      ({ subject, html } = buildWelcome({ nombre, email, password, rol, loginUrl }));

    } else if (type === 'ticket-new') {
      const { ticketId, asunto, descripcion, clienteNombre, prioridad, adminEmail } = body;
      if (!ticketId || !asunto || !descripcion || !clienteNombre || !prioridad || !adminEmail) {
        return json({ error: 'ticket-new: faltan campos (ticketId, asunto, descripcion, clienteNombre, prioridad, adminEmail)' }, 400);
      }
      recipient = adminEmail;
      ({ subject, html } = buildTicketNew({ ticketId, asunto, descripcion, clienteNombre, prioridad, adminEmail }));

    } else if (type === 'ticket-updated') {
      const { ticketId, asunto, nuevoEstado, clienteEmail, clienteNombre } = body;
      if (!ticketId || !asunto || !nuevoEstado || !clienteEmail || !clienteNombre) {
        return json({ error: 'ticket-updated: faltan campos (ticketId, asunto, nuevoEstado, clienteEmail, clienteNombre)' }, 400);
      }
      recipient = clienteEmail;
      ({ subject, html } = buildTicketUpdated({ ticketId, asunto, nuevoEstado, clienteEmail, clienteNombre }));

    } else if (type === 'informe-new') {
      const { titulo, periodo, clienteEmail, clienteNombre } = body;
      if (!titulo || !periodo || !clienteEmail || !clienteNombre) {
        return json({ error: 'informe-new: faltan campos (titulo, periodo, clienteEmail, clienteNombre)' }, 400);
      }
      recipient = clienteEmail;
      ({ subject, html } = buildInformeNew({ titulo, periodo, clienteEmail, clienteNombre }));

    } else if (type === 'password-reset') {
      const { nombre, email, resetUrl } = body;
      if (!nombre || !email || !resetUrl) {
        return json({ error: 'password-reset: faltan campos (nombre, email, resetUrl)' }, 400);
      }
      recipient = email;
      ({ subject, html } = buildPasswordReset({ nombre, email, resetUrl }));

    } else {
      return json({ error: `Tipo desconocido: ${type}` }, 400);
    }

    // ── Send via Resend ───────────────────────────────────────────────────────
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tane Solutions <noreply@tanesolutions.com>',
        to: [recipient],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      return json({ error: 'Error al enviar el correo', details: resendData }, 502);
    }

    return json({ success: true, id: resendData.id });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return json({ error: message }, 500);
  }
});
