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

export type MiembroEquipo = {
  id: string;
  nombre: string;
  rol: string;
  horas_disponibles_semana: number;
  horas_asignadas_semana: number;
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
  const equipo = ref<MiembroEquipo[]>([]);
  const loading = ref(true);

  // ── KPIs calculados automáticamente ─────────────────────────────────────────
  const kpis = computed(() => {
    const activos = proyectos.value.filter(p => p.estado !== 'Completado');
    const enRiesgo = proyectos.value.filter(p =>
      ['En riesgo', 'Retrasado', 'Bloqueado'].includes(p.estado)
    );

    // Tiempo medio de entrega en proyectos completados
    const completados = proyectos.value.filter(p => p.fecha_entrega_real && p.fecha_inicio);
    const avgDias = completados.length > 0
      ? completados.reduce((s, p) => {
          const diff =
            new Date(p.fecha_entrega_real!).getTime() -
            new Date(p.fecha_inicio).getTime();
          return s + diff / (1000 * 60 * 60 * 24);
        }, 0) / completados.length
      : 0;

    // Carga global del equipo
    const totalCap = equipo.value.reduce((s, m) => s + m.horas_disponibles_semana, 0);
    const totalAsg = equipo.value.reduce((s, m) => s + m.horas_asignadas_semana, 0);
    const loadPct = totalCap > 0 ? Math.round((totalAsg / totalCap) * 100) : 0;

    // Entregas este mes
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
        label: 'Carga del Equipo',
        value: `${loadPct}%`,
        trend: loadPct > 85 ? 'Alta — revisar' : loadPct > 65 ? 'Media' : 'Normal',
        color: loadPct > 85 ? '#ff4444' : loadPct > 65 ? '#ffa500' : '#e3ff04',
      },
      {
        label: 'Entregas este mes',
        value: String(entregasEsteMes.length),
        trend: activos.length > 0 ? `${activos.length} en curso` : '',
        color: '#e3ff04',
      },
    ];
  });

  // teamLoad normaliza a porcentaje para las barras
  const teamLoad = computed(() =>
    equipo.value.map(m => ({
      ...m,
      load: m.horas_disponibles_semana > 0
        ? Math.round((m.horas_asignadas_semana / m.horas_disponibles_semana) * 100)
        : 0,
      color:
        m.horas_asignadas_semana / m.horas_disponibles_semana >= 0.85 ? '#ff4444' :
        m.horas_asignadas_semana / m.horas_disponibles_semana >= 0.65 ? '#ffa500' :
        '#e3ff04',
    }))
  );

  Promise.all([
    supabase
      .from('proyectos')
      .select('*, clientes(nombre)')
      .order('fecha_inicio', { ascending: false }),
    supabase
      .from('miembros_equipo')
      .select('*')
      .order('nombre'),
  ]).then(([proyectosRes, equipoRes]) => {
    proyectos.value = (proyectosRes.data ?? []) as Proyecto[];
    equipo.value = (equipoRes.data ?? []) as MiembroEquipo[];
  })
  .catch(console.error)
  .finally(() => { loading.value = false; });

  return { proyectos, equipo, teamLoad, kpis, loading };
}

export async function createProyecto(form: Partial<Proyecto>): Promise<Proyecto> {
  const { data, error } = await supabase
    .from('proyectos')
    .insert(form)
    .select('*, clientes(nombre)')
    .single();
  if (error) throw error;
  return data as Proyecto;
}

export async function updateProyecto(id: string, updates: Partial<Proyecto>): Promise<Proyecto> {
  const { data, error } = await supabase
    .from('proyectos')
    .update(updates)
    .eq('id', id)
    .select('*, clientes(nombre)')
    .single();
  if (error) throw error;
  return data as Proyecto;
}

export async function deleteProyecto(id: string): Promise<void> {
  const { error } = await supabase.from('proyectos').delete().eq('id', id);
  if (error) throw error;
}

export async function createMiembro(form: Partial<MiembroEquipo>): Promise<MiembroEquipo> {
  const { data, error } = await supabase.from('miembros_equipo').insert(form).select().single();
  if (error) throw error;
  return data as MiembroEquipo;
}

export async function updateMiembro(id: string, updates: Partial<MiembroEquipo>): Promise<MiembroEquipo> {
  const { data, error } = await supabase
    .from('miembros_equipo')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MiembroEquipo;
}

export async function deleteMiembro(id: string): Promise<void> {
  const { error } = await supabase.from('miembros_equipo').delete().eq('id', id);
  if (error) throw error;
}
