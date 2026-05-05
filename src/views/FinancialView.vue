<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import BillingChart from '../components/BillingChart.vue';
import {
  useFinancialData,
  createFactura, updateFactura, deleteFactura,
  createProyectoRentabilidad, updateProyectoRentabilidad, deleteProyectoRentabilidad,
  createFacturasFromPlan, generateInvoicePDF,
  createGasto, deleteGasto,
  fetchSuscripciones, createSuscripcion, updateSuscripcion, deleteSuscripcion, registrarPagoSuscripcion,
  PLANES_PAGO, TIPOS_IVA, CATEGORIAS_GASTO, FRECUENCIA_LABELS,
  type Factura, type ProyectoRentabilidad, type Gasto, type Suscripcion,
} from '../services/financial';
import { useClientsList } from '../services/clients';
import { exportCsv } from '../utils/exportCsv';
import { supabase } from '../supabase';

const { facturas, proyectos, gastos, proyectosConFacturas, kpis, monthlyBilling, loading } = useFinancialData();
const { clients } = useClientsList();

// ── Suscripciones ─────────────────────────────────────────────────────────────
const suscripciones = ref<Suscripcion[]>([]);
const loadingSusc = ref(true);
fetchSuscripciones().then(d => { suscripciones.value = d; }).finally(() => { loadingSusc.value = false; });

const showSuscModal = ref(false);
const savingSusc = ref(false);
const editingSuscId = ref<string | null>(null);
const registrandoPago = ref<string | null>(null);

const emptySusc = (): Partial<Suscripcion> => ({
  concepto: '', cliente_id: null, proyecto_id: null,
  importe: 0, tipo_iva: 21, frecuencia: 'mensual',
  fecha_inicio: new Date().toISOString().split('T')[0],
  estado: 'activa', notas: '',
});
const suscForm = ref<Partial<Suscripcion>>(emptySusc());

const openNewSusc = () => { suscForm.value = emptySusc(); editingSuscId.value = null; showSuscModal.value = true; };
const openEditSusc = (s: Suscripcion) => { suscForm.value = { ...s }; editingSuscId.value = s.id; showSuscModal.value = true; };

const saveSusc = async () => {
  savingSusc.value = true;
  try {
    const payload = { ...suscForm.value };
    if (!payload.cliente_id) payload.cliente_id = null;
    if (!payload.proyecto_id) payload.proyecto_id = null;
    if (!payload.notas) payload.notas = null;
    if (editingSuscId.value) {
      const updated = await updateSuscripcion(editingSuscId.value, payload);
      const idx = suscripciones.value.findIndex(s => s.id === editingSuscId.value);
      if (idx !== -1) suscripciones.value[idx] = updated;
    } else {
      const created = await createSuscripcion(payload);
      suscripciones.value.unshift(created);
    }
    showSuscModal.value = false;
  } catch (e: any) {
    alert('Error al guardar: ' + (e?.message ?? ''));
  } finally {
    savingSusc.value = false;
  }
};

const removeSusc = async (s: Suscripcion) => {
  if (!confirm(`¿Eliminar suscripción "${s.concepto}"?`)) return;
  await deleteSuscripcion(s.id);
  suscripciones.value = suscripciones.value.filter(x => x.id !== s.id);
};

const registrarPago = async (s: Suscripcion) => {
  registrandoPago.value = s.id;
  try {
    const cl = clients.value.find(c => c.id === s.cliente_id);
    const clienteData = cl ? { nombre: cl.name, cif: cl.cif, direccion_facturacion: cl.direccionFacturacion } : null;
    const factura = await registrarPagoSuscripcion(s, clienteData ?? null);
    facturas.value.unshift(factura);
    const idx = suscripciones.value.findIndex(x => x.id === s.id);
    if (idx !== -1) suscripciones.value[idx] = { ...suscripciones.value[idx]!, fecha_ultimo_pago: factura.fecha_emision };
  } catch (e: any) {
    alert('Error al registrar pago: ' + (e?.message ?? ''));
  } finally {
    registrandoPago.value = null;
  }
};

