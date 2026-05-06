import { ref, computed } from 'vue';
import { supabase } from '../supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type Cliente = {
  id: string;
  nombre: string;
  contacto: string;
  email_contacto: string;
  telefono: string;
  sector: string;
  estado: string;
  logo: string;
  cif: string;
  direccion_facturacion: string;
};

export type Sede = {
  id: number;
  cliente_id: string;
  nombre: string;
  gmb_rating: number;
  gmb_reviews: number;
  gmb_unanswered: number;
  gmb_latest_pub: string;
  gmb_pub_views: number;
};

export type Documento = {
  id: number;
  cliente_id: string;
  sede_id: number | null;
  nombre: string;
  url: string;
  tipo: string;
  subido_por: string;
  creado_en: string;
};

export type UsuarioPerfil = {
  id: string;
  nombre: string;
  rol: string;
  cliente_id: string;
};

// ── Validación de archivos ────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function validateFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Tipo de archivo no permitido (${file.type}). ` +
      `Se aceptan: imágenes, PDF, Word, Excel y texto plano.`
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `El archivo supera el límite de 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`
    );
  }
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.{2,}/g, '_')
    .substring(0, 100);
}

// ── Health Score ─────────────────────────────────────────────────────────────

export function computeHealthScore(opts: {
  facturas:  { estado: string }[];
  tickets:   { estado: string; prioridad: string }[];
  proyectos: { estado: string }[];
  sedes:     { gmb_unanswered: number }[];
  status:    string;
}): number {
  let score = 100;

  const vencidas = opts.facturas.filter(f => f.estado === 'Vencida').length;
  score -= Math.min(vencidas * 20, 40);

  const ticketsAlta = opts.tickets.filter(t => t.prioridad === 'Alta' && t.estado !== 'Cerrado').length;
  score -= Math.min(ticketsAlta * 15, 30);

  const proyRiesgo = opts.proyectos.filter(p => ['En riesgo', 'Retrasado', 'Bloqueado'].includes(p.estado)).length;
  score -= Math.min(proyRiesgo * 15, 25);

  const unanswered = opts.sedes.reduce((s, sed) => s + (sed.gmb_unanswered ?? 0), 0);
  score -= Math.min(unanswered * 2, 15);

  if (opts.status === 'Inactivo') score = Math.min(score, 40);

  return Math.max(0, Math.min(100, score));
}

export function healthColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#facc15';
  if (score >= 40) return '#ffa500';
  return '#f87171';
}

export function healthLabel(score: number): string {
  if (score >= 80) return 'Buena';
  if (score >= 60) return 'Regular';
  if (score >= 40) return 'En riesgo';
  return 'Crítica';
}

// ── mapCliente: convierte fila DB → objeto para las vistas ───────────────────
export function mapCliente(c: Cliente) {
  return {
    id: c.id,
    name: c.nombre,
    contact: c.contacto,
    contactEmail: c.email_contacto,
    telefono: c.telefono ?? '',
    industry: c.sector,
    status: c.estado,
    logo: c.logo ?? '',
    cif: c.cif ?? '',
    direccionFacturacion: c.direccion_facturacion ?? '',
  };
}

// ── useClientsList ───────────────────────────────────────────────────────────
export type ClienteMapeado = ReturnType<typeof mapCliente> & {
  financials: { paid: string; pending: string };
  healthScore: number;
};

export function useClientsList() {
  const clients = ref<ClienteMapeado[]>([]);
  const loading = ref(true);

  const loadingGuard = setTimeout(() => { loading.value = false; }, 15_000);

  Promise.resolve(
    supabase.from('clientes').select(
      '*, facturas(importe, estado), tickets(estado, prioridad), proyectos(estado), sedes(gmb_unanswered)'
    ).order('nombre')
  ).then(({ data }) => {
    clients.value = (data ?? []).map((c: any) => {
      const mapped = mapCliente(c);
      const facturas: { importe: number; estado: string }[] = c.facturas ?? [];
      const pagado    = facturas.filter(f => f.estado === 'Pagada').reduce((s, f) => s + f.importe, 0);
      const pendiente = facturas.filter(f => f.estado !== 'Pagada').reduce((s, f) => s + f.importe, 0);
      const healthScore = computeHealthScore({
        facturas:  c.facturas  ?? [],
        tickets:   c.tickets   ?? [],
        proyectos: c.proyectos ?? [],
        sedes:     c.sedes     ?? [],
        status:    c.estado,
      });
      return {
        ...mapped,
        financials: {
          paid:    `${pagado.toLocaleString('es-ES')} €`,
          pending: `${pendiente.toLocaleString('es-ES')} €`,
        },
        healthScore,
      };
    });
  })
  .catch(console.error)
  .finally(() => { clearTimeout(loadingGuard); loading.value = false; });

  return { clients, loading };
}

