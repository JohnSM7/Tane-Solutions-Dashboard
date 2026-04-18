import { ref } from 'vue';
import { supabase } from '../supabase';

export type Contrato = {
  id: string;
  cliente_id: string;
  nombre: string;
  tipo: 'Mensual' | 'Anual' | 'Puntual' | 'Retainer';
  valor_mensual: number;
  fecha_inicio: string;
  fecha_renovacion: string | null;
  estado: 'Activo' | 'Pausado' | 'Cancelado';
  notas: string;
  clientes?: { nombre: string };
};

export function diasParaRenovacion(fechaRenovacion: string | null): number | null {
  if (!fechaRenovacion) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const renovacion = new Date(fechaRenovacion);
  return Math.ceil((renovacion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export function renovacionColor(dias: number | null): string {
  if (dias === null) return '#6b7280';
  if (dias < 0)   return '#f87171';
  if (dias <= 15) return '#ff4444';
  if (dias <= 30) return '#ffa500';
  if (dias <= 60) return '#facc15';
  return '#4ade80';
}

export function renovacionLabel(dias: number | null): string {
  if (dias === null) return 'Sin fecha';
  if (dias < 0)    return `Vencido hace ${Math.abs(dias)} días`;
  if (dias === 0)  return 'Vence hoy';
  if (dias === 1)  return 'Vence mañana';
  return `Vence en ${dias} días`;
}

export function useContratos() {
  const contratos = ref<Contrato[]>([]);
  const loading   = ref(true);

  const fetch = async () => {
    try {
      const { data } = await supabase
        .from('contratos')
        .select('*, clientes(nombre)')
        .order('fecha_renovacion', { ascending: true, nullsFirst: false });
      contratos.value = (data ?? []) as Contrato[];
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  fetch();

  return { contratos, loading, refresh: fetch };
}

export async function createContrato(form: Omit<Contrato, 'id' | 'clientes'>): Promise<Contrato> {
  const { data, error } = await supabase.from('contratos').insert(form).select('*, clientes(nombre)').single();
  if (error) throw error;
  return data as Contrato;
}

export async function updateContrato(id: string, updates: Partial<Contrato>): Promise<Contrato> {
  const { data, error } = await supabase.from('contratos').update(updates).eq('id', id).select('*, clientes(nombre)').single();
  if (error) throw error;
  return data as Contrato;
}

export async function deleteContrato(id: string): Promise<void> {
  const { error } = await supabase.from('contratos').delete().eq('id', id);
  if (error) throw error;
}