const proximoPago = (s: Suscripcion): string => {
  const base = s.fecha_ultimo_pago ?? s.fecha_inicio;
  const d = new Date(base + 'T00:00:00');
  const months = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
  d.setMonth(d.getMonth() + (months[s.frecuencia] ?? 1));
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const exportFacturas = () => exportCsv('facturas.csv', facturas.value.map(f => ({
  Número: f.numero_factura ?? '',
  Concepto: f.concepto,
  Cliente: (f as any).clientes?.nombre ?? '',
  Importe: f.importe,
  Estado: f.estado,
  'Fecha emisión': f.fecha_emision,
})));

// ── Proyectos: filtro y expansión ─────────────────────────────────────────────
const expandedProjectId = ref<string | null>(null);
const toggleExpand = (id: string) => {
  expandedProjectId.value = expandedProjectId.value === id ? null : id;
};

const filtroProyectoCliente = ref('');
const filtroProyectoFechaDesde = ref('');
const filtroProyectoFechaHasta = ref('');

const proyectosFiltrados = computed(() => {
  const now = new Date();
  const mesActual = now.getMonth();
  const anioActual = now.getFullYear();

  return proyectosConFacturas.value.filter(p => {
    // Filtro de búsqueda por nombre/cliente
    if (filtroProyectoCliente.value) {
      const q = filtroProyectoCliente.value.toLowerCase();
      const matchNombre = p.nombre.toLowerCase().includes(q);
      const matchCliente = (p.clientes?.nombre ?? '').toLowerCase().includes(q);
      if (!matchNombre && !matchCliente) return false;
    }

    // Filtro por rango de fechas manual
    if (filtroProyectoFechaDesde.value && p.fecha_inicio < filtroProyectoFechaDesde.value) return false;
    if (filtroProyectoFechaHasta.value && p.fecha_inicio > filtroProyectoFechaHasta.value) return false;

    // Sin filtros manuales: mostrar solo proyectos del mes actual o con facturas pendientes
    if (!filtroProyectoCliente.value && !filtroProyectoFechaDesde.value && !filtroProyectoFechaHasta.value) {
      const esMesActual = (() => {
        const d = new Date(p.fecha_inicio + 'T00:00:00');
        return d.getMonth() === mesActual && d.getFullYear() === anioActual;
      })();
      const tienePendiente = p.facturas.some(f => f.estado !== 'Pagada');
      return esMesActual || tienePendiente;
    }

    return true;
  });
});

const margen = (p: ProyectoRentabilidad) =>
  p.presupuesto > 0 ? Math.round((p.presupuesto - p.coste) / p.presupuesto * 100) : 0;

const totalFacturadoProyecto = (facturasProyecto: Factura[]) =>
  facturasProyecto.reduce((s, f) => s + f.importe, 0);

const totalCobradoProyecto = (facturasProyecto: Factura[]) =>
  facturasProyecto.filter(f => f.estado === 'Pagada').reduce((s, f) => s + f.importe, 0);

const pctFacturado = (p: ProyectoRentabilidad & { facturas: Factura[] }) =>
  p.presupuesto > 0 ? Math.min(100, Math.round(totalFacturadoProyecto(p.facturas) / p.presupuesto * 100)) : 0;

const pctCobrado = (p: ProyectoRentabilidad & { facturas: Factura[] }) =>
  p.presupuesto > 0 ? Math.min(100, Math.round(totalCobradoProyecto(p.facturas) / p.presupuesto * 100)) : 0;

// ── Modal: Nuevo / Editar Proyecto ────────────────────────────────────────────
const showPrModal = ref(false);
const savingP = ref(false);
const editingPrId = ref<string | null>(null);
const generatingInvoices = ref(false);
const prError = ref('');

const emptyPr = (): Partial<ProyectoRentabilidad> => ({
  nombre: '', cliente_id: '', presupuesto: 0, coste: 0, plan_pago: '50/50',
  personalizado_pagos: [],
  fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '',
});
const prForm = ref<Partial<ProyectoRentabilidad>>(emptyPr());

const openNewPr = () => { prForm.value = emptyPr(); editingPrId.value = null; prError.value = ''; showPrModal.value = true; };
const openEditPr = (p: ProyectoRentabilidad) => {
  prForm.value = { ...p, personalizado_pagos: p.personalizado_pagos || [] };
  editingPrId.value = p.id;
  prError.value = '';
  showPrModal.value = true;
};

const patchProyectoCliente = (p: ProyectoRentabilidad) => {
  const cl = clients.value.find(c => c.id === p.cliente_id);
  if (cl) p.clientes = { nombre: cl.name };
};

const patchFacturaJoins = (f: Factura) => {
  const cl = clients.value.find(c => c.id === f.cliente_id);
  if (cl) f.clientes = { nombre: cl.name, cif: cl.cif, direccion_facturacion: cl.direccionFacturacion };
  const pr = proyectos.value.find(p => p.id === f.proyecto_id);
  if (pr) f.proyectos_rentabilidad = { nombre: pr.nombre };
};

const savePr = async () => {
  prError.value = '';
  savingP.value = true;
  try {
    const payload = { ...prForm.value };
    if (!payload.fecha_fin) delete payload.fecha_fin;
    if (!payload.cliente_id) delete payload.cliente_id;

    // Validación para plan personalizado: La suma de hitos debe coincidir con el presupuesto
    if (payload.plan_pago === 'personalizado') {
      const totalHitos = payload.personalizado_pagos?.reduce((sum, p) => sum + (p.importe || 0), 0) || 0;
      if (Math.abs(totalHitos - (payload.presupuesto || 0)) > 0.01) {
        prError.value = `La suma de los hitos (${totalHitos.toFixed(2)}€) no coincide con el presupuesto (${payload.presupuesto?.toFixed(2)}€).`;
        savingP.value = false;
        return;
      }
    }

    if (editingPrId.value) {
      const original = proyectos.value.find(p => p.id === editingPrId.value);
      const updated = await updateProyectoRentabilidad(editingPrId.value, payload);
      patchProyectoCliente(updated);
      const idx = proyectos.value.findIndex(p => p.id === editingPrId.value);
      if (idx !== -1) proyectos.value[idx] = updated;

      // Detectar si cambió el plan de pago, presupuesto o hitos personalizados
      const planChanged = original && (
        original.plan_pago !== payload.plan_pago ||
        original.presupuesto !== payload.presupuesto ||
        JSON.stringify(original.personalizado_pagos) !== JSON.stringify(payload.personalizado_pagos)
      );

      if (planChanged) {
        const facturasProyecto = facturas.value.filter(f => f.proyecto_id === editingPrId.value);
        const facturasRegenerables = facturasProyecto.filter(f => f.estado !== 'Pagada');
        if (facturasRegenerables.length > 0) {
          const confirmar = confirm(
            `El plan de pago ha cambiado. ¿Deseas eliminar las ${facturasRegenerables.length} factura(s) pendiente(s) y regenerarlas según el nuevo plan?`
          );
          if (confirmar) {
            generatingInvoices.value = true;
            for (const f of facturasRegenerables) {
              await deleteFactura(f.id);
            }
            facturas.value = facturas.value.filter(
              f => !(f.proyecto_id === editingPrId.value && f.estado !== 'Pagada')
            );
            if (updated.presupuesto > 0) {
              const nuevasFacturas = await createFacturasFromPlan(updated, payload.cliente_id ?? null);
              nuevasFacturas.forEach(patchFacturaJoins);
              facturas.value.unshift(...nuevasFacturas);
            }
          }
        } else if (updated.presupuesto > 0 && facturasProyecto.length === 0) {
          generatingInvoices.value = true;
          const nuevasFacturas = await createFacturasFromPlan(updated, payload.cliente_id ?? null);
          nuevasFacturas.forEach(patchFacturaJoins);
          facturas.value.unshift(...nuevasFacturas);
        }
      }
    } else {
      const created = await createProyectoRentabilidad(payload);
      patchProyectoCliente(created);
      proyectos.value.unshift(created);

      if (created.presupuesto > 0) {
        generatingInvoices.value = true;
        const nuevasFacturas = await createFacturasFromPlan(created, payload.cliente_id ?? null);
        nuevasFacturas.forEach(patchFacturaJoins);
        facturas.value.unshift(...nuevasFacturas);
      }
    }
    showPrModal.value = false;
  } catch (e: any) {
    prError.value = e?.message ?? 'Error al guardar. Revisa la consola del navegador.';
  } finally {
    savingP.value = false;
    generatingInvoices.value = false;
  }
};

const removePr = async (p: ProyectoRentabilidad) => {
  if (!confirm(`¿Eliminar "${p.nombre}"? También se eliminarán sus facturas asociadas.`)) return;
  try {
    await deleteProyectoRentabilidad(p.id);
    proyectos.value = proyectos.value.filter(x => x.id !== p.id);
    facturas.value = facturas.value.filter(f => f.proyecto_id !== p.id);
  } catch (error: any) {
    console.error('[removePr] Error:', error);
    alert('Error al eliminar el proyecto: ' + (error.message || 'Error desconocido'));
  }
};

// ── Modal: Factura manual (sin proyecto) ─────────────────────────────────────
const showFacturaModal = ref(false);
const savingF = ref(false);
const editingFacturaId = ref<string | null>(null);

const emptyFactura = (): Partial<Factura> => ({
  cliente_id: '', proyecto_id: null, concepto: '', importe: 0, tipo_iva: 21,
  estado: 'Pendiente', fecha_emision: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '', fecha_pago: '',
});
const facturaForm = ref<Partial<Factura>>(emptyFactura());

const openNewFactura = () => {
  facturaForm.value = emptyFactura(); editingFacturaId.value = null; showFacturaModal.value = true;
};
const openNewFacturaForProject = (p: ProyectoRentabilidad) => {
  facturaForm.value = {
    ...emptyFactura(),
    cliente_id: p.cliente_id ?? '',
    proyecto_id: p.id,
  };
  editingFacturaId.value = null;
  showFacturaModal.value = true;
};
const openEditFactura = (f: Factura) => {
  facturaForm.value = { ...f }; editingFacturaId.value = f.id; showFacturaModal.value = true;
};

// Proyectos del cliente seleccionado en el formulario de factura
const proyectosDelCliente = () =>
  proyectos.value.filter(p => p.cliente_id === facturaForm.value.cliente_id);

const saveFactura = async () => {
  savingF.value = true;
  try {
    const payload = { ...facturaForm.value };
    if (!payload.fecha_vencimiento) delete payload.fecha_vencimiento;
    if (!payload.fecha_pago) delete payload.fecha_pago;
    if (!payload.cliente_id) delete payload.cliente_id;
    if (!payload.proyecto_id) payload.proyecto_id = null;

    if (editingFacturaId.value) {
      const updated = await updateFactura(editingFacturaId.value, payload);
      patchFacturaJoins(updated);
      const idx = facturas.value.findIndex(f => f.id === editingFacturaId.value);
      if (idx !== -1) facturas.value[idx] = updated;
    } else {
      const created = await createFactura(payload);
      patchFacturaJoins(created);
      facturas.value.unshift(created);
    }
    showFacturaModal.value = false;
  } catch (error: any) {
    console.error('[saveFactura] Error:', error);
    alert('Error al guardar la factura: ' + (error.message || 'Error desconocido'));
  } finally {
    savingF.value = false;
  }
};

const removeFactura = async (f: Factura) => {
  if (!confirm(`¿Eliminar factura "${f.concepto}"?`)) return;
  try {
    await deleteFactura(f.id);
    facturas.value = facturas.value.filter(x => x.id !== f.id);
  } catch (error: any) {
    console.error('[removeFactura] Error:', error);
    alert('Error al eliminar la factura: ' + (error.message || 'Error desconocido'));
  }
};

// ── Cambio rápido de estado ───────────────────────────────────────────────────
const cambiarEstado = async (f: Factura, estado: Factura['estado']) => {
  try {
    const updates: Partial<Factura> = { estado };
    if (estado === 'Pagada') updates.fecha_pago = new Date().toISOString().split('T')[0];
    const updated = await updateFactura(f.id, updates);
    // Preserve join data since updateFactura no longer returns nested objects
    updated.clientes = f.clientes;
    updated.proyectos_rentabilidad = f.proyectos_rentabilidad;
    const idx = facturas.value.findIndex(x => x.id === f.id);
    if (idx !== -1) facturas.value[idx] = updated;
  } catch (error: any) {
    console.error('[cambiarEstado] Error:', error);
    alert('Error al cambiar el estado: ' + (error.message || 'Error desconocido'));
  }
};

// ── PDF ───────────────────────────────────────────────────────────────────────
const downloadingPDF = ref(false);
const downloadPDF = async (f: Factura) => {
  if (downloadingPDF.value) return;
  downloadingPDF.value = true;
  try {
    const cliente = f.clientes
      ? { nombre: f.clientes.nombre, cif: f.clientes.cif, direccion_facturacion: f.clientes.direccion_facturacion }
      : null;
    await generateInvoicePDF(f, cliente, f.proyectos_rentabilidad?.nombre ?? '');
  } catch (error: any) {
    console.error('[downloadPDF] Error:', error);
    alert('Error al generar el PDF: ' + (error.message || 'Error desconocido'));
  } finally {
    downloadingPDF.value = false;
  }
};

// ── Gastos ────────────────────────────────────────────────────────────────────
const gastoFormVisible = ref<string | null>(null); // proyecto_id activo o null
const savingGasto = ref(false);
const gastoForm = ref<{ concepto: string; importe: number; categoria: string; fecha: string }>({ concepto: '', importe: 0, categoria: 'Otro', fecha: new Date().toISOString().split('T')[0] as string });

const openGastoForm = (proyectoId: string) => {
  gastoFormVisible.value = proyectoId;
  gastoForm.value = { concepto: '', importe: 0, categoria: 'Otro', fecha: new Date().toISOString().split('T')[0] as string };
};

const saveGasto = async (proyectoId: string) => {
  if (!gastoForm.value.concepto || gastoForm.value.importe <= 0) return;
  savingGasto.value = true;
  try {
    const created = await createGasto({ proyecto_id: proyectoId, ...gastoForm.value });
    gastos.value.unshift(created);
    gastoFormVisible.value = null;
  } catch (e: any) {
    alert('Error al guardar el gasto: ' + (e.message ?? ''));
  } finally {
    savingGasto.value = false;
  }
};

const removeGasto = async (g: Gasto) => {
  if (!confirm(`¿Eliminar gasto "${g.concepto}"?`)) return;
  await deleteGasto(g.id);
  gastos.value = gastos.value.filter(x => x.id !== g.id);
};

// ── Utils ─────────────────────────────────────────────────────────────────────
const formatEur = (n: number) =>
  new Intl.NumberFormat('es-ES').format(n) + ' €';

const formatDate = (d?: string | null) => d
  ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
  : '—';

const estadoColor: Record<string, string> = {
  Pagada: '#4ade80', Pendiente: '#ffa500', Vencida: '#ff4444',
};

// Facturas sueltas (sin proyecto vinculado)
const facturasSueltas = () => facturas.value.filter(f => !f.proyecto_id);

// ── Previsión de tesorería (próximos 6 meses) ─────────────────────────────────
const cashFlow = computed(() => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
    let cobrado = 0;
    let pendiente = 0;
    let vencido = 0;
    for (const f of facturas.value) {
      const ref = f.fecha_vencimiento ?? f.fecha_emision;
      if (!ref) continue;
      const fd = new Date(ref);
      if (fd.getMonth() !== m || fd.getFullYear() !== y) continue;
      if (f.estado === 'Pagada') cobrado += f.importe;
      else if (f.estado === 'Vencida') vencido += f.importe;
      else pendiente += f.importe;
    }
    return { label, cobrado, pendiente, vencido, total: cobrado + pendiente + vencido };
  });
});

