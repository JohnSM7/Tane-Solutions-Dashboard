import { ref } from 'vue';
import { supabase } from '../supabase';

export type RegistroHoras = {
  id: string;
  tarea_id: string | null;
  proyecto_id: string | null;
  usuario_id: string;
  fecha: string;
  horas: number;
  descripcion: string;
  created_at: string;
};

export async function getRegistrosByTarea(tareaId: string): Promise<RegistroHoras[]> {
  const { data, error } = await supabase
    .from('registros_horas')
    .select('*')
    .eq('tarea_id', tareaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegistroHoras[];
}

export async function createRegistroHoras(form: {
  tarea_id: string | null;
  proyecto_id: string | null;
  usuario_id: string;
  fecha: string;
  horas: number;
  descripcion: string;
}): Promise<RegistroHoras> {
  const { data, error } = await supabase
    .from('registros_horas')
    .insert(form)
    .select('*')
    .single();
  if (error) throw error;
  return data as RegistroHoras;
}

export async function deleteRegistroHoras(id: string): Promise<void> {
  const { error } = await supabase.from('registros_horas').delete().eq('id', id);
  if (error) throw error;
}

export type ResumenHorasRow = {
  proyecto_id: string;
  proyecto_nombre: string;
  usuario_id: string;
  usuario_nombre: string;
  horas_reales: number;
  horas_estimadas: number;
};

export function useResumenHoras() {
  const resumen = ref<ResumenHorasRow[]>([]);
  const loading = ref(true);

  const load = async () => {
    try {
      const [registrosRes, tareasRes, proyectosRes, usuariosRes] = await Promise.all([
        supabase.from('registros_horas').select('proyecto_id, usuario_id, horas').not('proyecto_id', 'is', null),
        supabase.from('tareas').select('proyecto_id, horas_estimadas, asignado_a').not('proyecto_id', 'is', null),
        supabase.from('proyectos').select('id, nombre'),
        supabase.from('usuarios').select('id, nombre').eq('rol', 'ADMIN'),
      ]);

      const proyectoMap = new Map((proyectosRes.data ?? []).map((p: any) => [p.id, p.nombre]));
      const usuarioMap  = new Map((usuariosRes.data ?? []).map((u: any) => [u.id, u.nombre]));

      const map = new Map<string, ResumenHorasRow>();

      for (const t of (tareasRes.data ?? []) as any[]) {
        if (!t.proyecto_id || !t.asignado_a) continue;
        const key = `${t.proyecto_id}::${t.asignado_a}`;
        if (!map.has(key)) {
          map.set(key, {
            proyecto_id:    t.proyecto_id,
            proyecto_nombre: proyectoMap.get(t.proyecto_id) ?? '—',
            usuario_id:     t.asignado_a,
            usuario_nombre: usuarioMap.get(t.asignado_a) ?? '—',
            horas_reales:   0,
            horas_estimadas: 0,
          });
        }
        map.get(key)!.horas_estimadas += Number(t.horas_estimadas ?? 0);
      }

      for (const r of (registrosRes.data ?? []) as any[]) {
        if (!r.proyecto_id || !r.usuario_id) continue;
        const key = `${r.proyecto_id}::${r.usuario_id}`;
        if (!map.has(key)) {
          map.set(key, {
            proyecto_id:    r.proyecto_id,
            proyecto_nombre: proyectoMap.get(r.proyecto_id) ?? '—',
            usuario_id:     r.usuario_id,
            usuario_nombre: usuarioMap.get(r.usuario_id) ?? '—',
            horas_reales:   0,
            horas_estimadas: 0,
          });
        }
        map.get(key)!.horas_reales += Number(r.horas ?? 0);
      }

      resumen.value = [...map.values()].sort((a, b) =>
        a.proyecto_nombre.localeCompare(b.proyecto_nombre)
      );
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  load();
  return { resumen, loading, refresh: load };
}
