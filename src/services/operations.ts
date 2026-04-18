import { ref, computed } from 'vue';
import { supabase } from '../supabase';

export type Proyecto = {
  id: string;
  nombre: string;
  cliente_id: string | null;
  sede_id: number | null;
  estado: 'En curso' | 'En riesgo' | 'Retrasado' | 'Bloqueado' | 'Completado';
  fase: string;
  fecha_inicio: string;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  clientes?: { nombre: string };
};

export type UsuarioAdmin = {
  id: string;
  nombre: string;
  rol: string;
  horas_disponibles_semana: number;
};

export const ESTADO_COLORS: Record<string, string> = {
  'En curso':   '#e3ff04',
  'En riesgo':  '#ff4444',
  'Retrasado':  '#ff4444',
  'Bloqueado':  '#ffa500',
  'Completado': '#4ade80',
};

export function useOperationsData() {
  const proyectos = ref<Proyecto[]>([]);
  const equipo    = ref<UsuarioAdmin[]>([]);
  const loading   = ref(true);

  const kpis = computed(() => {
    const activos  = proyectos.value.filter(p => p.estado !== 'Completado');
    const enRiesgo = proyectos.value.filter(p =>
      ['En riesgo', 'Retrasado', 'Bloqueado'].includes(p.estado)
    );
    const completados = proyectos.value.filter(p => p.fecha_entrega_real && p.fecha_inicio);
    const avgDias = completados.length > 0
      ? completados.reduce((s, p) => {
          const diff = new Date(p.fecha_entrega_real!).getTime() - new Date(p.fecha_inicio).getTime();
          return s + diff / (1000 * 60 * 60 * 24);
        }, 0) / completados.length
      : 0;
    const now = new Date();
    const entregasEsteMes = proyectos.value.filter(p => {
      if (!p.fecha_entrega_real) return false;
      const d = new Date(p.fecha_entrega_real);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return [
      {
        label: 'Proyectos Activos',
        value: String(activos.length),
        trend: enRiesgo.length > 0 ? `${enRiesgo.length} en riesgo` : 'Sin alertas',
        color: enRiesgo.length > 0 ? '#ff4444' : '#e3ff04',
      },
      {
        label: 'Tiempo Medio Entrega',
        value: avgDias > 0 ? `${Math.round(avgDias)} días` : '—',
        trend: completados.length > 0 ? `de ${completados.length} proyectos` : 'Sin completados',
        color: '#e3ff04',
      },
      {
        label: 'Equipo',
        value: String(equipo.value.length),
        trend: equipo.value.length > 0 ? 'personas activas' : 'Sin miembros',
        color: '#e3ff04',
      },
      {
        label: 'Entregas este mes',
        value: String(entregasEsteMes.length),
        trend: activos.length > 0 ? `${activos.length} en curso` : '',
        color: '#e3ff04',
      },
    ];
  });

  // teamLoad: la carga real (horas tareas) se calcula en la vista desde useTareas()
  const teamLoad = computed(() => equipo.value);

  Promise.all([
    supabase
      .from('proyectos')
      .select('*')
      .order('fecha_inicio', { ascending: false }),
    supabase
      .from('usuarios')
      .select('id, nombre, rol, horas_disponibles_semana')
      .eq('rol', 'ADMIN')
      .order('nombre'),
    supabase
      .from('clientes')
      .select('id, nombre'),
  ]).then(([proyectosRes, equipoRes, clientesRes]) => {
    const clienteMap = new Map((clientesRes.data ?? []).map((c: any) => [c.id, c.nombre]));
    proyectos.value = ((proyectosRes.data ?? []) as Proyecto[]).map(p => ({
      ...p,
      clientes: p.cliente_id ? { nombre: clienteMap.get(p.cliente_id) ?? '' } : undefined,
    }));
    equipo.value = (equipoRes.data ?? []) as UsuarioAdmin[];
  })
  .catch(console.error)
  .finally(() => { loading.value = false; });

  return { proyectos, equipo, teamLoad, kpis, loading };
}

export async function createProyecto(form: Partial<Proyecto>): Promise<Proyecto> {
  const { clientes, ...clean } = form as any;
  const { data, error } = await supabase
    .from('proyectos')
    .insert(clean)
    .select('*')
    .single();
  if (error) throw error;
  return data as Proyecto;
}

export async function updateProyecto(id: string, updates: Partial<Proyecto>): Promise<Proyecto> {
  const { clientes, ...clean } = updates as any;
  const { data, error } = await supabase
    .from('proyectos')
    .update(clean)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Proyecto;
}

export async function deleteProyecto(id: string): Promise<void> {
  const { error } = await supabase.from('proyectos').delete().eq('id', id);
  if (error) throw error;
}

export async function updateUsuario(id: string, updates: { horas_disponibles_semana: number }): Promise<UsuarioAdmin> {
  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select('id, nombre, rol, horas_disponibles_semana')
    .single();
  if (error) throw error;
  return data as UsuarioAdmin;
}
