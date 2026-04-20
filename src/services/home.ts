import { ref } from 'vue';
import { supabase } from '../supabase';

export type HomeKpis = {
  facturacionMes:       number;
  facturacionMesAnterior: number;
  tendenciaPct:         number;
  porCobrar:            number;
  facturasVencidas:     number;
  clientesActivos:      number;
  pipelineValor:        number;
  proyectosActivos:     number;
  proyectosEnRiesgo:    number;
  ticketsAbiertos:      number;
  teamLoadPct:          number;
  alertasTotal:         number;
  tareasPendientes:     number;
};

export type ActivityItem = {
  id: string;
  tipo: 'ticket' | 'lead' | 'factura';
  titulo: string;
  subtitulo: string;
  estado: string;
  color: string;
  fecha: string;
  link: string;
};

export function useHomeData() {
  const kpis     = ref<HomeKpis | null>(null);
  const activity = ref<ActivityItem[]>([]);
  const loading  = ref(true);

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const firstOfPrevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  // Hard cap: if all queries somehow hang past the fetch timeout, unblock the UI.
  const loadingGuard = setTimeout(() => { loading.value = false; }, 15_000);

  Promise.all([
    // 1. Facturas del mes pagadas
    supabase.from('facturas').select('importe').eq('estado', 'Pagada')
      .gte('fecha_emision', firstOfMonth),
    // 1b. Facturas del mes anterior pagadas (tendencia)
    supabase.from('facturas').select('importe').eq('estado', 'Pagada')
      .gte('fecha_emision', firstOfPrevMonth).lt('fecha_emision', firstOfMonth),
    // 2. Facturas pendientes (todas)
    supabase.from('facturas').select('importe').neq('estado', 'Pagada'),

    // 3. Facturas vencidas
    supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'Vencida'),
    // 4. Clientes activos
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('estado', 'Activo'),
    // 5. Pipeline comercial activo
    supabase.from('leads').select('valor_estimado')
      .not('estado', 'in', '("Cerrado-Ganado","Cerrado-Perdido")'),
    // 6. Proyectos operacionales
    supabase.from('proyectos').select('estado').neq('estado', 'Completado'),
    // 7. Tickets abiertos
    supabase.from('tickets').select('id', { count: 'exact', head: true }).neq('estado', 'Cerrado'),
    // 8. Capacidad semanal del equipo admin
    supabase.from('usuarios').select('horas_disponibles_semana').eq('rol', 'ADMIN'),
    // 9. Horas de tareas activas (para calcular carga real)
    supabase.from('tareas').select('horas_estimadas, estado').neq('estado', 'completado'),
    // 10. Alertas (vencidas + proyectos riesgo + GMB + tickets alta + servidores)
    Promise.all([
      supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'Vencida'),
      supabase.from('proyectos').select('id', { count: 'exact', head: true })
        .in('estado', ['En riesgo', 'Retrasado', 'Bloqueado']),
      supabase.from('sedes').select('id', { count: 'exact', head: true }).gt('gmb_unanswered', 0),
      supabase.from('tickets').select('id', { count: 'exact', head: true })
        .eq('prioridad', 'Alta').neq('estado', 'Cerrado'),
      supabase.from('servidores').select('id', { count: 'exact', head: true }).neq('estado', 'Online'),
    ]),
  ]).then(([
    facMesRes, facMesAntRes, pendienteRes, vencidasRes, clientesRes,
    pipelineRes, proyectosRes, ticketsRes, capacidadRes, tareasRes, alertasGroup,
  ]) => {
    const facturacionMes        = (facMesRes.data ?? []).reduce((s: number, f: any) => s + f.importe, 0);
    const facturacionMesAnterior = ((facMesAntRes as any).data ?? []).reduce((s: number, f: any) => s + f.importe, 0);
    const tendenciaPct = facturacionMesAnterior > 0
      ? Math.round((facturacionMes - facturacionMesAnterior) / facturacionMesAnterior * 100)
      : 0;
    const porCobrar      = (pendienteRes.data ?? []).reduce((s: number, f: any) => s + f.importe, 0);
    const pipelineValor  = (pipelineRes.data ?? []).reduce((s: number, l: any) => s + l.valor_estimado, 0);

    const proyList = proyectosRes.data ?? [];
    const proyectosActivos  = proyList.length;
    const proyectosEnRiesgo = proyList.filter((p: any) =>
      ['En riesgo', 'Retrasado', 'Bloqueado'].includes(p.estado)
    ).length;

    const tareasData = (tareasRes as any).data ?? [];
    const totalCap = ((capacidadRes as any).data ?? []).reduce((s: number, u: any) => s + u.horas_disponibles_semana, 0);
    const totalAsg = tareasData.reduce((s: number, t: any) => s + (t.horas_estimadas ?? 0), 0);
    const teamLoadPct = totalCap > 0 ? Math.round(totalAsg / totalCap * 100) : 0;
    const tareasPendientes = tareasData.filter((t: any) => t.estado === 'backlog').length;

    const [af, ap, ag, at, asv] = alertasGroup as any[];
    const alertasTotal = (af.count ?? 0) + (ap.count ?? 0) + (ag.count ?? 0) + (at.count ?? 0) + (asv.count ?? 0);

    kpis.value = {
      facturacionMes,
      facturacionMesAnterior,
      tendenciaPct,
      porCobrar,
      facturasVencidas:  vencidasRes.count ?? 0,
      clientesActivos:   clientesRes.count ?? 0,
      pipelineValor,
      proyectosActivos,
      proyectosEnRiesgo,
      ticketsAbiertos:   ticketsRes.count ?? 0,
      teamLoadPct,
      alertasTotal,
      tareasPendientes,
    };
  })
  .catch(console.error)
  .finally(() => { clearTimeout(loadingGuard); loading.value = false; });

  // Recent activity (parallel, non-blocking)
  Promise.all([
    supabase.from('tickets').select('id, asunto, estado, prioridad, fecha_creacion, clientes(nombre)')
      .order('fecha_creacion', { ascending: false }).limit(4),
    supabase.from('leads').select('id, nombre, empresa, estado, fecha_creacion')
      .order('fecha_creacion', { ascending: false }).limit(4),
    supabase.from('facturas').select('id, numero_factura, concepto, estado, importe, fecha_emision')
      .order('fecha_emision', { ascending: false }).limit(3),
  ]).then(([ticketsR, leadsR, facturasR]) => {
    const items: ActivityItem[] = [];

    for (const t of (ticketsR.data ?? []) as any[]) {
      const color = t.estado === 'Cerrado' ? '#4ade80' : t.prioridad === 'Alta' ? '#ff4444' : '#ffa500';
      items.push({ id: `t-${t.id}`, tipo: 'ticket', titulo: t.asunto,
        subtitulo: (t.clientes as any)?.nombre ?? 'Cliente',
        estado: t.estado, color, fecha: t.fecha_creacion, link: '/support' });
    }
    for (const l of (leadsR.data ?? []) as any[]) {
      const color = l.estado === 'Cerrado-Ganado' ? '#4ade80' : l.estado === 'Cerrado-Perdido' ? '#94a3b8' : '#e3ff04';
      items.push({ id: `l-${l.id}`, tipo: 'lead', titulo: l.empresa || l.nombre,
        subtitulo: l.nombre, estado: l.estado, color, fecha: l.fecha_creacion, link: '/commercial' });
    }
    for (const f of (facturasR.data ?? []) as any[]) {
      const color = f.estado === 'Pagada' ? '#4ade80' : f.estado === 'Vencida' ? '#ff4444' : '#ffa500';
      items.push({ id: `f-${f.id}`, tipo: 'factura',
        titulo: f.numero_factura ? `Factura ${f.numero_factura}` : f.concepto,
        subtitulo: `${(f.importe ?? 0).toLocaleString('es-ES')} €`,
        estado: f.estado, color, fecha: f.fecha_emision, link: '/financial' });
    }

    items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    activity.value = items.slice(0, 8);
  }).catch(console.error);

  return { kpis, activity, loading };
}