const cashFlowMax = computed(() => Math.max(...cashFlow.value.map(m => m.total), 1));

// ── CAC por cliente (leads ganados) ──────────────────────────────────────────
const cacPorCliente = ref<Map<string, number>>(new Map());
supabase.from('leads').select('cliente_id, cac').eq('estado', 'Cerrado-Ganado').then(({ data }) => {
  const map = new Map<string, number>();
  for (const l of (data ?? []) as any[]) {
    if (!l.cliente_id) continue;
    map.set(l.cliente_id, (map.get(l.cliente_id) ?? 0) + (l.cac ?? 0));
  }
  cacPorCliente.value = map;
});

// ── Rentabilidad por cliente ──────────────────────────────────────────────────
const rentabilidadClientes = computed(() => {
  const map = new Map<string, {
    nombre: string;
    facturado: number;
    cobrado: number;
    coste: number;
  }>();

  // Build project→client lookup so invoices without cliente_id are resolved via proyecto_id
  const proyectoClienteMap = new Map<string, string>();
  const proyectoClienteNombre = new Map<string, string>();
  for (const p of proyectos.value) {
    if (p.id && p.cliente_id) {
      proyectoClienteMap.set(p.id, p.cliente_id);
      if (p.clientes?.nombre) proyectoClienteNombre.set(p.id, p.clientes.nombre);
    }
  }

  for (const f of facturas.value) {
    // Use direct cliente_id; fall back to the linked project's cliente_id
    const clienteId = f.cliente_id
      ?? (f.proyecto_id ? (proyectoClienteMap.get(f.proyecto_id) ?? null) : null);
    if (!clienteId) continue;

    const nombre = f.clientes?.nombre
      ?? (f.proyecto_id ? proyectoClienteNombre.get(f.proyecto_id) : undefined)
      ?? clienteId;

    if (!map.has(clienteId)) map.set(clienteId, { nombre, facturado: 0, cobrado: 0, coste: 0 });
    const entry = map.get(clienteId)!;
    entry.facturado += f.importe;
    if (f.estado === 'Pagada') entry.cobrado += f.importe;
  }

  for (const p of proyectosConFacturas.value) {
    if (!p.cliente_id) continue;
    if (!map.has(p.cliente_id)) {
      const nombre = p.clientes?.nombre ?? p.cliente_id;
      map.set(p.cliente_id, { nombre, facturado: 0, cobrado: 0, coste: 0 });
    }
    const gastosExtras = p.gastos.reduce((s, g) => s + g.importe, 0);
    map.get(p.cliente_id)!.coste += (p.coste ?? 0) + gastosExtras;
  }

  return [...map.entries()]
    .map(([id, d]) => {
      const cac = cacPorCliente.value.get(id) ?? 0;
      const costoTotal = d.coste + cac;
      return {
        id,
        nombre: d.nombre,
        facturado: d.facturado,
        cobrado: d.cobrado,
        pendiente: d.facturado - d.cobrado,
        coste: d.coste,
        cac,
        costoTotal,
        margen: d.facturado > 0 ? Math.round((d.facturado - costoTotal) / d.facturado * 100) : 0,
      };
    })
    .sort((a, b) => b.facturado - a.facturado);
});
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo Financiero</h1>
      <span class="subtitle">La Salud del Negocio</span>
    </div>

    <div v-if="loading" class="loading-state">Cargando datos...</div>

    <template v-else>
      <!-- KPIs automáticos -->
      <div class="metrics-grid">
        <DashboardCard v-for="kpi in kpis" :key="kpi.label">
          <div class="kpi-item">
            <span class="kpi-label">{{ kpi.label }}</span>
            <div class="kpi-value-row">
              <span class="kpi-value">{{ kpi.value }}</span>
              <span class="kpi-trend" :style="{ color: kpi.color }">{{ kpi.trend }}</span>
            </div>
          </div>
        </DashboardCard>
      </div>

      <!-- Gráfica -->
      <div class="content-grid">
        <DashboardCard title="Facturación Mes a Mes">
          <template #actions>
            <button class="btn-action" @click="exportFacturas">↓ CSV</button>
          </template>
          <div v-if="facturas.length === 0" class="empty-chart">Añade proyectos para ver la gráfica</div>
          <BillingChart v-else :data="monthlyBilling" />
        </DashboardCard>

        <!-- Resumen rápido facturas sueltas -->
        <DashboardCard title="Facturas Sueltas">
          <template #actions>
            <button class="btn-action" @click="openNewFactura">+ Nueva</button>
          </template>
          <div v-if="facturasSueltas().length === 0" class="empty-chart">
            Las facturas sin proyecto aparecerán aquí
          </div>
          <div v-else class="simple-facturas">
            <div v-for="f in facturasSueltas().slice(0, 6)" :key="f.id" class="sf-row">
              <div class="sf-info">
                <span class="sf-concepto">{{ f.numero_factura }} · {{ f.concepto }}</span>
                <span class="sf-client muted">{{ f.clientes?.nombre ?? '—' }}</span>
              </div>
              <div class="sf-right">
                <span class="sf-importe">{{ formatEur(f.importe) }}</span>
                <select
                  class="estado-select"
                  :value="f.estado"
                  :style="{ color: estadoColor[f.estado] }"
                  @change="cambiarEstado(f, ($event.target as HTMLSelectElement).value as Factura['estado'])"
                >
                  <option>Pendiente</option><option>Pagada</option><option>Vencida</option>
                </select>
                <button class="btn-pdf" @click="downloadPDF(f)" :disabled="downloadingPDF" title="Descargar PDF">📄</button>
                <button class="btn-icon-text" @click="openEditFactura(f)">✏️</button>
                <button class="btn-icon-text danger" @click="removeFactura(f)">🗑️</button>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- PREVISIÓN DE TESORERÍA                                             -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <DashboardCard title="Previsión de Tesorería — Próximos 6 meses">
        <div v-if="facturas.length === 0" class="empty-chart">Añade facturas para ver la previsión</div>
        <div v-else class="cf-container">
          <div class="cf-bars">
            <div v-for="mes in cashFlow" :key="mes.label" class="cf-col">
              <div class="cf-stack" :title="`Cobrado: ${formatEur(mes.cobrado)} · Pendiente: ${formatEur(mes.pendiente)} · Vencido: ${formatEur(mes.vencido)}`">
                <div class="cf-bar vencido" :style="{ height: (mes.vencido  / cashFlowMax * 100) + '%' }"></div>
                <div class="cf-bar pendiente" :style="{ height: (mes.pendiente / cashFlowMax * 100) + '%' }"></div>
                <div class="cf-bar cobrado"   :style="{ height: (mes.cobrado  / cashFlowMax * 100) + '%' }"></div>
              </div>
              <span class="cf-label">{{ mes.label }}</span>
              <span class="cf-total">{{ mes.total > 0 ? formatEur(mes.total) : '—' }}</span>
            </div>
          </div>
          <div class="cf-legend">
            <span class="cf-leg-item"><span class="cf-dot cobrado"></span>Cobrado</span>
            <span class="cf-leg-item"><span class="cf-dot pendiente"></span>Pendiente</span>
            <span class="cf-leg-item"><span class="cf-dot vencido"></span>Vencido</span>
          </div>
        </div>
      </DashboardCard>

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- PROYECTOS CON FACTURACIÓN INTEGRADA                                -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <DashboardCard title="Proyectos y Facturación">
        <template #actions>
          <button class="btn-action" @click="openNewPr">+ Nuevo Proyecto</button>
        </template>

        <!-- Filtros -->
        <div class="proyectos-filtros">
          <input v-model="filtroProyectoCliente" class="form-input-sm" placeholder="Buscar por proyecto o cliente..." style="flex:2; min-width:160px;" />
          <input v-model="filtroProyectoFechaDesde" type="date" class="form-input-sm" title="Fecha inicio desde" />
          <input v-model="filtroProyectoFechaHasta" type="date" class="form-input-sm" title="Fecha inicio hasta" />
          <button v-if="filtroProyectoCliente || filtroProyectoFechaDesde || filtroProyectoFechaHasta"
            class="btn-action" @click="filtroProyectoCliente = ''; filtroProyectoFechaDesde = ''; filtroProyectoFechaHasta = ''">
            ✕ Limpiar
          </button>
        </div>
        <p v-if="!filtroProyectoCliente && !filtroProyectoFechaDesde && !filtroProyectoFechaHasta" class="filtro-hint muted">
          Mostrando proyectos del mes actual y con pagos pendientes. Usa el buscador para ver todos.
        </p>

        <div v-if="proyectosFiltrados.length === 0" class="empty-state">
          <span v-if="proyectosConFacturas.length === 0">Sin proyectos. Añade el primero para generar facturas automáticamente.</span>
          <span v-else>Sin proyectos para los filtros seleccionados.</span>
        </div>

        <div v-else class="projects-billing-list">
          <div v-for="p in proyectosFiltrados" :key="p.id" class="project-billing-row">

            <!-- Cabecera del proyecto -->
            <div class="pb-header" @click="toggleExpand(p.id)">
              <div class="pb-info">
                <div class="pb-name-row">
                  <span class="pb-toggle">{{ expandedProjectId === p.id ? '▼' : '▶' }}</span>
                  <span class="pb-name">{{ p.nombre }}</span>
                  <span class="pb-client muted">{{ p.clientes?.nombre ?? '—' }}</span>
                  <span class="plan-badge">{{ PLANES_PAGO[p.plan_pago]?.label ?? p.plan_pago }}</span>
                </div>

                <!-- Barra de progreso de facturación -->
                <div class="billing-progress">
                  <div class="progress-bar-bg">
                    <!-- Segmento naranja: facturado pero no cobrado -->
                    <div class="progress-bar-fill partial"
                      :style="{ width: pctFacturado(p) + '%' }"
                    ></div>
                    <!-- Segmento verde: cobrado -->
                    <div class="progress-bar-fill complete"
                      :style="{ width: pctCobrado(p) + '%' }"
                    ></div>
                  </div>
                  <span class="progress-text">
                    Cobrado: <strong>{{ formatEur(totalCobradoProyecto(p.facturas)) }}</strong>
                    de {{ formatEur(p.presupuesto) }}
                    <span v-if="totalFacturadoProyecto(p.facturas) - totalCobradoProyecto(p.facturas) > 0" class="por-cobrar">
                      · Por cobrar: {{ formatEur(totalFacturadoProyecto(p.facturas) - totalCobradoProyecto(p.facturas)) }}
                    </span>
                    <span v-if="p.presupuesto - totalFacturadoProyecto(p.facturas) > 0" class="por-facturar">
                      · Por facturar: {{ formatEur(p.presupuesto - totalFacturadoProyecto(p.facturas)) }}
                    </span>
                  </span>
                </div>
              </div>

              <div class="pb-meta">
                <span class="badge" :class="{ high: margen(p) >= 50, low: margen(p) < 30 }">
                  Margen {{ margen(p) }}%
                </span>
                <div class="pb-actions" @click.stop>
                  <button class="btn-icon-text" @click="openEditPr(p)" title="Editar proyecto">✏️</button>
                  <button class="btn-icon-text danger" @click="removePr(p)" title="Eliminar">🗑️</button>
                </div>
              </div>
            </div>

            <!-- Facturas + Gastos del proyecto (expandible) -->
            <div v-if="expandedProjectId === p.id" class="pb-facturas">
              <div class="pb-facturas-header">
                <p class="pb-section-label">Facturas</p>
                <button class="btn-add-factura" @click.stop="openNewFacturaForProject(p)">+ Añadir Factura</button>
              </div>
              <div v-if="p.facturas.length === 0" class="empty-state-inline">Sin facturas vinculadas.</div>
              <div v-else class="facturas-grid">
                <div v-for="f in p.facturas" :key="f.id" class="factura-card" :class="f.estado.toLowerCase()">
                  <div class="factura-card-header">
                    <span class="factura-num">{{ f.numero_factura }}</span>
                    <span class="factura-pago-info">Pago {{ f.pago_numero }} de {{ f.pago_total }}</span>
                  </div>
                  <div class="factura-card-concepto">{{ f.concepto }}</div>
                  <div class="factura-card-importe">{{ formatEur(f.importe) }}</div>
                  <div class="factura-card-fecha">
                    Emisión: {{ formatDate(f.fecha_emision) }}
                    <span v-if="f.fecha_vencimiento"> · Vence: {{ formatDate(f.fecha_vencimiento) }}</span>
                    <span v-if="f.fecha_pago" style="color:#4ade80"> · Cobrada: {{ formatDate(f.fecha_pago) }}</span>
                  </div>
                  <div class="factura-card-actions">
                    <select
                      class="estado-select-card"
                      :value="f.estado"
                      :style="{ color: estadoColor[f.estado] }"
                      @change="cambiarEstado(f, ($event.target as HTMLSelectElement).value as Factura['estado'])"
                    >
                      <option>Pendiente</option><option>Pagada</option><option>Vencida</option>
                    </select>
                    <button class="btn-pdf" @click="downloadPDF(f)" :disabled="downloadingPDF" title="Descargar PDF">📄 PDF</button>
                    <button class="btn-edit-card" @click="openEditFactura(f)" title="Editar fechas y datos">✏️</button>
                  </div>
                </div>
              </div>

              <!-- ── Gastos ── -->
              <div class="gastos-section">
                <div class="gastos-header">
                  <p class="pb-section-label">Gastos del Proyecto</p>
                  <button class="btn-add-gasto" @click.stop="gastoFormVisible === p.id ? gastoFormVisible = null : openGastoForm(p.id)">
                    {{ gastoFormVisible === p.id ? '✕ Cancelar' : '+ Añadir Gasto' }}
                  </button>
                </div>

                <!-- Formulario inline de gasto -->
                <div v-if="gastoFormVisible === p.id" class="gasto-form">
                  <input v-model="gastoForm.concepto" class="form-input-sm" placeholder="Concepto (ej. Licencia Canva)" />
                  <input v-model.number="gastoForm.importe" type="number" min="0.01" step="0.01" class="form-input-sm w-100" placeholder="Importe €" />
                  <select v-model="gastoForm.categoria" class="form-input-sm">
                    <option v-for="cat in CATEGORIAS_GASTO" :key="cat" :value="cat">{{ cat }}</option>
                  </select>
                  <input v-model="gastoForm.fecha" type="date" class="form-input-sm" />
                  <button
                    class="btn-save-gasto"
                    @click="saveGasto(p.id)"
                    :disabled="savingGasto || !gastoForm.concepto || gastoForm.importe <= 0"
                  >
                    {{ savingGasto ? '...' : 'Guardar' }}
                  </button>
                </div>

                <!-- Lista de gastos -->
                <div v-if="p.gastos.length === 0 && gastoFormVisible !== p.id" class="empty-state-inline muted">
                  Sin gastos registrados para este proyecto.
                </div>
                <div v-else-if="p.gastos.length > 0" class="gastos-list">
                  <div v-for="g in p.gastos" :key="g.id" class="gasto-row">
                    <span class="gasto-cat-badge">{{ g.categoria }}</span>
                    <span class="gasto-concepto">{{ g.concepto }}</span>
                    <span class="gasto-fecha muted">{{ formatDate(g.fecha) }}</span>
                    <span class="gasto-importe">−{{ formatEur(g.importe) }}</span>
                    <button class="btn-icon-text danger" @click="removeGasto(g)" title="Eliminar">🗑️</button>
                  </div>
                </div>

                <!-- Resumen de rentabilidad real -->
                <div class="rentabilidad-real">
                  <div class="rr-row">
                    <span>Cobrado</span>
                    <span class="rr-val positive">+{{ formatEur(p.cobrado) }}</span>
                  </div>
                  <div class="rr-row">
                    <span>Gastos reales</span>
                    <span class="rr-val negative">−{{ formatEur(p.totalGastos) }}</span>
                  </div>
                  <div class="rr-divider"></div>
                  <div class="rr-row rr-total">
                    <span>Beneficio Neto Real</span>
                    <span class="rr-val" :class="p.beneficioNeto >= 0 ? 'positive' : 'negative'">
                      {{ p.beneficioNeto >= 0 ? '+' : '' }}{{ formatEur(p.beneficioNeto) }}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </DashboardCard>

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- SUSCRIPCIONES / MANTENIMIENTOS                                      -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <DashboardCard title="Suscripciones y Mantenimientos">
        <template #actions>
          <button class="btn-action" @click="openNewSusc">+ Nueva</button>
        </template>
        <div v-if="loadingSusc" class="empty-state">Cargando...</div>
        <div v-else-if="suscripciones.length === 0" class="empty-state">
          Sin suscripciones. Añade mantenimientos o pagos recurrentes.
        </div>
        <div v-else class="susc-list">
          <div v-for="s in suscripciones" :key="s.id" class="susc-row" :class="s.estado">
            <div class="susc-info">
              <div class="susc-name-row">
                <span class="susc-concepto">{{ s.concepto }}</span>
                <span class="susc-badge">{{ FRECUENCIA_LABELS[s.frecuencia] }}</span>
                <span class="susc-estado-pill" :class="s.estado">{{ s.estado }}</span>
              </div>
              <div class="susc-meta">
                <span class="muted">{{ s.clientes?.nombre ?? '—' }}</span>
                <span v-if="s.fecha_ultimo_pago" class="muted">· Último pago: {{ formatDate(s.fecha_ultimo_pago) }}</span>
                <span v-if="s.estado === 'activa'" class="susc-proximo">· Próximo: {{ proximoPago(s) }}</span>
              </div>
            </div>
            <div class="susc-right">
              <span class="susc-importe">{{ formatEur(s.importe) }}</span>
              <button
                v-if="s.estado === 'activa'"
                class="btn-pago"
                @click="registrarPago(s)"
                :disabled="registrandoPago === s.id"
              >{{ registrandoPago === s.id ? '...' : '✓ Registrar pago' }}</button>
              <button class="btn-icon-text" @click="openEditSusc(s)" title="Editar">✏️</button>
              <button class="btn-icon-text danger" @click="removeSusc(s)" title="Eliminar">🗑️</button>
            </div>
          </div>
        </div>
      </DashboardCard>

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- RENTABILIDAD POR CLIENTE                                            -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <DashboardCard title="Rentabilidad por Cliente">
        <div v-if="rentabilidadClientes.length === 0" class="empty-state">
          Sin datos de clientes para mostrar.
        </div>
        <div v-else class="rent-table">
          <div class="rent-header">
            <span>Cliente</span>
            <span class="ta-r">Facturado</span>
            <span class="ta-r">Cobrado</span>
            <span class="ta-r">Pendiente</span>
            <span class="ta-r">Coste</span>
            <span class="ta-r">CAC</span>
            <span class="ta-r">Margen</span>
          </div>
          <div v-for="row in rentabilidadClientes" :key="row.id" class="rent-row">
            <span class="rent-nombre">{{ row.nombre }}</span>
            <span class="ta-r">{{ formatEur(row.facturado) }}</span>
            <span class="ta-r" style="color:#4ade80">{{ formatEur(row.cobrado) }}</span>
            <span class="ta-r" :style="{ color: row.pendiente > 0 ? '#ffa500' : 'inherit' }">{{ formatEur(row.pendiente) }}</span>
            <span class="ta-r muted">{{ formatEur(row.coste) }}</span>
            <span class="ta-r muted">{{ row.cac > 0 ? formatEur(row.cac) : '—' }}</span>
            <span class="ta-r">
              <span class="margen-pill" :class="{ high: row.margen >= 50, mid: row.margen >= 30 && row.margen < 50, low: row.margen < 30 }">
                {{ row.margen }}%
              </span>
            </span>
          </div>
        </div>
      </DashboardCard>

    </template>

    <!-- ── Modal: Nuevo Proyecto ─────────────────────────────────────────────── -->
    <div class="modal-overlay" v-if="showPrModal">
      <div class="modal-box">
        <p class="modal-title">{{ editingPrId ? 'Editar Proyecto' : 'Nuevo Proyecto' }}</p>

        <div class="form-group">
          <label>Nombre del proyecto *</label>
          <input v-model="prForm.nombre" class="form-input" />
        </div>
        <div class="form-group">
          <label>Cliente</label>
          <select v-model="prForm.cliente_id" class="form-input">
            <option value="">— Sin cliente —</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Presupuesto (€)</label>
            <input v-model.number="prForm.presupuesto" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label>Coste estimado (€)</label>
            <input v-model.number="prForm.coste" type="number" min="0" class="form-input" />
          </div>
        </div>

        <div v-if="prForm.presupuesto && prForm.presupuesto > 0" class="margen-preview">
          Margen estimado: <strong>{{ Math.round(((prForm.presupuesto - (prForm.coste ?? 0)) / prForm.presupuesto) * 100) }}%</strong>
        </div>

        <div class="form-group">
          <label>Plan de cobro</label>
          <select v-model="prForm.plan_pago" class="form-input">
            <option v-for="(plan, key) in PLANES_PAGO" :key="key" :value="key">{{ plan.label }}</option>
            <option value="personalizado">✨ Personalizado (importes variables)</option>
          </select>
        </div>

        <!-- Bloque para pagos personalizados -->
        <div v-if="prForm.plan_pago === 'personalizado'" class="custom-plan-manager">
          <p class="section-subtitle">Hitos de pago personalizados</p>
          <div v-for="(pago, i) in prForm.personalizado_pagos" :key="i" class="custom-pago-row">
            <input v-model="pago.etiqueta" placeholder="Concepto (ej. Pago Inicial)" class="form-input flex-2" />
            <div class="importe-input-wrapper">
              <input v-model.number="pago.importe" type="number" step="0.01" placeholder="0.00" class="form-input" />
              <span class="currency-label">€</span>
            </div>
            <button class="btn-icon-text danger" @click="prForm.personalizado_pagos!.splice(i, 1)" title="Eliminar hito">🗑️</button>
          </div>
          <button class="btn-add-pago" @click="prForm.personalizado_pagos!.push({ etiqueta: '', importe: 0 })">
            + Añadir hito de pago
          </button>
          
          <div class="custom-plan-total" :class="{ error: (prForm.personalizado_pagos?.reduce((s, p) => s + p.importe, 0) || 0) !== (prForm.presupuesto || 0) }">
            Total en hitos: <strong>{{ (prForm.personalizado_pagos?.reduce((s, p) => s + p.importe, 0) || 0).toLocaleString('es-ES') }} €</strong>
            / {{ (prForm.presupuesto || 0).toLocaleString('es-ES') }} €
          </div>
        </div>

        <!-- Preview de facturas que se generarán -->
        <div v-if="!editingPrId && prForm.presupuesto && prForm.plan_pago !== 'personalizado'" class="facturas-preview">
          <p class="preview-title">Se crearán automáticamente:</p>
          <div v-for="(pct, i) in PLANES_PAGO[prForm.plan_pago!]?.pagos" :key="i" class="preview-row">
            <span>Factura {{ i + 1 }}</span>
            <span>{{ pct }}%</span>
            <strong>{{ new Intl.NumberFormat('es-ES').format(Math.round((prForm.presupuesto ?? 0) * pct / 100)) }} €</strong>
          </div>
        </div>
        <div v-if="!editingPrId && prForm.plan_pago === 'personalizado' && prForm.personalizado_pagos?.length" class="facturas-preview">
           <p class="preview-title">Se crearán {{ prForm.personalizado_pagos.length }} facturas personalizadas.</p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Fecha inicio</label>
            <input v-model="prForm.fecha_inicio" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label>Fecha fin estimada</label>
            <input v-model="prForm.fecha_fin" type="date" class="form-input" />
          </div>
        </div>

        <p v-if="prError" class="error-msg">⚠️ {{ prError }}</p>
        <div class="modal-actions">
          <button class="btn-text" @click="showPrModal = false">Cancelar</button>
          <button class="btn-primary" @click="savePr" :disabled="savingP || !prForm.nombre">
            {{ savingP ? (generatingInvoices ? 'Generando facturas...' : 'Guardando...') : (editingPrId ? 'Guardar' : 'Crear + Generar Facturas') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Factura manual ─────────────────────────────────────────────── -->
    <div class="modal-overlay" v-if="showFacturaModal">
      <div class="modal-box">
        <p class="modal-title">{{ editingFacturaId ? 'Editar Factura' : 'Nueva Factura Manual' }}</p>
        <div class="form-group">
          <label>Concepto *</label>
          <input v-model="facturaForm.concepto" class="form-input" />
        </div>
        <div class="form-group">
          <label>Cliente</label>
          <select v-model="facturaForm.cliente_id" class="form-input">
            <option value="">— Sin cliente —</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="form-group" v-if="facturaForm.cliente_id && proyectosDelCliente().length > 0">
          <label>Proyecto (opcional)</label>
          <select v-model="facturaForm.proyecto_id" class="form-input">
            <option :value="null">— Sin proyecto —</option>
            <option v-for="p in proyectosDelCliente()" :key="p.id" :value="p.id">{{ p.nombre }}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Base imponible (€) *</label>
            <input v-model.number="facturaForm.importe" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label>IVA</label>
            <select v-model.number="facturaForm.tipo_iva" class="form-input">
              <option v-for="t in TIPOS_IVA" :key="t" :value="t">{{ t }}%{{ t === 21 ? ' (General)' : t === 10 ? ' (Reducido)' : t === 4 ? ' (Superreducido)' : ' (Exento)' }}</option>
            </select>
          </div>
        </div>
        <div v-if="facturaForm.importe" class="iva-preview">
          Base: <strong>{{ new Intl.NumberFormat('es-ES').format(facturaForm.importe) }} €</strong>
          · IVA ({{ facturaForm.tipo_iva }}%): <strong>{{ new Intl.NumberFormat('es-ES').format(Math.round(facturaForm.importe * (facturaForm.tipo_iva ?? 0)) / 100) }} €</strong>
          · Total: <strong class="total-highlight">{{ new Intl.NumberFormat('es-ES').format(facturaForm.importe + Math.round(facturaForm.importe * (facturaForm.tipo_iva ?? 0)) / 100) }} €</strong>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select v-model="facturaForm.estado" class="form-input">
            <option>Pendiente</option><option>Pagada</option><option>Vencida</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fecha emisión</label>
            <input v-model="facturaForm.fecha_emision" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label>Fecha vencimiento</label>
            <input v-model="facturaForm.fecha_vencimiento" type="date" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label>Fecha de cobro <span class="label-hint">(se rellena al marcar como Pagada, o indícala manualmente)</span></label>
          <input v-model="facturaForm.fecha_pago" type="date" class="form-input" />
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showFacturaModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveFactura" :disabled="savingF || !facturaForm.concepto">
            {{ savingF ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Nueva / Editar Suscripción ────────────────────────────────── -->
    <div class="modal-overlay" v-if="showSuscModal">
      <div class="modal-box">
        <p class="modal-title">{{ editingSuscId ? 'Editar Suscripción' : 'Nueva Suscripción' }}</p>
        <div class="form-group">
          <label>Concepto *</label>
          <input v-model="suscForm.concepto" class="form-input" placeholder="Ej: Mantenimiento web mensual" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Cliente</label>
            <select v-model="suscForm.cliente_id" class="form-input">
              <option :value="null">— Sin cliente —</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Proyecto (opcional)</label>
            <select v-model="suscForm.proyecto_id" class="form-input">
              <option :value="null">— Sin proyecto —</option>
              <option v-for="p in proyectos.filter(p => !suscForm.cliente_id || p.cliente_id === suscForm.cliente_id)" :key="p.id" :value="p.id">{{ p.nombre }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Importe (€)</label>
            <input v-model.number="suscForm.importe" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label>IVA</label>
            <select v-model.number="suscForm.tipo_iva" class="form-input">
              <option v-for="t in TIPOS_IVA" :key="t" :value="t">{{ t }}%</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Frecuencia</label>
            <select v-model="suscForm.frecuencia" class="form-input">
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select v-model="suscForm.estado" class="form-input">
              <option value="activa">Activa</option>
              <option value="pausada">Pausada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Fecha inicio</label>
          <input v-model="suscForm.fecha_inicio" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea v-model="suscForm.notas" class="form-input" rows="2" placeholder="Observaciones, accesos, etc."></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showSuscModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveSusc" :disabled="savingSusc || !suscForm.concepto">
            {{ savingSusc ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
.subtitle { color: var(--color-text-muted); font-size: 1.1rem; }
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem 0; }

/* ── Filtro proyectos ───────────────────────────────────────────────────────── */
.proyectos-filtros { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.filtro-hint { font-size: 0.78rem; margin-bottom: 0.75rem; }

/* ── Suscripciones ──────────────────────────────────────────────────────────── */
.susc-list { display: flex; flex-direction: column; gap: 0.5rem; }
.susc-row { display: flex; align-items: center; gap: 1rem; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid var(--color-border); background: rgba(255,255,255,0.02); transition: background 0.15s; }
.susc-row:hover { background: rgba(255,255,255,0.04); }
.susc-row.pausada { opacity: 0.6; }
.susc-row.cancelada { opacity: 0.4; }
.susc-info { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.susc-name-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.susc-concepto { font-weight: 600; font-size: 0.95rem; }
.susc-badge { font-size: 0.72rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 8px; background: rgba(227,255,4,0.1); color: var(--color-primary); border: 1px solid rgba(227,255,4,0.25); }
.susc-estado-pill { font-size: 0.72rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 8px; text-transform: capitalize; }
.susc-estado-pill.activa { background: rgba(74,222,128,0.12); color: #4ade80; }
.susc-estado-pill.pausada { background: rgba(255,165,0,0.12); color: #ffa500; }
.susc-estado-pill.cancelada { background: rgba(255,68,68,0.12); color: #f87171; }
.susc-meta { font-size: 0.82rem; color: var(--color-text-muted); display: flex; gap: 0.4rem; flex-wrap: wrap; }
.susc-proximo { color: #60a5fa; }
.susc-right { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }
.susc-importe { font-size: 1.1rem; font-weight: 700; white-space: nowrap; }
.btn-pago { background: var(--color-primary); color: #000; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.82rem; white-space: nowrap; }
.btn-pago:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-pago:hover:not(:disabled) { opacity: 0.85; }

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 1.5rem; }
.kpi-item { display: flex; flex-direction: column; }
.kpi-label { font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 0.5rem; }
.kpi-value { font-size: 1.8rem; font-weight: 700; margin-right: 0.5rem; }
.kpi-trend { font-size: 0.8rem; font-weight: 600; }
.kpi-value-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.25rem; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }

/* Chart */
.chart-container { height: 220px; display: flex; flex-direction: column; justify-content: flex-end; }
.bars { display: flex; justify-content: space-around; align-items: flex-end; flex: 1; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
.bar-group { display: flex; gap: 4px; align-items: flex-end; height: 100%; position: relative; }
.bar { width: 20px; border-radius: 4px 4px 0 0; }
.bar.prev { background: #333; }
.bar.current { background: var(--color-primary); }
.bar-label { font-size: 0.72rem; color: var(--color-text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
.legend { display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; }
.legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot.prev { background: #333; }
.dot.current { background: var(--color-primary); }

/* Facturas sueltas */
.simple-facturas { display: flex; flex-direction: column; gap: 0.5rem; }
.sf-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.75rem; background: rgba(255,255,255,0.02); border-radius: 6px; gap: 0.5rem; }
.sf-info { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.sf-concepto { font-size: 0.88rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-client { font-size: 0.78rem; }
.sf-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.sf-importe { font-weight: 700; font-size: 0.9rem; white-space: nowrap; }

.btn-action { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.btn-action:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* Proyectos con facturación */
.projects-billing-list { display: flex; flex-direction: column; gap: 1rem; }
.project-billing-row { border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; }

.pb-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 1.25rem; cursor: pointer; background: rgba(255,255,255,0.02); transition: background 0.15s; gap: 1rem; }
.pb-header:hover { background: rgba(255,255,255,0.04); }

.pb-info { display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }
.pb-name-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.pb-toggle { font-size: 0.7rem; color: var(--color-text-muted); }
.pb-name { font-weight: 700; font-size: 1rem; }
.pb-client { font-size: 0.85rem; }
.plan-badge { font-size: 0.75rem; background: rgba(227,255,4,0.1); color: var(--color-primary); border: 1px solid rgba(227,255,4,0.3); padding: 0.15rem 0.5rem; border-radius: 10px; white-space: nowrap; }

.billing-progress { display: flex; flex-direction: column; gap: 0.35rem; }
.progress-bar-bg { position: relative; width: 100%; max-width: 400px; height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { position: absolute; top: 0; left: 0; height: 100%; border-radius: 3px; transition: width 0.4s; }
.progress-bar-fill.complete { background: #4ade80; z-index: 2; }
.progress-bar-fill.partial { background: #ffa500; z-index: 1; }
.progress-text { font-size: 0.82rem; color: var(--color-text-muted); }
.progress-text strong { color: var(--color-text-light); }
.por-facturar { color: #ffa500; }
.por-cobrar { color: #60a5fa; font-weight: 600; }

.pb-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; flex-shrink: 0; }
.pb-actions { display: flex; gap: 0.4rem; }
.badge { padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.8rem; background: #333; }
.badge.high { background: rgba(227,255,4,0.2); color: var(--color-primary); }
.badge.low { background: rgba(255,68,68,0.2); color: #ff4444; }

/* Facturas del proyecto */
.pb-facturas { padding: 1rem 1.25rem; border-top: 1px solid var(--color-border); background: rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 0.75rem; }
.pb-facturas-header { display: flex; align-items: center; justify-content: space-between; }
.pb-section-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--color-text-muted); margin: 0; }
.btn-add-factura { background: transparent; border: 1px dashed var(--color-border); color: var(--color-primary); padding: 0.25rem 0.7rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; transition: all 0.2s; }
.btn-add-factura:hover { background: rgba(227,255,4,0.06); border-color: var(--color-primary); }
.facturas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr)); gap: 0.75rem; }

.factura-card { background: var(--color-bg-lighter); border-radius: 8px; padding: 1rem; border-left: 3px solid #555; display: flex; flex-direction: column; gap: 0.4rem; }
.factura-card.pagada { border-left-color: #4ade80; }
.factura-card.pendiente { border-left-color: #ffa500; }
.factura-card.vencida { border-left-color: #ff4444; }

.factura-card-header { display: flex; justify-content: space-between; align-items: center; }
.factura-num { font-family: monospace; font-size: 0.8rem; color: var(--color-primary); }
.factura-pago-info { font-size: 0.75rem; color: var(--color-text-muted); }
.factura-card-concepto { font-size: 0.85rem; font-weight: 500; line-height: 1.3; }
.factura-card-importe { font-size: 1.3rem; font-weight: 700; }
.factura-card-fecha { font-size: 0.78rem; color: var(--color-text-muted); }
.factura-card-actions { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem; flex-wrap: wrap; }
.btn-edit-card { background: transparent; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.2rem; border-radius: 4px; opacity: 0.6; }
.btn-edit-card:hover { opacity: 1; background: rgba(255,255,255,0.1); }
.label-hint { font-weight: 400; font-size: 0.78rem; color: var(--color-text-muted); }

.estado-select, .estado-select-card { background: transparent; border: 1px solid var(--color-border); border-radius: 10px; padding: 0.2rem 0.5rem; font-size: 0.78rem; font-weight: 700; cursor: pointer; outline: none; color-scheme: dark; flex: 1; }
.btn-pdf { background: rgba(227,255,4,0.1); border: 1px solid rgba(227,255,4,0.3); color: var(--color-primary); padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
.btn-pdf:hover { background: rgba(227,255,4,0.2); }

.empty-state { color: var(--color-text-muted); text-align: center; padding: 2rem; font-style: italic; }
.empty-chart { color: var(--color-text-muted); text-align: center; padding: 2.5rem 1rem; font-style: italic; }
.empty-state-inline { color: var(--color-text-muted); font-style: italic; font-size: 0.9rem; padding: 0.5rem 0; }
.btn-link { background: none; border: none; color: var(--color-primary); cursor: pointer; text-decoration: underline; font-size: inherit; }
.btn-icon-text { background: transparent; border: none; cursor: pointer; font-size: 0.9rem; padding: 0.2rem; border-radius: 4px; }
.btn-icon-text:hover { background: rgba(255,255,255,0.1); }
.btn-icon-text.danger:hover { background: rgba(255,68,68,0.15); }
.muted { color: var(--color-text-muted); }

/* Modals */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; overflow-x: hidden; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
.form-input:focus { border-color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }
.btn-primary { background: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.4rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.error-msg { color: #f87171; font-size: 0.85rem; margin-bottom: 0.5rem; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); padding: 0.6rem 0.9rem; border-radius: 6px; }
.iva-preview { background: rgba(255,255,255,0.04); border: 1px solid var(--color-border); border-radius: 6px; padding: 0.6rem 1rem; font-size: 0.88rem; color: var(--color-text-muted); margin-bottom: 1rem; }
.iva-preview strong { color: var(--color-text-light); }
.total-highlight { color: var(--color-primary) !important; font-size: 1rem; }
.margen-preview { background: rgba(227,255,4,0.08); border: 1px solid rgba(227,255,4,0.2); border-radius: 6px; padding: 0.6rem 1rem; font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 1rem; }
.margen-preview strong { color: var(--color-primary); }

/* Preview facturas automáticas */
.facturas-preview { background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; }
.preview-title { font-size: 0.82rem; color: var(--color-text-muted); margin: 0 0 0.5rem; font-weight: 600; }
.preview-row { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; font-size: 0.88rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
.preview-row:last-child { border: none; }
.preview-row strong { color: var(--color-primary); }

@media (max-width: 768px) {
  .sf-row { flex-direction: column; align-items: flex-start; }
  .sf-right { width: 100%; justify-content: space-between; margin-top: 0.5rem; }
  .pb-header { flex-direction: column; }
  .pb-meta { align-items: flex-start; width: 100%; margin-top: 1rem; }
  .progress-bar-bg { max-width: 100%; }
  .facturas-grid { grid-template-columns: 1fr; }
  .cf-bars { gap: 0.5rem; }
}

/* ── Cash Flow ──────────────────────────────────────────────────────────────── */
.cf-container { display: flex; flex-direction: column; gap: 1rem; }
.cf-bars {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  height: 160px;
  padding-bottom: 0.25rem;
}
.cf-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex: 1;
}
.cf-stack {
  display: flex;
  flex-direction: column-reverse;
  width: 100%;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  cursor: default;
  background: rgba(255,255,255,0.04);
}
.cf-bar { width: 100%; min-height: 0; transition: height 0.4s ease; }
.cf-bar.cobrado   { background: #4ade80; }
.cf-bar.pendiente { background: #ffa500; }
.cf-bar.vencido   { background: #ff4444; }
.cf-label { font-size: 0.75rem; color: var(--color-text-muted); text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cf-total { font-size: 0.72rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cf-legend { display: flex; gap: 1.5rem; }
.cf-leg-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--color-text-muted); }
.cf-dot { width: 10px; height: 10px; border-radius: 50%; }
.cf-dot.cobrado   { background: #4ade80; }
.cf-dot.pendiente { background: #ffa500; }
.cf-dot.vencido   { background: #ff4444; }

/* Rentabilidad por cliente */
.rent-table { display: flex; flex-direction: column; gap: 0; }
.rent-header {
  display: grid;
  grid-template-columns: 1fr repeat(6, 100px);
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.rent-row {
  display: grid;
  grid-template-columns: 1fr repeat(6, 100px);
  gap: 0.5rem;
  padding: 0.65rem 0.5rem;
  font-size: 0.88rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  align-items: center;
}
.rent-row:last-child { border-bottom: none; }
.rent-row:hover { background: rgba(255,255,255,0.03); }
.rent-nombre { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ta-r { text-align: right; }
.margen-pill {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
}
.margen-pill.high { background: rgba(74,222,128,0.15); color: #4ade80; }
.margen-pill.mid  { background: rgba(255,165,0,0.15);  color: #ffa500; }
.margen-pill.low  { background: rgba(255,68,68,0.15);  color: #f87171; }

@media (max-width: 768px) {
  .rent-header, .rent-row { grid-template-columns: 1fr 80px 70px; }
  .rent-header span:nth-child(3),
  .rent-header span:nth-child(4),
  .rent-header span:nth-child(5),
  .rent-row span:nth-child(3),
  .rent-row span:nth-child(4),
  .rent-row span:nth-child(5) { display: none; }
}
/* Plan Personalizado */
.custom-plan-manager { background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
.section-subtitle { font-size: 0.82rem; font-weight: 700; color: var(--color-primary); text-transform: uppercase; margin-bottom: 0.25rem; }
.custom-pago-row { display: flex; gap: 0.5rem; align-items: center; }
.flex-2 { flex: 2; }
.importe-input-wrapper { position: relative; flex: 1; min-width: 100px; }
.currency-label { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); font-size: 0.85rem; }
.btn-add-pago { background: transparent; border: 1px dashed var(--color-border); color: var(--color-primary); padding: 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; width: 100%; transition: all 0.2s; }
.btn-add-pago:hover { background: rgba(227,255,4,0.05); border-color: var(--color-primary); }
.custom-plan-total { font-size: 0.8rem; text-align: right; color: var(--color-text-muted); margin-top: 0.25rem; }
.custom-plan-total.error { color: #f87171; }
.custom-plan-total strong { color: var(--color-text-light); }

/* ── Gastos ───────────────────────────────────────────────────────────────── */
.pb-section-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-muted);
  margin: 0 0 0.6rem;
}
.gastos-section {
  margin-top: 1.5rem;
  border-top: 1px solid var(--color-border);
  padding-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.gastos-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.gastos-header .pb-section-label { margin: 0; }
.btn-add-gasto {
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-primary);
  padding: 0.3rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.2s;
}
.btn-add-gasto:hover { background: rgba(227,255,4,0.05); border-color: var(--color-primary); }

/* Formulario inline */
.gasto-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  background: rgba(0,0,0,0.25);
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}
.form-input-sm {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-light);
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.88rem;
  outline: none;
  color-scheme: dark;
  flex: 1;
  min-width: 120px;
}
.form-input-sm:focus { border-color: var(--color-primary); }
.form-input-sm.w-100 { max-width: 110px; min-width: 90px; flex: none; }
.btn-save-gasto {
  background: var(--color-primary);
  color: #000;
  font-weight: 700;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.88rem;
  white-space: nowrap;
}
.btn-save-gasto:disabled { opacity: 0.5; cursor: not-allowed; }

/* Lista de gastos */
.gastos-list { display: flex; flex-direction: column; gap: 0.3rem; }
.gasto-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255,68,68,0.04);
  border: 1px solid rgba(255,68,68,0.1);
  border-radius: 6px;
  font-size: 0.88rem;
}
.gasto-cat-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  background: rgba(255,165,0,0.12);
  color: #ffa500;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}
.gasto-concepto { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gasto-fecha { font-size: 0.8rem; white-space: nowrap; flex-shrink: 0; }
.gasto-importe { font-weight: 700; color: #f87171; white-space: nowrap; flex-shrink: 0; }

/* Resumen rentabilidad real */
.rentabilidad-real {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rr-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}
.rr-val { font-weight: 700; font-size: 0.95rem; }
.rr-val.positive { color: #4ade80; }
.rr-val.negative { color: #f87171; }
.rr-divider { height: 1px; background: var(--color-border); margin: 0.2rem 0; }
.rr-total { font-size: 1rem; font-weight: 700; color: var(--color-text-light); }
.rr-total .rr-val { font-size: 1.1rem; }

@media (max-width: 600px) {
  .gasto-form { flex-direction: column; }
  .form-input-sm.w-100 { max-width: 100%; }
  .gasto-row { flex-wrap: wrap; }
}
</style>
