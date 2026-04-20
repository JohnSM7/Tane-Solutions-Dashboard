import { ref } from 'vue';
import { supabase } from '../supabase';

export type Alerta = {
  id: string;
  tipo: 'financiero' | 'proyecto' | 'gmb' | 'soporte' | 'infraestructura';
  severidad: 'alta' | 'media';
  titulo: string;
  descripcion: string;
  enlace: string;
  cliente?: string;
};

export function useAlertas() {
  const alertas     = ref<Alerta[]>([]);
  const loading     = ref(true);
  const lastUpdated = ref<Date | null>(null);

  const load = async () => {
    loading.value = true;
    try {
      const [facturasRes, proyectosRes, sedesRes, ticketsRes, servidoresRes] = await Promise.all([
        supabase
          .from('facturas')
          .select('id, concepto, importe, fecha_vencimiento, clientes(nombre)')
          .eq('estado', 'Vencida'),
        supabase
          .from('proyectos')
          .select('id, nombre, estado, clientes(nombre)')
          .in('estado', ['En riesgo', 'Retrasado', 'Bloqueado']),
        supabase
          .from('sedes')
          .select('id, nombre, gmb_unanswered, clientes(nombre)')
          .gt('gmb_unanswered', 0),
        supabase
          .from('tickets')
          .select('id, asunto, prioridad, fecha_creacion, clientes(nombre)')
          .neq('estado', 'Cerrado'),
        supabase
          .from('servidores')
          .select('id, nombre, estado')
          .neq('estado', 'Online'),
      ]);

      const lista: Alerta[] = [];

      for (const f of (facturasRes.data ?? []) as any[]) {
        lista.push({
          id: `fac-${f.id}`,
          tipo: 'financiero',
          severidad: 'alta',
          titulo: `Factura vencida: ${f.concepto}`,
          descripcion: `${f.clientes?.nombre ?? '—'} · ${f.importe.toLocaleString('es-ES')} €`,
          enlace: '/financial',
          cliente: f.clientes?.nombre,
        });
      }

      for (const p of (proyectosRes.data ?? []) as any[]) {
        lista.push({
          id: `proy-${p.id}`,
          tipo: 'proyecto',
          severidad: p.estado === 'Bloqueado' ? 'alta' : 'media',
          titulo: `Proyecto ${p.estado.toLowerCase()}: ${p.nombre}`,
          descripcion: p.clientes?.nombre ?? '—',
          enlace: '/operations',
          cliente: p.clientes?.nombre,
        });
      }

      for (const s of (sedesRes.data ?? []) as any[]) {
        lista.push({
          id: `gmb-${s.id}`,
          tipo: 'gmb',
          severidad: s.gmb_unanswered >= 3 ? 'alta' : 'media',
          titulo: `${s.gmb_unanswered} reseña(s) sin responder`,
          descripcion: `${s.nombre} · ${s.clientes?.nombre ?? '—'}`,
          enlace: '/clients',
          cliente: s.clientes?.nombre,
        });
      }

      for (const t of (ticketsRes.data ?? []) as any[]) {
        const dias = Math.floor((Date.now() - new Date(t.fecha_creacion).getTime()) / 86400000);
        lista.push({
          id: `ticket-${t.id}`,
          tipo: 'soporte',
          severidad: t.prioridad === 'Alta' || dias >= 2 ? 'alta' : 'media',
          titulo: `Ticket ${t.prioridad?.toLowerCase() ?? ''} prioridad: ${t.asunto}`,
          descripcion: `${t.clientes?.nombre ?? '—'} · Abierto hace ${dias} día(s)`,
          enlace: '/support',
          cliente: t.clientes?.nombre,
        });
      }

      for (const sv of (servidoresRes.data ?? []) as any[]) {
        lista.push({
          id: `srv-${sv.id}`,
          tipo: 'infraestructura',
          severidad: sv.estado === 'Offline' ? 'alta' : 'media',
          titulo: `Servidor ${sv.estado.toLowerCase()}: ${sv.nombre}`,
          descripcion: `Estado actual: ${sv.estado}`,
          enlace: '/support',
        });
      }

      alertas.value = lista.sort((a, b) =>
        (a.severidad === 'alta' ? -1 : 1) - (b.severidad === 'alta' ? -1 : 1),
      );
      lastUpdated.value = new Date();
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  load();

  return { alertas, loading, lastUpdated, reload: load };
}

export async function fetchAlertasCount(): Promise<number> {
  const [f, p, s, t, sv] = await Promise.all([
    supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'Vencida'),
    supabase.from('proyectos').select('id', { count: 'exact', head: true }).in('estado', ['En riesgo', 'Retrasado', 'Bloqueado']),
    supabase.from('sedes').select('id', { count: 'exact', head: true }).gt('gmb_unanswered', 0),
    supabase.from('tickets').select('id', { count: 'exact', head: true }).neq('estado', 'Cerrado'),
    supabase.from('servidores').select('id', { count: 'exact', head: true }).neq('estado', 'Online'),
  ]);
  return (f.count ?? 0) + (p.count ?? 0) + (s.count ?? 0) + (t.count ?? 0) + (sv.count ?? 0);
}
