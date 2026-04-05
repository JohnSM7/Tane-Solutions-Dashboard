import { ref, computed } from 'vue';
import { supabase } from '../supabase';

export type Lead = {
  id: string;
  cliente_id: string | null;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  fuente: string;
  servicio: string;
  estado: 'Nuevo' | 'Cualificado' | 'Propuesta' | 'Negociación' | 'Cerrado-Ganado' | 'Cerrado-Perdido';
  valor_estimado: number;
  cac: number;
  notas: string;
  fecha_creacion: string;
  fecha_cierre: string | null;
};

export const ESTADO_COLORS: Record<string, string> = {
  'Nuevo':           '#ffffff',
  'Cualificado':     '#e3ff04',
  'Propuesta':       '#e3ff04',
  'Negociación':     '#ffa500',
  'Cerrado-Ganado':  '#4ade80',
  'Cerrado-Perdido': '#ff4444',
};

export const PIPELINE_STAGES = ['Nuevo', 'Cualificado', 'Propuesta', 'Negociación', 'Cerrado-Ganado'];
const PIPELINE_WIDTHS = ['100%', '80%', '60%', '40%', '25%'];

export function useCommercialData() {
  const leads = ref<Lead[]>([]);
  const loading = ref(true);

  const kpis = computed(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const active = leads.value.filter(l => l.estado !== 'Cerrado-Perdido');
    const newThisWeek = active.filter(l => new Date(l.fecha_creacion) >= weekAgo);
    const prevWeek = active.filter(l => {
      const d = new Date(l.fecha_creacion);
      return d >= twoWeeksAgo && d < weekAgo;
    });

    const ganados = leads.value.filter(l => l.estado === 'Cerrado-Ganado');
    const convRate = active.length > 0 ? Math.round(ganados.length / active.length * 100) : 0;

    const avgValue = ganados.length > 0
      ? ganados.reduce((s, l) => s + l.valor_estimado, 0) / ganados.length
      : 0;

    const avgCac = leads.value.filter(l => l.cac > 0).length > 0
      ? leads.value.filter(l => l.cac > 0).reduce((s, l) => s + l.cac, 0) /
        leads.value.filter(l => l.cac > 0).length
      : 0;

    const leadsChange = prevWeek.length > 0
      ? Math.round((newThisWeek.length - prevWeek.length) / prevWeek.length * 100)
      : 0;
    const trendSign = leadsChange >= 0 ? '+' : '';

    return [
      {
        label: 'Leads Nuevos (Semana)',
        value: String(newThisWeek.length),
        trend: leads.value.length > 0 ? `${trendSign}${leadsChange}% vs semana ant.` : 'Sin datos aún',
        color: '#e3ff04',
      },
      {
        label: 'Tasa de Conversión',
        value: `${convRate}%`,
        trend: `${ganados.length} cerrados de ${active.length}`,
        color: convRate >= 20 ? '#e3ff04' : '#ffa500',
      },
      {
        label: 'Valor Promedio (Ganado)',
        value: avgValue > 0 ? `${Math.round(avgValue).toLocaleString('es-ES')} €` : '—',
        trend: '',
        color: '#ffffff',
      },
      {
        label: 'CAC Promedio',
        value: avgCac > 0 ? `${Math.round(avgCac).toLocaleString('es-ES')} €` : '—',
        trend: '',
        color: '#ffffff',
      },
    ];
  });

  const pipeline = computed(() => {
    return PIPELINE_STAGES.map((stage, i) => {
      const count = leads.value.filter(l => l.estado === stage).length;
      return {
        label: stage === 'Cerrado-Ganado' ? 'Cerrados' : stage,
        count,
        width: PIPELINE_WIDTHS[i],
        highlight: stage === 'Cerrado-Ganado',
      };
    });
  });

  const topServices = computed(() => {
    const map: Record<string, number> = {};
    leads.value
      .filter(l => l.estado === 'Cerrado-Ganado' && l.servicio)
      .forEach(l => { map[l.servicio] = (map[l.servicio] ?? 0) + 1; });
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, sales]) => ({
        name,
        sales,
        value: Math.round(sales / total * 100) + '%',
      }));
  });

  Promise.resolve(supabase.from('leads').select('*').order('fecha_creacion', { ascending: false }))
    .then(({ data }) => {
      leads.value = (data ?? []) as Lead[];
    })
    .catch(console.error)
    .finally(() => { loading.value = false; });

  return { leads, kpis, pipeline, topServices, loading };
}

export async function createLead(form: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert(form).select().single();
  if (error) throw error;
  return data as Lead;
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}
