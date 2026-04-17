import { ref, computed } from 'vue';
import { supabase } from '../supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type Cliente = {
  id: string;
  nombre: string;
  contacto: string;
  email_contacto: string;
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
    .replace(/[/\\:*?"<>|]/g, '_') // caracteres peligrosos
    .replace(/\.{2,}/g, '_')        // path traversal (..)
    .substring(0, 100);             // longitud máxima
}

// ── mapCliente: convierte fila DB → objeto para las vistas ───────────────────
export function mapCliente(c: Cliente) {
  return {
    id: c.id,
    name: c.nombre,
    contact: c.contacto,
    contactEmail: c.email_contacto,
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
};

export function useClientsList() {
  const clients = ref<ClienteMapeado[]>([]);
  const loading = ref(true);

  // Incluye facturación agregada para la tabla de clientes
  Promise.resolve(supabase.from('clientes').select('*, facturas(importe, estado)').order('nombre'))
    .then(({ data }) => {
      clients.value = (data ?? []).map((c: any) => {
        const mapped = mapCliente(c);
        const facturas: { importe: number; estado: string }[] = c.facturas ?? [];
        const pagado = facturas.filter(f => f.estado === 'Pagada').reduce((s, f) => s + f.importe, 0);
        const pendiente = facturas.filter(f => f.estado !== 'Pagada').reduce((s, f) => s + f.importe, 0);
        return {
          ...mapped,
          financials: {
            paid: `${pagado.toLocaleString('es-ES')} €`,
            pending: `${pendiente.toLocaleString('es-ES')} €`,
          },
        };
      });
    })
    .catch(console.error)
    .finally(() => { loading.value = false; });

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

  Promise.all([
    supabase.from('clientes').select('*').eq('id', clientId).single(),
    supabase.from('facturas').select('*').eq('cliente_id', clientId).order('fecha_emision', { ascending: false }),
    supabase.from('proyectos').select('*, sedes(nombre)').eq('cliente_id', clientId).order('fecha_inicio', { ascending: false }),
    supabase.from('sedes').select('*').eq('cliente_id', clientId).order('id'),
    supabase.from('documentos').select('*').eq('cliente_id', clientId).order('creado_en', { ascending: false }),
    supabase.from('usuarios').select('id, nombre, rol').eq('cliente_id', clientId),
  ]).then(([clientRes, facturasRes, proyectosRes, sedesRes, docsRes, usersRes]) => {
    if (clientRes.error) console.error('[useClientProfile] Error fetch cliente:', clientRes.error);
    clientData.value = clientRes.data ? mapCliente(clientRes.data as Cliente) : null;
    facturas.value = facturasRes.data ?? [];
    proyectos.value = proyectosRes.data ?? [];
    sedes.value = (sedesRes.data ?? []) as Sede[];
    documentos.value = (docsRes.data ?? []) as Documento[];
    usuarios.value = (usersRes.data ?? []) as UsuarioPerfil[];
  })
  .catch(err => console.error('[useClientProfile] Catch error:', err))
  .finally(() => { loading.value = false; });

  const saveProfile = async (updates: Partial<{ name: string; contact: string; industry: string; logo: string; status: string; cif: string; direccionFacturacion: string }>) => {
    const dbUpdates: Record<string, any> = {};
    if ('name' in updates)                 dbUpdates.nombre                = updates.name;
    if ('contact' in updates)              dbUpdates.contacto              = updates.contact;
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
    clientData, facturas, proyectos, sedes, documentos, usuarios,
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
