<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import {
  useFinancialData,
  createFactura, updateFactura, deleteFactura,
  createProyectoRentabilidad, updateProyectoRentabilidad, deleteProyectoRentabilidad,
  createFacturasFromPlan, generateInvoicePDF,
  PLANES_PAGO, TIPOS_IVA, type Factura, type ProyectoRentabilidad,
} from '../services/financial';
import { useClientsList } from '../services/clients';

const { facturas, proyectos, proyectosConFacturas, kpis, monthlyBilling, loading } = useFinancialData();
const { clients } = useClientsList();

// ── Proyectos: expansión ──────────────────────────────────────────────────────
const expandedProjectId = ref<string | null>(null);
const toggleExpand = (id: string) => {
  expandedProjectId.value = expandedProjectId.value === id ? null : id;
};

const margen = (p: ProyectoRentabilidad) =>
  p.presupuesto > 0 ? Math.round((p.presupuesto - p.coste) / p.presupuesto * 100) : 0;

const totalFacturadoProyecto = (facturasProyecto: Factura[]) =>
  facturasProyecto.reduce((s, f) => s + f.importe, 0);

const totalCobradoProyecto = (facturasProyecto: Factura[]) =>
  facturasProyecto.filter(f => f.estado === 'Pagada').reduce((s, f) => s + f.importe, 0);

const pctFacturado = (p: ProyectoRentabilidad & { facturas: Factura[] }) =>
  p.presupuesto > 0 ? Math.min(100, Math.round(totalFacturadoProyecto(p.facturas) / p.presupuesto * 100)) : 0;

// ── Modal: Nuevo / Editar Proyecto ────────────────────────────────────────────
const showPrModal = ref(false);
const savingP = ref(false);
const editingPrId = ref<string | null>(null);
const generatingInvoices = ref(false);
const prError = ref('');

const emptyPr = (): Partial<ProyectoRentabilidad> => ({
  nombre: '', cliente_id: '', presupuesto: 0, coste: 0, plan_pago: '50/50',
  fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '',
});
const prForm = ref<Partial<ProyectoRentabilidad>>(emptyPr());

const openNewPr = () => { prForm.value = emptyPr(); editingPrId.value = null; prError.value = ''; showPrModal.value = true; };
const openEditPr = (p: ProyectoRentabilidad) => {
  prForm.value = { ...p }; editingPrId.value = p.id; prError.value = ''; showPrModal.value = true;
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

    if (editingPrId.value) {
      const updated = await updateProyectoRentabilidad(editingPrId.value, payload);
      patchProyectoCliente(updated);
      const idx = proyectos.value.findIndex(p => p.id === editingPrId.value);
      if (idx !== -1) proyectos.value[idx] = updated;
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
  await deleteProyectoRentabilidad(p.id);
  proyectos.value = proyectos.value.filter(x => x.id !== p.id);
  facturas.value = facturas.value.filter(f => f.proyecto_id !== p.id);
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
  } finally { savingF.value = false; }
};

const removeFactura = async (f: Factura) => {
  if (!confirm(`¿Eliminar factura "${f.concepto}"?`)) return;
  await deleteFactura(f.id);
  facturas.value = facturas.value.filter(x => x.id !== f.id);
};

