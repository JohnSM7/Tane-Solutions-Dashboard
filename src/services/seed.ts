import { supabase } from '../supabase';

/**
 * SOLO PARA ENTORNOS DE DESARROLLO / DEMO.
 * Nunca ejecutar contra la base de datos de producción.
 * Cambia las credenciales antes de cualquier despliegue real.
 */
export async function seedDatabase(): Promise<void> {

  // ── 1. Crear usuario Admin ───────────────────────────────────────────────────
  const { data: adminAuth, error: adminError } = await supabase.auth.signUp({
    email: 'admin@tanesolutions.com',
    password: 'Demo_Admin_2026!',   // ⚠ cambiar antes de producción
  });
  if (adminError) throw adminError;

  await supabase.from('perfiles').insert({
    id: adminAuth.user!.id,
    nombre: 'John Sandoval',
    rol: 'ADMIN',
    cliente_id: null,
  });

  // ── 2. Insertar clientes ─────────────────────────────────────────────────────
  const { data: barLaFlecha } = await supabase
    .from('clientes')
    .insert({
      nombre: 'Bar La Flecha',
      contacto: 'Pedro Simoc',
      email_contacto: 'cliente@barlaflecha.com',
      sector: 'Hostelería',
      estado: 'Activo',
      logo: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/32/d5/8d/bb/caption.jpg?w=200&h=-1&s=1',
    })
    .select('id')
    .single();

  const barId = barLaFlecha!.id as string;

  await supabase.from('clientes').insert([
    {
      nombre: 'Tane Restaurant',
      contacto: 'Juan Pérez',
      email_contacto: 'jperez@tanerestaurant.com',
      sector: 'Gastronomía',
      estado: 'Activo',
      logo: '',
    },
    {
      nombre: 'Dental Care Clínicas',
      contacto: 'Ana Gómez',
      email_contacto: 'ana@dentalcare.com',
      sector: 'Salud',
      estado: 'Activo',
      logo: '',
    },
    {
      nombre: 'Inmobiliaria Central',
      contacto: 'Carlos Ruiz',
      email_contacto: 'cruiz@inmobcentral.com',
      sector: 'Real Estate',
      estado: 'Inactivo',
      logo: '',
    },
    {
      nombre: 'Studio Fitness',
      contacto: 'María Silva',
      email_contacto: 'maria@studiofit.com',
      sector: 'Deportes',
      estado: 'Activo',
      logo: '',
    },
  ]);

  // ── 3. Sedes de Bar La Flecha ────────────────────────────────────────────────
  const { data: sedesData } = await supabase
    .from('sedes')
    .insert([
      {
        cliente_id: barId,
        nombre: 'Sede Principal (Calle Goya 2)',
        gmb_rating: 4.0,
        gmb_reviews: 320,
        gmb_unanswered: 12,
        gmb_latest_pub: '¡Nuevas tapas de temporada!',
        gmb_pub_views: 2540,
      },
      {
        cliente_id: barId,
        nombre: 'Sede Norte (Av. Libertad 45)',
        gmb_rating: 4.9,
        gmb_reviews: 85,
        gmb_unanswered: 0,
        gmb_latest_pub: 'Inauguración exitosa. ¡Gracias a todos!',
        gmb_pub_views: 4120,
      },
    ])
    .select('id');

  const sedeGoyaId = sedesData?.[0]?.id ?? null;
  const sedeLibertadId = sedesData?.[1]?.id ?? null;

  // ── 4. Leads (Módulo Comercial) ──────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

  await supabase.from('leads').insert([
    { nombre: 'Pedro García',   empresa: 'Bar La Flecha',      fuente: 'Referido',   servicio: 'Pack Starter',          estado: 'Cerrado-Ganado',  valor_estimado: 1450, cac: 120, fecha_creacion: daysAgo(60), fecha_cierre: daysAgo(45), cliente_id: barId },
    { nombre: 'Laura Pérez',    empresa: 'Studio Fit',         fuente: 'Google Ads', servicio: 'Gestión Redes Sociales', estado: 'Cerrado-Ganado',  valor_estimado: 800,  cac: 95,  fecha_creacion: daysAgo(50), fecha_cierre: daysAgo(35) },
    { nombre: 'Carlos Ruiz',    empresa: 'Inmobiliaria Cen.', fuente: 'Web',         servicio: 'Desarrollo a Medida',    estado: 'Cerrado-Ganado',  valor_estimado: 4500, cac: 200, fecha_creacion: daysAgo(40), fecha_cierre: daysAgo(20) },
    { nombre: 'Ana Martínez',   empresa: 'Dental Care',        fuente: 'Referido',   servicio: 'Pack Starter',          estado: 'Cerrado-Ganado',  valor_estimado: 1450, cac: 110, fecha_creacion: daysAgo(30), fecha_cierre: daysAgo(10) },
    { nombre: 'Sofía López',    empresa: 'Restaurante Sol',    fuente: 'Google Ads', servicio: 'Pack Starter',          estado: 'Propuesta',       valor_estimado: 1450, cac: 130, fecha_creacion: daysAgo(14) },
    { nombre: 'Marcos Torres',  empresa: 'Clínica Bienestar',  fuente: 'Instagram',  servicio: 'SEO Local',             estado: 'Negociación',     valor_estimado: 900,  cac: 80,  fecha_creacion: daysAgo(10) },
    { nombre: 'Rosa Jiménez',   empresa: 'Librería Centro',    fuente: 'Web',        servicio: 'Pack Starter',          estado: 'Cualificado',     valor_estimado: 1200, cac: 0,   fecha_creacion: daysAgo(7) },
    { nombre: 'Diego Herrera',  empresa: 'Gym Élite',          fuente: 'Referido',   servicio: 'Gestión Redes Sociales', estado: 'Nuevo',          valor_estimado: 800,  cac: 0,   fecha_creacion: daysAgo(3) },
    { nombre: 'Patricia Mora',  empresa: 'Panadería Artesa',   fuente: 'Google Ads', servicio: 'Pack Starter',          estado: 'Nuevo',           valor_estimado: 1450, cac: 0,   fecha_creacion: daysAgo(2) },
    { nombre: 'Tomás Vega',     empresa: 'Óptica Vista',       fuente: 'Web',        servicio: 'Desarrollo a Medida',   estado: 'Cerrado-Perdido', valor_estimado: 3200, cac: 150, fecha_creacion: daysAgo(25) },
  ]);

  // ── 5. Facturas (Módulo Financiero) ──────────────────────────────────────────
  const isoDate = (daysOffset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  };

  await supabase.from('facturas').insert([
    { cliente_id: barId, concepto: 'Gestión RRSS Marzo — Goya',        importe: 500,  estado: 'Pagada',   fecha_emision: isoDate(-90), fecha_pago: isoDate(-85) },
    { cliente_id: barId, concepto: 'Pack Starter — Libertad',          importe: 950,  estado: 'Pagada',   fecha_emision: isoDate(-60), fecha_pago: isoDate(-58) },
    { cliente_id: barId, concepto: 'Gestión RRSS Abril — Ambas sedes', importe: 500,  estado: 'Pagada',   fecha_emision: isoDate(-30), fecha_pago: isoDate(-28) },
    { cliente_id: barId, concepto: 'Campaña Google Ads — Mayo',        importe: 650,  estado: 'Pendiente',fecha_emision: isoDate(-5),  fecha_vencimiento: isoDate(10) },
    { concepto: 'Desarrollo Web — Tane Restaurant',  importe: 4500, estado: 'Pagada',   fecha_emision: isoDate(-75), fecha_pago: isoDate(-70) },
    { concepto: 'SEO Trimestral — Inmobiliaria',     importe: 1200, estado: 'Pagada',   fecha_emision: isoDate(-45), fecha_pago: isoDate(-40) },
    { concepto: 'Pack Starter — Dental Care',        importe: 1450, estado: 'Pagada',   fecha_emision: isoDate(-20), fecha_pago: isoDate(-18) },
    { concepto: 'Mantenimiento Premium — Studio Fit',importe: 300,  estado: 'Vencida',  fecha_emision: isoDate(-40), fecha_vencimiento: isoDate(-10) },
    { concepto: 'Redes Sociales Mayo — Studio Fit',  importe: 500,  estado: 'Pendiente',fecha_emision: isoDate(-3),  fecha_vencimiento: isoDate(15) },
  ]);

  // ── 6. Proyectos de rentabilidad ─────────────────────────────────────────────
  await supabase.from('proyectos_rentabilidad').insert([
    { nombre: 'Web Tane Restaurant',   cliente_id: null, presupuesto: 4500, coste: 1700, fecha_inicio: isoDate(-75), fecha_fin: isoDate(-45) },
    { nombre: 'App Móvil iOS',         cliente_id: null, presupuesto: 8000, coste: 6000, fecha_inicio: isoDate(-60) },
    { nombre: 'Landing Campaña Verano',cliente_id: null, presupuesto: 1200, coste:  420, fecha_inicio: isoDate(-30), fecha_fin: isoDate(-10) },
  ]);

  // ── 7. Proyectos operacionales ───────────────────────────────────────────────
  await supabase.from('proyectos').insert([
    { nombre: 'Gestión Redes (Goya)',         cliente_id: barId, sede_id: sedeGoyaId,     estado: 'En curso',   fase: 'Publicaciones Mayo',        fecha_inicio: isoDate(-30) },
    { nombre: 'Campaña Lanzamiento (Lib.)',   cliente_id: barId, sede_id: sedeLibertadId, estado: 'En curso',   fase: 'Anuncios Google Ads',       fecha_inicio: isoDate(-15) },
    { nombre: 'Web Tane Restaurant',          cliente_id: null,  sede_id: null,           estado: 'Completado', fase: 'Entrega final',             fecha_inicio: isoDate(-75), fecha_entrega_estimada: isoDate(-50), fecha_entrega_real: isoDate(-45) },
    { nombre: 'Rediseño Web Corporativa',     cliente_id: null,  sede_id: null,           estado: 'Retrasado',  fase: 'Diseño UI',                 fecha_inicio: isoDate(-40), fecha_entrega_estimada: isoDate(-10) },
    { nombre: 'App Móvil iOS',                cliente_id: null,  sede_id: null,           estado: 'En riesgo',  fase: 'Desarrollo backend',        fecha_inicio: isoDate(-60), fecha_entrega_estimada: isoDate(10) },
    { nombre: 'SEO Trimestral — Inmob.',      cliente_id: null,  sede_id: null,           estado: 'En curso',   fase: 'Análisis competencia',      fecha_inicio: isoDate(-20) },
    { nombre: 'Mantenimiento Anual',          cliente_id: null,  sede_id: null,           estado: 'Bloqueado',  fase: 'Pendiente accesos cliente', fecha_inicio: isoDate(-10) },
  ]);

  // ── 8. Tickets de soporte ────────────────────────────────────────────────────
  await supabase.from('tickets').insert([
    {
      asunto: 'Error en formulario de contacto', descripcion: 'El formulario devuelve error 500 al enviar.',
      cliente_id: barId, prioridad: 'Alta', estado: 'Abierto',
      fecha_creacion: new Date(now.getTime() - 2 * 3600000).toISOString(),
    },
    {
      asunto: 'Actualización de contenido web', descripcion: 'Necesita actualizar el menú y fotos.',
      cliente_id: null, prioridad: 'Baja', estado: 'En proceso',
      fecha_creacion: new Date(now.getTime() - 5 * 3600000).toISOString(),
      fecha_primera_respuesta: new Date(now.getTime() - 4 * 3600000).toISOString(),
    },
    {
      asunto: 'Problemas de acceso al panel', descripcion: 'Usuario no puede iniciar sesión.',
      cliente_id: null, prioridad: 'Media', estado: 'Cerrado',
      fecha_creacion: new Date(now.getTime() - 86400000).toISOString(),
      fecha_primera_respuesta: new Date(now.getTime() - 84000000).toISOString(),
      fecha_cierre: new Date(now.getTime() - 43200000).toISOString(),
      satisfaccion: 4,
    },
    {
      asunto: 'Solicitud informe mensual GMB', descripcion: 'Quiere el reporte de Google My Business de abril.',
      cliente_id: barId, prioridad: 'Baja', estado: 'Cerrado',
      fecha_creacion: new Date(now.getTime() - 5 * 86400000).toISOString(),
      fecha_primera_respuesta: new Date(now.getTime() - 4.8 * 86400000).toISOString(),
      fecha_cierre: new Date(now.getTime() - 4 * 86400000).toISOString(),
      satisfaccion: 5,
    },
  ]);

  // ── 9. Crear usuario Cliente (espera para evitar rate limit) ─────────────────
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { data: clienteAuth, error: clienteError } = await supabase.auth.signUp({
    email: 'cliente@barlaflecha.com',
    password: 'Demo_Cliente_2026!',   // ⚠ cambiar antes de producción
  });
  if (clienteError) throw clienteError;

  await supabase.from('perfiles').insert({
    id: clienteAuth.user!.id,
    nombre: 'Pedro Simoc',
    rol: 'CLIENT',
    cliente_id: barId,
  });
}
