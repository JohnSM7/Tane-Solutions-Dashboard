import { supabase } from '../supabase';

export type Subtarea = {
  id: string;
  tarea_id: string;
  titulo: string;
  completada: boolean;
  created_at: string;
};

export async function getSubtareasByTarea(tareaId: string): Promise<Subtarea[]> {
  const { data, error } = await supabase
    .from('subtareas')
    .select('*')
    .eq('tarea_id', tareaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Subtarea[];
}

export async function createSubtarea(tareaId: string, titulo: string): Promise<Subtarea> {
  const { data, error } = await supabase
    .from('subtareas')
    .insert({ tarea_id: tareaId, titulo })
    .select('*')
    .single();
  if (error) throw error;
  return data as Subtarea;
}

export async function toggleSubtarea(id: string, completada: boolean): Promise<void> {
  const { error } = await supabase
    .from('subtareas')
    .update({ completada })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSubtarea(id: string): Promise<void> {
  const { error } = await supabase.from('subtareas').delete().eq('id', id);
  if (error) throw error;
}