// ── Cambio rápido de estado ───────────────────────────────────────────────────
const cambiarEstado = async (f: Factura, estado: Factura['estado']) => {
  const updates: Partial<Factura> = { estado };
  if (estado === 'Pagada') updates.fecha_pago = new Date().toISOString().split('T')[0];
  const updated = await updateFactura(f.id, updates);
  // Preserve join data since updateFactura no longer returns nested objects
  updated.clientes = f.clientes;
  updated.proyectos_rentabilidad = f.proyectos_rentabilidad;
  const idx = facturas.value.findIndex(x => x.id === f.id);
  if (idx !== -1) facturas.value[idx] = updated;
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
  } finally {
    downloadingPDF.value = false;
  }
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
          <div v-if="facturas.length === 0" class="empty-chart">Añade proyectos para ver la gráfica</div>
          <div v-else class="chart-container">
            <div class="bars">
              <div v-for="item in monthlyBilling" :key="item.month" class="bar-group">
                <div class="bar prev" :style="{ height: (item.prev || 2) + '%' }" :title="`Año ant: ${item.prevRaw?.toLocaleString('es-ES')} €`"></div>
                <div class="bar current" :style="{ height: (item.current || 2) + '%' }" :title="`Este año: ${item.currentRaw?.toLocaleString('es-ES')} €`"></div>
                <span class="bar-label">{{ item.month }}</span>
              </div>
            </div>
            <div class="legend">
              <span class="legend-item"><span class="dot prev"></span>Año anterior</span>
              <span class="legend-item"><span class="dot current"></span>Año actual</span>
            </div>
          </div>
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

        <div v-if="proyectosConFacturas.length === 0" class="empty-state">
          Sin proyectos. Añade el primero para generar facturas automáticamente.
        </div>

        <div v-else class="projects-billing-list">
          <div v-for="p in proyectosConFacturas" :key="p.id" class="project-billing-row">

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
                    <div
                      class="progress-bar-fill"
                      :style="{ width: pctFacturado(p) + '%' }"
                      :class="{ complete: pctFacturado(p) >= 100 }"
                    ></div>
                  </div>
                  <span class="progress-text">
                    Facturado: <strong>{{ formatEur(totalFacturadoProyecto(p.facturas)) }}</strong>
                    de {{ formatEur(p.presupuesto) }}
                    <span class="muted">(cobrado: {{ formatEur(totalCobradoProyecto(p.facturas)) }})</span>
                    <span v-if="p.presupuesto - totalFacturadoProyecto(p.facturas) > 0" class="por-facturar">
                      · Queda por facturar: {{ formatEur(p.presupuesto - totalFacturadoProyecto(p.facturas)) }}
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

            <!-- Facturas del proyecto (expandible) -->
            <div v-if="expandedProjectId === p.id" class="pb-facturas">
              <div v-if="p.facturas.length === 0" class="empty-state-inline">
                Sin facturas vinculadas.
                <button class="btn-link" @click="openNewFactura">Añadir manualmente</button>
              </div>
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
            </div>

          </div>
        </div>
      </DashboardCard>

    </template>

    <!-- ── Modal: Nuevo Proyecto ─────────────────────────────────────────────── -->
    <div class="modal-overlay" v-if="showPrModal" @click.self="showPrModal = false">
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
          </select>
        </div>

        <!-- Preview de facturas que se generarán -->
        <div v-if="!editingPrId && prForm.presupuesto && prForm.plan_pago" class="facturas-preview">
          <p class="preview-title">Se crearán automáticamente:</p>
          <div v-for="(pct, i) in PLANES_PAGO[prForm.plan_pago!]?.pagos" :key="i" class="preview-row">
            <span>Factura {{ i + 1 }}</span>
            <span>{{ pct }}%</span>
            <strong>{{ new Intl.NumberFormat('es-ES').format(Math.round((prForm.presupuesto ?? 0) * pct / 100)) }} €</strong>
          </div>
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
    <div class="modal-overlay" v-if="showFacturaModal" @click.self="showFacturaModal = false">
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

  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
.subtitle { color: var(--color-text-muted); font-size: 1.1rem; }
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem 0; }

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
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
.bar-label { position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); font-size: 0.78rem; color: var(--color-text-muted); white-space: nowrap; }
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
.progress-bar-bg { width: 100%; max-width: 400px; height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: var(--color-primary); border-radius: 3px; transition: width 0.4s; }
.progress-bar-fill.complete { background: #4ade80; }
.progress-text { font-size: 0.82rem; color: var(--color-text-muted); }
.progress-text strong { color: var(--color-text-light); }
.por-facturar { color: #ffa500; }

.pb-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; flex-shrink: 0; }
.pb-actions { display: flex; gap: 0.4rem; }
.badge { padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.8rem; background: #333; }
.badge.high { background: rgba(227,255,4,0.2); color: var(--color-primary); }
.badge.low { background: rgba(255,68,68,0.2); color: #ff4444; }

/* Facturas del proyecto */
.pb-facturas { padding: 1rem 1.25rem; border-top: 1px solid var(--color-border); background: rgba(0,0,0,0.15); }
.facturas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }

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
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
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
.cf-label { font-size: 0.75rem; color: var(--color-text-muted); text-transform: capitalize; }
.cf-total { font-size: 0.72rem; color: var(--color-text-muted); }
.cf-legend { display: flex; gap: 1.5rem; }
.cf-leg-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--color-text-muted); }
.cf-dot { width: 10px; height: 10px; border-radius: 50%; }
.cf-dot.cobrado   { background: #4ade80; }
.cf-dot.pendiente { background: #ffa500; }
.cf-dot.vencido   { background: #ff4444; }
</style>
