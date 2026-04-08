import { ref } from 'vue';
import { supabase } from '../supabase';

export type HomeKpis = {
  facturacionMes:    number;
  porCobrar:         number;
  facturasVencidas:  number;
  clientesActivos:   number;
  pipelineValor:     number;
  proyectosActivos:  number;
  proyectosEnRiesgo: number;
  ticketsAbiertos:   number;
  teamLoadPct:       number;
  alertasTotal:      number;
};

export function useHomeData() {
  const kpis = ref<HomeKpis | null>(null);
  const loading = ref(true);

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  Promise.all([
    // 1. Facturas del mes pagadas
    supabase.from('facturas').select('importe').eq('estado', 'Pagada')
      .gte('fecha_emision', firstOfMonth),
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
    supabase.from('tareas').select('horas_estimadas').neq('estado', 'completado'),
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
    facMesRes, pendienteRes, vencidasRes, clientesRes,
    pipelineRes, proyectosRes, ticketsRes, capacidadRes, tareasRes, alertasGroup,
  ]) => {
    const facturacionMes = (facMesRes.data ?? []).reduce((s: number, f: any) => s + f.importe, 0);
    const porCobrar      = (pendienteRes.data ?? []).reduce((s: number, f: any) => s + f.importe, 0);
    const pipelineValor  = (pipelineRes.data ?? []).reduce((s: number, l: any) => s + l.valor_estimado, 0);

    const proyList = proyectosRes.data ?? [];
    const proyectosActivos  = proyList.length;
    const proyectosEnRiesgo = proyList.filter((p: any) =>
      ['En riesgo', 'Retrasado', 'Bloqueado'].includes(p.estado)
    ).length;

    const totalCap = ((capacidadRes as any).data ?? []).reduce((s: number, u: any) => s + u.horas_disponibles_semana, 0);
    const totalAsg = ((tareasRes as any).data ?? []).reduce((s: number, t: any) => s + (t.horas_estimadas ?? 0), 0);
    const teamLoadPct = totalCap > 0 ? Math.round(totalAsg / totalCap * 100) : 0;

    const [af, ap, ag, at, asv] = alertasGroup as any[];
    const alertasTotal = (af.count ?? 0) + (ap.count ?? 0) + (ag.count ?? 0) + (at.count ?? 0) + (asv.count ?? 0);

    kpis.value = {
      facturacionMes,
      porCobrar,
      facturasVencidas:  vencidasRes.count ?? 0,
      clientesActivos:   clientesRes.count ?? 0,
      pipelineValor,
      proyectosActivos,
      proyectosEnRiesgo,
      ticketsAbiertos:   ticketsRes.count ?? 0,
      teamLoadPct,
      alertasTotal,
    };
  })
  .catch(console.error)
  .finally(() => { loading.value = false; });

  return { kpis, loading };
}
