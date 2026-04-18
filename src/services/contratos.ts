import { ref, computed } from 'vue';
import { supabase } from '../supabase';

export type Contrato = {
  id: string;
  cliente_id: string;
  nombre: string;
  tipo: 'Mensual' | 'Anual' | 'Puntual' | 'Retainer';
  valor_mensual: number;
  fecha_inicio: string;
  fecha_renovacion: string | null;
  ultima_facturacion: string | null;
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

// Tipos que generan facturas recurrentes
const TIPOS_RECURRENTES: Contrato['tipo'][] = ['Mensual', 'Retainer', 'Anual'];

// Devuelve true si el contrato necesita factura en el período actual
export function necesitaFacturacion(c: Contrato): boolean {
  if (c.estado !== 'Activo') return false;
  if (!TIPOS_RECURRENTES.includes(c.tipo)) return false;
  if (!c.ultima_facturacion) return true;

  const hoy = new Date();
  const ultima = new Date(c.ultima_facturacion);

  if (c.tipo === 'Anual') {
    // Facturar si han pasado al menos 11 meses desde la última facturación
    const diffMeses =
      (hoy.getFullYear() - ultima.getFullYear()) * 12 +
      (hoy.getMonth() - ultima.getMonth());
    return diffMeses >= 11;
  }

  // Mensual / Retainer: facturar si es un mes diferente al de la última factura
  return (
    hoy.getFullYear() !== ultima.getFullYear() ||
    hoy.getMonth() !== ultima.getMonth()
  );
}

export function importeFacturacion(c: Contrato): number {
  if (c.tipo === 'Anual') return c.valor_mensual; // valor_mensual = importe anual total
  return c.valor_mensual;
}

export function periodoLabel(c: Contrato): string {
  const hoy = new Date();
  const mes = hoy.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  if (c.tipo === 'Anual') {
    return `Cuota anual ${hoy.getFullYear()}`;
  }
  return `${c.nombre} — ${mes.charAt(0).toUpperCase() + mes.slice(1)}`;
}

// Genera una factura para un contrato recurrente y actualiza ultima_facturacion
export async function facturarContrato(c: Contrato): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0];

  // Número de factura
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('facturas')
    .select('id', { count: 'exact', head: true });
  const seq = String((count ?? 0) + 1).padStart(3, '0');
  const numero = `FAC-${year}-${seq}`;

  const { error } = await supabase.from('facturas').insert({
    cliente_id:     c.cliente_id || null,
    concepto:       periodoLabel(c),
    importe:        importeFacturacion(c),
    tipo_iva:       21,
    estado:         'Pendiente',
    numero_factura: numero,
    pago_numero:    1,
    pago_total:     1,
    fecha_emision:  hoy,
  });

  if (error) throw error;

  // Actualizar ultima_facturacion en el contrato
  const { error: errUpdate } = await supabase
    .from('contratos')
    .update({ ultima_facturacion: hoy })
    .eq('id', c.id);

  if (errUpdate) throw errUpdate;
}

export function useContratos() {
  const contratos = ref<Contrato[]>([]);
  const loading   = ref(true);

  const pendientesFacturacion = computed(() =>
    contratos.value.filter(necesitaFacturacion)
  );

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

  return { contratos, loading, refresh: fetch, pendientesFacturacion };
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
