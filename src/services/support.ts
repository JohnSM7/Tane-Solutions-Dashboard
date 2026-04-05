import { ref, computed } from 'vue';
import { supabase } from '../supabase';

export type Ticket = {
  id: number;
  asunto: string;
  descripcion: string;
  cliente_id: string | null;
  prioridad: 'Alta' | 'Media' | 'Baja';
  estado: 'Abierto' | 'En proceso' | 'Cerrado';
  fecha_creacion: string;
  fecha_primera_respuesta: string | null;
  fecha_cierre: string | null;
  satisfaccion: number | null;
  clientes?: { nombre: string };
};

export type Servidor = {
  id: string;
  nombre: string;
  estado: 'Online' | 'Mantenimiento' | 'Offline';
  uptime_porcentaje: number;
};

export const SERVIDOR_COLORS: Record<string, string> = {
  Online:        '#e3ff04',
  Mantenimiento: '#ffa500',
  Offline:       '#ff4444',
};

function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

export function useSupportData() {
  const tickets = ref<Ticket[]>([]);
  const servidores = ref<Servidor[]>([]);
  const loading = ref(true);

  // ── KPIs calculados automáticamente ─────────────────────────────────────────
  const kpis = computed(() => {
    const abiertos = tickets.value.filter(t => t.estado !== 'Cerrado');

    // Tiempo medio primera respuesta (en minutos → convertir a texto)
    const conRespuesta = tickets.value.filter(t => t.fecha_primera_respuesta);
    const avgMinutes = conRespuesta.length > 0
      ? conRespuesta.reduce((s, t) =>
          s + minutesBetween(t.fecha_creacion, t.fecha_primera_respuesta!), 0
        ) / conRespuesta.length
      : 0;
    const avgRespText = avgMinutes >= 60
      ? `${Math.round(avgMinutes / 60)}h`
      : avgMinutes > 0 ? `${Math.round(avgMinutes)} min` : '—';

    // Satisfacción media
    const conSatisfaccion = tickets.value.filter(t => t.satisfaccion !== null);
    const avgSat = conSatisfaccion.length > 0
      ? (conSatisfaccion.reduce((s, t) => s + (t.satisfaccion ?? 0), 0) / conSatisfaccion.length).toFixed(1)
      : null;

    return [
      {
        label: 'Incidencias Abiertas',
        value: String(abiertos.length),
        trend: abiertos.length === 0 ? 'Todo resuelto' : `${abiertos.filter(t => t.prioridad === 'Alta').length} de alta prioridad`,
        color: abiertos.length === 0 ? '#e3ff04' : abiertos.some(t => t.prioridad === 'Alta') ? '#ff4444' : '#ffa500',
      },
      {
        label: 'Tiempo 1ª Respuesta',
        value: avgRespText,
        trend: conRespuesta.length > 0 ? `de ${conRespuesta.length} tickets` : 'Sin datos',
        color: '#e3ff04',
      },
      {
        label: 'Satisfacción Cliente',
        value: avgSat ? `${avgSat}/5` : '—',
        trend: conSatisfaccion.length > 0 ? `${conSatisfaccion.length} valoraciones` : 'Sin valoraciones',
        color: '#ffffff',
      },
      {
        label: 'Tickets Cerrados',
        value: String(tickets.value.filter(t => t.estado === 'Cerrado').length),
        trend: `de ${tickets.value.length} totales`,
        color: '#e3ff04',
      },
    ];
  });

  Promise.all([
    supabase
      .from('tickets')
      .select('*, clientes(nombre)')
      .order('fecha_creacion', { ascending: false }),
    supabase
      .from('servidores')
      .select('*')
      .order('nombre'),
  ]).then(([ticketsRes, servidoresRes]) => {
    tickets.value = (ticketsRes.data ?? []) as Ticket[];
    servidores.value = (servidoresRes.data ?? []) as Servidor[];
  })
  .catch(console.error)
  .finally(() => { loading.value = false; });

  return { tickets, servidores, kpis, loading };
}

export async function createTicket(form: Partial<Ticket>): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .insert(form)
    .select('*, clientes(nombre)')
    .single();
  if (error) throw error;
  return data as Ticket;
}

export async function updateTicket(id: number, updates: Partial<Ticket>): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select('*, clientes(nombre)')
    .single();
  if (error) throw error;
  return data as Ticket;
}

export async function deleteTicket(id: number): Promise<void> {
  const { error } = await supabase.from('tickets').delete().eq('id', id);
  if (error) throw error;
}

export async function createServidor(form: Partial<Servidor>): Promise<Servidor> {
  const { data, error } = await supabase.from('servidores').insert(form).select().single();
  if (error) throw error;
  return data as Servidor;
}

export async function updateServidor(id: string, updates: Partial<Servidor>): Promise<Servidor> {
  const { data, error } = await supabase
    .from('servidores')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Servidor;
}

export async function deleteServidor(id: string): Promise<void> {
  const { error } = await supabase.from('servidores').delete().eq('id', id);
  if (error) throw error;
}
