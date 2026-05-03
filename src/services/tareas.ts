import { ref } from 'vue';
import { supabase } from '../supabase';

export type TareaEstado = 'backlog' | 'en_progreso' | 'revision' | 'completado';
export type TareaPrioridad = 'Baja' | 'Media' | 'Alta';

export type Tarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TareaEstado;
  prioridad: TareaPrioridad;
  proyecto_id: string | null;
  lead_id: string | null;
  asignado_a: string | null;
  horas_estimadas: number;
  fecha_inicio_tarea: string | null;
  fecha_limite: string | null;
  created_at: string;
  // joins
  proyectos?: { nombre: string } | null;
  leads?: { empresa: string } | null;
  usuarios?: { nombre: string } | null;
};

export const COLUMNAS: { key: TareaEstado; label: string; color: string }[] = [
  { key: 'backlog',     label: 'Pendiente',    color: '#94a3b8' },
  { key: 'en_progreso', label: 'En progreso',  color: '#e3ff04' },
  { key: 'revision',   label: 'Revisión',      color: '#ffa500' },
  { key: 'completado', label: 'Completado',    color: '#4ade80' },
];

export const PRIORIDAD_COLOR: Record<TareaPrioridad, string> = {
  Alta:  '#ff4444',
  Media: '#ffa500',
  Baja:  '#94a3b8',
};

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
