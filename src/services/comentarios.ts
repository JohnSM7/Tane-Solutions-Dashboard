import { supabase } from '../supabase';

export type ComentarioTarea = {
  id: string;
  tarea_id: string;
  usuario_id: string;
  usuario_nombre: string;
  contenido: string;
  created_at: string;
};

export async function getComentariosByTarea(tareaId: string): Promise<ComentarioTarea[]> {
  const { data, error } = await supabase
    .from('comentarios_tareas')
    .select('*')
    .eq('tarea_id', tareaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ComentarioTarea[];
}

export async function createComentario(form: {
  tarea_id: string;
  usuario_id: string;
  usuario_nombre: string;
  contenido: string;
}): Promise<ComentarioTarea> {
  const { data, error } = await supabase
    .from('comentarios_tareas')
    .insert(form)
    .select('*')
    .single();
  if (error) throw error;
  return data as ComentarioTarea;
}

export async function deleteComentario(id: string): Promise<void> {
  const { error } = await supabase.from('comentarios_tareas').delete().eq('id', id);
  if (error) throw error;
}
