import { ref } from 'vue';
import { supabase } from '../supabase';

export type TareaEstado = 'backlog' | 'en_progreso' | 'revision' | 'completado';
export type TareaPrioridad = 'Baja' | 'Media' | 'Alta';
export type FrecuenciaRecurrencia = 'diaria' | 'semanal' | 'quincenal' | 'mensual';

export type Tarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TareaEstado;
  prioridad: TareaPrioridad;
  proyecto_id: string | null;
  lead_id: string | null;
  asignado_a: string | null;
  asignados_ids: string[];
  horas_estimadas: number;
  fecha_inicio_tarea: string | null;
  fecha_limite: string | null;
  recurrencia_id: string | null;
  es_recurrente: boolean;
  frecuencia_recurrencia: FrecuenciaRecurrencia | null;
  created_at: string;
  // joins
  proyectos?: { nombre: string } | null;
  leads?: { empresa: string } | null;
  usuarios?: { nombre: string } | null;
};

export const COLUMNAS: { key: TareaEstado; label: string; color: string }[] = [
  { key: 'backlog',     label: 'Pendiente',   color: '#94a3b8' },
  { key: 'en_progreso', label: 'En progreso', color: '#e3ff04' },
  { key: 'revision',   label: 'Revisión',     color: '#ffa500' },
  { key: 'completado', label: 'Completado',   color: '#4ade80' },
];

export const PRIORIDAD_COLOR: Record<TareaPrioridad, string> = {
  Alta: '#ff4444', Media: '#ffa500', Baja: '#94a3b8',
};

export const FRECUENCIA_LABELS: Record<FrecuenciaRecurrencia, string> = {
  diaria: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual',
};

// Número de instancias futuras a generar por frecuencia
const FRECUENCIA_COUNT: Record<FrecuenciaRecurrencia, number> = {
  diaria: 60, semanal: 52, quincenal: 26, mensual: 24,
};

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function advanceDate(dateStr: string, frecuencia: FrecuenciaRecurrencia, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  for (let i = 0; i < n; i++) {
    if (frecuencia === 'diaria')    d.setDate(d.getDate() + 1);
    if (frecuencia === 'semanal')   d.setDate(d.getDate() + 7);
    if (frecuencia === 'quincenal') d.setDate(d.getDate() + 14);
    if (frecuencia === 'mensual')   d.setMonth(d.getMonth() + 1);
  }
  return localDateStr(d);
}

function stripTareaJoins(t: Partial<Tarea>): Partial<Tarea> {
  const { proyectos, leads, usuarios, ...clean } = t as any;
  return clean;
}

export function useTareas() {
  const tareas = ref<Tarea[]>([]);
  const loading = ref(true);

  Promise.resolve(
    supabase
      .from('tareas')
      .select('*, proyectos(nombre), leads(empresa), usuarios!tareas_asignado_a_fkey(nombre)')
      .order('created_at', { ascending: false })
  ).then(({ data, error }) => {
    if (error) { console.error(error); return; }
    tareas.value = (data ?? []) as Tarea[];
  }).finally(() => { loading.value = false; });

  return { tareas, loading };
}

export async function createTarea(form: Partial<Tarea>): Promise<Tarea> {
  const payload = stripTareaJoins(form);
  if (!payload.proyecto_id) payload.proyecto_id = null;
  if (!payload.lead_id) payload.lead_id = null;
  if (!payload.asignado_a) payload.asignado_a = null;
  if (!payload.fecha_limite) payload.fecha_limite = null;

  const { data, error } = await supabase
    .from('tareas')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as Tarea;
}

// Crea la tarea base + todas las instancias futuras con el mismo recurrencia_id
export async function createTareaRecurrente(
  base: Partial<Tarea>,
  frecuencia: FrecuenciaRecurrencia,
): Promise<void> {
  const recurrencia_id = crypto.randomUUID();
  const count = FRECUENCIA_COUNT[frecuencia];
  const baseLimite = base.fecha_limite!;
  const baseInicio = base.fecha_inicio_tarea ?? null;

  // Offset días entre inicio y límite (para mantener el rango en cada instancia)
  const offsetDias = baseInicio
    ? Math.round((new Date(baseLimite + 'T00:00:00').getTime() - new Date(baseInicio + 'T00:00:00').getTime()) / 86400000)
    : null;

  const payloads: Partial<Tarea>[] = [];
  for (let i = 0; i <= count; i++) {
    const limite = i === 0 ? baseLimite : advanceDate(baseLimite, frecuencia, i);
    const inicio = offsetDias !== null && baseInicio
      ? (i === 0 ? baseInicio : (() => {
          const d = new Date(limite + 'T00:00:00');
          d.setDate(d.getDate() - offsetDias);
          return localDateStr(d);
        })())
      : null;

    payloads.push(stripTareaJoins({
      ...base,
      fecha_limite:           limite,
      fecha_inicio_tarea:     inicio,
      recurrencia_id,
      es_recurrente:          true,
      frecuencia_recurrencia: frecuencia,
      estado:                 'backlog' as TareaEstado,
    }));
  }

  const { error } = await supabase.from('tareas').insert(payloads);
  if (error) throw error;
}

export async function updateTarea(id: string, updates: Partial<Tarea>): Promise<Tarea> {
  const payload = stripTareaJoins(updates);

  const { data, error } = await supabase
    .from('tareas')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Tarea;
}

export async function deleteTarea(id: string): Promise<void> {
  const { error } = await supabase.from('tareas').delete().eq('id', id);
  if (error) throw error;
}

// Elimina esta instancia y todas las posteriores del mismo grupo recurrente
export async function deleteTareasFromDate(recurrenciaId: string, fromDate: string): Promise<void> {
  const { error } = await supabase
    .from('tareas')
    .delete()
    .eq('recurrencia_id', recurrenciaId)
    .gte('fecha_limite', fromDate);
  if (error) throw error;
}