// ── useClientProfile ─────────────────────────────────────────────────────────
export function useClientProfile(clientId: string) {
  const clientData = ref<ReturnType<typeof mapCliente> | null>(null);
  const facturas = ref<any[]>([]);
  const proyectos = ref<any[]>([]);
  const sedes = ref<Sede[]>([]);
  const documentos = ref<Documento[]>([]);
  const usuarios = ref<UsuarioPerfil[]>([]);
  const leads = ref<any[]>([]);
  const loading = ref(true);

  const financials = computed(() => {
    const pagado = facturas.value.filter(f => f.estado === 'Pagada').reduce((s: number, f: any) => s + f.importe, 0);
    const pendiente = facturas.value.filter(f => f.estado !== 'Pagada').reduce((s: number, f: any) => s + f.importe, 0);
    return {
      paid: `${pagado.toLocaleString('es-ES')} €`,
      pending: `${pendiente.toLocaleString('es-ES')} €`,
      total: `${(pagado + pendiente).toLocaleString('es-ES')} €`,
    };
  });

  const loadingGuard = setTimeout(() => { loading.value = false; }, 15_000);

  Promise.all([
    supabase.from('clientes').select('*').eq('id', clientId).single(),
    supabase.from('facturas').select('*, proyectos_rentabilidad(nombre)').eq('cliente_id', clientId).order('fecha_emision', { ascending: false }),
    supabase.from('proyectos').select('*, sedes(nombre)').eq('cliente_id', clientId).order('fecha_inicio', { ascending: false }),
    supabase.from('sedes').select('*').eq('cliente_id', clientId).order('id'),
    supabase.from('documentos').select('*').eq('cliente_id', clientId).order('creado_en', { ascending: false }),
    supabase.from('usuarios').select('id, nombre, rol').eq('cliente_id', clientId),
    supabase.from('leads').select('*').eq('cliente_id', clientId).order('fecha_creacion', { ascending: false }),
  ]).then(([clientRes, facturasRes, proyectosRes, sedesRes, docsRes, usersRes, leadsRes]) => {
    if (clientRes.error) console.error('[useClientProfile] Error fetch cliente:', clientRes.error);
    clientData.value = clientRes.data ? mapCliente(clientRes.data as Cliente) : null;
    facturas.value = facturasRes.data ?? [];
    proyectos.value = proyectosRes.data ?? [];
    sedes.value = (sedesRes.data ?? []) as Sede[];
    documentos.value = (docsRes.data ?? []) as Documento[];
    usuarios.value = (usersRes.data ?? []) as UsuarioPerfil[];
    leads.value = leadsRes.data ?? [];
  })
  .catch(err => console.error('[useClientProfile] Catch error:', err))
  .finally(() => { clearTimeout(loadingGuard); loading.value = false; });

  const saveProfile = async (updates: Partial<{ name: string; contact: string; contactEmail: string; telefono: string; industry: string; logo: string; status: string; cif: string; direccionFacturacion: string }>) => {
    const dbUpdates: Record<string, any> = {};
    if ('name' in updates)                 dbUpdates.nombre                = updates.name;
    if ('contact' in updates)              dbUpdates.contacto              = updates.contact;
    if ('contactEmail' in updates)         dbUpdates.email_contacto        = updates.contactEmail;
    if ('telefono' in updates)             dbUpdates.telefono              = updates.telefono;
    if ('industry' in updates)             dbUpdates.sector                = updates.industry;
    if ('logo' in updates)                 dbUpdates.logo                  = updates.logo;
    if ('status' in updates)               dbUpdates.estado                = updates.status;
    if ('cif' in updates)                  dbUpdates.cif                   = updates.cif;
    if ('direccionFacturacion' in updates) dbUpdates.direccion_facturacion = updates.direccionFacturacion;

    const { data, error } = await supabase
      .from('clientes')
      .update(dbUpdates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;
    if (data) clientData.value = { ...clientData.value!, ...mapCliente(data as Cliente) };
  };

  const addSede = async (form: Partial<Sede>): Promise<void> => {
    const { data, error } = await supabase
      .from('sedes')
      .insert({ ...form, cliente_id: clientId })
      .select()
      .single();
    if (error) throw error;
    sedes.value = [...sedes.value, data as Sede];
  };

  const updateSede = async (id: number, updates: Partial<Sede>): Promise<void> => {
    const { data, error } = await supabase
      .from('sedes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    const idx = sedes.value.findIndex(s => s.id === id);
    if (idx !== -1) sedes.value[idx] = data as Sede;
  };

  const deleteSede = async (id: number): Promise<void> => {
    const { error } = await supabase.from('sedes').delete().eq('id', id);
    if (error) throw error;
    sedes.value = sedes.value.filter(s => s.id !== id);
  };

  const uploadDocumento = async (file: File, sedeId: number | null, subidoPor: string): Promise<void> => {
    validateFile(file);
    const safeName = sanitizeFilename(file.name);
    const path = `${clientId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

    const { data, error: dbError } = await supabase
      .from('documentos')
      .insert({
        cliente_id: clientId,
        sede_id: sedeId,
        nombre: safeName,
        url: urlData.publicUrl,
        tipo: file.type.startsWith('image/') ? 'Imagen' : 'Documento',
        subido_por: subidoPor,
      })
      .select()
      .single();
    if (dbError) throw dbError;
    documentos.value = [data as Documento, ...documentos.value];
  };

  const deleteDocumento = async (doc: Documento): Promise<void> => {
    // Extraer path del storage desde la URL pública
    const url = new URL(doc.url);
    const storagePath = url.pathname.split('/documentos/')[1];
    if (storagePath) {
      await supabase.storage.from('documentos').remove([storagePath]);
    }
    const { error } = await supabase.from('documentos').delete().eq('id', doc.id);
    if (error) throw error;
    documentos.value = documentos.value.filter(d => d.id !== doc.id);
  };

  return {
    clientData, facturas, proyectos, sedes, documentos, usuarios, leads,
    financials, loading,
    saveProfile, addSede, updateSede, deleteSede,
    uploadDocumento, deleteDocumento,
  };
}

// ── deleteClient ─────────────────────────────────────────────────────────────
export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if (error) throw error;
}

// ── sendWelcomeClientEmail ────────────────────────────────────────────────────
export async function sendWelcomeClientEmail(opts: {
  contactName: string;
  clientName: string;
  contactEmail: string;
  mensaje: string;
  checklist: string[];
}): Promise<void> {
  const { error } = await supabase.functions.invoke('send-email', {
    body: {
      type: 'welcome-client',
      contactName: opts.contactName,
      clientName: opts.clientName,
      email: opts.contactEmail,
      mensaje: opts.mensaje,
      checklist: opts.checklist,
    },
  });
  if (error) throw error;
}

// ── createClient ─────────────────────────────────────────────────────────────
export async function createClient(form: {
  name: string;
  contact: string;
  contactEmail: string;
  industry: string;
  status?: string;
  logo?: string;
  cif?: string;
  direccionFacturacion?: string;
}): Promise<ReturnType<typeof mapCliente>> {
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      nombre: form.name,
      contacto: form.contact,
      email_contacto: form.contactEmail,
      sector: form.industry,
      estado: form.status ?? 'Activo',
      logo: form.logo ?? '',
      cif: form.cif ?? '',
      direccion_facturacion: form.direccionFacturacion ?? '',
    })
    .select()
    .single();
  if (error) throw error;
  return mapCliente(data as Cliente);
}
