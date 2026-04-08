import { ref, computed } from 'vue';
import jsPDF from 'jspdf';
import { supabase } from '../supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type Factura = {
  id: string;
  cliente_id: string | null;
  proyecto_id: string | null;
  numero_factura: string | null;
  concepto: string;
  importe: number;
  tipo_iva: number;
  estado: 'Pagada' | 'Pendiente' | 'Vencida';
  pago_numero: number;
  pago_total: number;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  fecha_pago: string | null;
  clientes?: { nombre: string; cif?: string; direccion_facturacion?: string };
  proyectos_rentabilidad?: { nombre: string };
};

export type ProyectoRentabilidad = {
  id: string;
  nombre: string;
  cliente_id: string | null;
  presupuesto: number;
  coste: number;
  plan_pago: '100' | '50/50' | '40/60' | '33/33/34' | 'personalizado';
  fecha_inicio: string;
  fecha_fin: string | null;
  clientes?: { nombre: string };
  facturas?: Factura[];
};

// ── Datos fiscales de la agencia ──────────────────────────────────────────────
// Actualiza estos valores con los datos reales de Tane Solutions
export const AGENCIA = {
  nombre: 'Tane Solutions S.L.',
  cif: 'B-XXXXXXXX',
  direccion: 'Calle Ejemplo, 1 · 28001 Madrid',
  email: 'info@tanesolutions.com',
  web: 'www.tanesolutions.com',
  iban: 'ES00 0000 0000 00 0000000000',
};

export const TIPOS_IVA = [0, 4, 10, 21] as const;

export const PLANES_PAGO: Record<string, { label: string; pagos: number[] }> = {
  '100': { label: 'Pago único (100%)', pagos: [100] },
  '50/50': { label: '2 pagos iguales (50% + 50%)', pagos: [50, 50] },
  '40/60': { label: '2 pagos (40% inicio + 60% fin)', pagos: [40, 60] },
  '33/33/34': { label: '3 pagos iguales', pagos: [33, 33, 34] },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €';
}

function formatDateEs(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function monthLabel(date: Date): string {
  return date.toLocaleString('es', { month: 'short' });
}

// ── Número de factura automático ──────────────────────────────────────────────
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('facturas')
    .select('id', { count: 'exact', head: true });
  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return `FAC-${year}-${seq}`;
}

// ── Crear facturas automáticas según plan de pago ────────────────────────────
export async function createFacturasFromPlan(
  project: ProyectoRentabilidad,
  clienteId: string | null,
): Promise<Factura[]> {
  const plan = (PLANES_PAGO[project.plan_pago] || PLANES_PAGO['100'])!;
  const creadas: Factura[] = [];

  for (let i = 0; i < plan.pagos.length; i++) {
    const pct = plan.pagos[i]!;
    const importe = Math.round(project.presupuesto * pct / 100);
    const etiqueta = plan.pagos.length === 1
      ? project.nombre
      : `${project.nombre} — Pago ${i + 1} de ${plan.pagos.length} (${pct}%)`;

    const numero = await nextInvoiceNumber();

    const { data, error } = await supabase
      .from('facturas')
      .insert({
        cliente_id: clienteId,
        proyecto_id: project.id,
        numero_factura: numero,
        concepto: etiqueta,
        importe,
        tipo_iva: 21,
        estado: 'Pendiente',
        pago_numero: i + 1,
        pago_total: plan.pagos.length,
        fecha_emision: new Date().toISOString().split('T')[0],
      })
      .select('*')
      .single();

    if (!error && data) {
      creadas.push({
        ...(data as Factura),
        proyectos_rentabilidad: { nombre: project.nombre },
      });
    }
  }

  return creadas;
}

// ── Cargar logo como base64 ───────────────────────────────────────────────────
async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo-verde.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Generar PDF de factura (conforme RD 1619/2012) ───────────────────────────
export async function generateInvoicePDF(
  factura: Factura,
  cliente: { nombre: string; cif?: string; direccion_facturacion?: string } | null,
  proyectoNombre: string,
): Promise<void> {
  const logoBase64 = await loadLogoBase64();

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const ML = 15;   // margin left
  const MR = 195;  // margin right

  const tipoIva = factura.tipo_iva ?? 21;
  const base = factura.importe;
  const cuotaIva = Math.round(base * tipoIva) / 100;
  const total = base + cuotaIva;

  // ── Cabecera verde lima ───────────────────────────────────────────────────
  doc.setFillColor(227, 255, 4);
  doc.rect(0, 0, W, 36, 'F');

  // Logo (26×26 mm, pegado al margen izquierdo)
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', ML, 5, 26, 26);
  }

  // Datos de la agencia desplazados a la derecha del logo
  const TX = logoBase64 ? ML + 30 : ML;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(AGENCIA.nombre.toUpperCase(), TX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`CIF: ${AGENCIA.cif}`, TX, 22);
  doc.text(AGENCIA.direccion, TX, 27);
  doc.text(`${AGENCIA.email}  ·  ${AGENCIA.web}`, TX, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('FACTURA', MR, 24, { align: 'right' });

  // ── Bloque datos factura (derecha) + datos cliente (izquierda) ────────────
  const BLK_Y = 43;

  // Recuadro derecha — datos de la factura
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(128, BLK_Y, 67, 46, 2, 2, 'FD');

  const col2 = 133;
  const addRow = (label: string, value: string, y: number, valueColor?: [number, number, number]) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(label, col2, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    if (valueColor) doc.setTextColor(...valueColor); else doc.setTextColor(0, 0, 0);
    doc.text(value, col2, y + 5);
  };

  addRow('Nº FACTURA', factura.numero_factura ?? '—', BLK_Y + 7);
  addRow('FECHA EMISIÓN', formatDateEs(factura.fecha_emision), BLK_Y + 19);
  if (factura.fecha_vencimiento) {
    addRow('VENCIMIENTO', formatDateEs(factura.fecha_vencimiento), BLK_Y + 31, [200, 50, 50]);
  }

  // Bloque izquierda — datos del cliente
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('FACTURAR A:', ML, BLK_Y + 7);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(cliente?.nombre ?? 'Cliente', ML, BLK_Y + 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  let clienteY = BLK_Y + 20;
  if (cliente?.cif) {
    doc.text(`CIF/NIF: ${cliente.cif}`, ML, clienteY);
    clienteY += 6;
  }
  if (cliente?.direccion_facturacion) {
    const dirLines = doc.splitTextToSize(cliente.direccion_facturacion, 105);
    doc.text(dirLines, ML, clienteY);
    clienteY += dirLines.length * 5;
  }
  if (factura.pago_total > 1) {
    doc.setTextColor(100, 100, 100);
    doc.text(`Pago ${factura.pago_numero} de ${factura.pago_total}`, ML, clienteY + 2);
  }

  // ── Línea separadora ──────────────────────────────────────────────────────
  const SEP_Y = BLK_Y + 52;
  doc.setDrawColor(227, 255, 4);
  doc.setLineWidth(1.5);
  doc.line(ML, SEP_Y, MR, SEP_Y);

  // ── Tabla de conceptos ────────────────────────────────────────────────────
  const TBL_Y = SEP_Y + 5;

  // Cabecera tabla
  doc.setFillColor(25, 25, 25);
  doc.rect(ML, TBL_Y, MR - ML, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CONCEPTO', ML + 4, TBL_Y + 6);
  doc.text('BASE IMPONIBLE', MR - 80, TBL_Y + 6, { align: 'right' });
  doc.text(`IVA (${tipoIva}%)`, MR - 48, TBL_Y + 6, { align: 'right' });
  doc.text('TOTAL', MR - 4, TBL_Y + 6, { align: 'right' });

  // Fila concepto
  const conceptoLines = doc.splitTextToSize(factura.concepto, 100);
  const rowH = Math.max(14, conceptoLines.length * 5 + 6);
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(225, 225, 225);
  doc.rect(ML, TBL_Y + 9, MR - ML, rowH, 'FD');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(conceptoLines, ML + 4, TBL_Y + 9 + rowH / 2 - (conceptoLines.length - 1) * 2.5);
  doc.setFont('helvetica', 'bold');
  doc.text(formatEur(base), MR - 80, TBL_Y + 9 + rowH / 2 + 1, { align: 'right' });
  doc.text(formatEur(cuotaIva), MR - 48, TBL_Y + 9 + rowH / 2 + 1, { align: 'right' });
  doc.text(formatEur(total), MR - 4, TBL_Y + 9 + rowH / 2 + 1, { align: 'right' });

  // Si IVA es 0%, nota de exención
  if (tipoIva === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Operación exenta de IVA (art. 20 LIVA)', ML + 4, TBL_Y + 9 + rowH - 2);
  }

  // ── Bloque de totales ─────────────────────────────────────────────────────
  const TOT_Y = TBL_Y + 9 + rowH + 8;
  const totX1 = MR - 80;
  const totX2 = MR - 4;

  const addTotRow = (label: string, value: string, y: number, highlight = false) => {
    doc.setFont('helvetica', highlight ? 'bold' : 'normal');
    doc.setFontSize(highlight ? 10 : 8.5);
    doc.setTextColor(highlight ? 0 : 80, highlight ? 0 : 80, highlight ? 0 : 80);
    doc.text(label, totX1, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.text(value, totX2, y, { align: 'right' });
  };

  addTotRow('Base imponible:', formatEur(base), TOT_Y);
  if (tipoIva > 0) {
    addTotRow(`IVA (${tipoIva}%):`, formatEur(cuotaIva), TOT_Y + 6);
  }

  // Total destacado
  doc.setFillColor(227, 255, 4);
  doc.rect(MR - 88, TOT_Y + 10, 93, 14, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TOTAL A PAGAR', MR - 84, TOT_Y + 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(formatEur(total), totX2, TOT_Y + 21, { align: 'right' });

  // ── Estado ───────────────────────────────────────────────────────────────
  const estadoColors: Record<string, [number, number, number]> = {
    Pagada: [74, 222, 128], Pendiente: [255, 165, 0], Vencida: [255, 68, 68],
  };
  const [r, g, b] = estadoColors[factura.estado] ?? [150, 150, 150];
  doc.setFillColor(r, g, b);
  doc.roundedRect(ML, TOT_Y + 11, 38, 12, 2, 2, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(factura.estado.toUpperCase(), ML + 19, TOT_Y + 19, { align: 'center' });

  // ── Datos de pago ─────────────────────────────────────────────────────────
  const PAY_Y = TOT_Y + 36;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(ML, PAY_Y, MR, PAY_Y);

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DATOS DE PAGO', ML, PAY_Y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Forma de pago: Transferencia bancaria`, ML, PAY_Y + 12);
  doc.text(`IBAN: ${AGENCIA.iban}`, ML, PAY_Y + 18);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7.5);
  doc.text(`Concepto: ${factura.numero_factura ?? factura.concepto}`, ML, PAY_Y + 24);

  // Si proyecto
  if (proyectoNombre) {
    doc.text(`Proyecto: ${proyectoNombre}`, ML, PAY_Y + 30);
  }

  // ── Pie de página ─────────────────────────────────────────────────────────
  doc.setFillColor(25, 25, 25);
  doc.rect(0, 282, W, 15, 'F');
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${AGENCIA.nombre}  ·  CIF: ${AGENCIA.cif}  ·  ${AGENCIA.direccion}  ·  ${AGENCIA.email}`,
    W / 2, 291,
    { align: 'center' }
  );

  doc.save(`${factura.numero_factura ?? 'factura'}.pdf`);
}

// ── useFinancialData ──────────────────────────────────────────────────────────
export function useFinancialData() {
  const facturas = ref<Factura[]>([]);
  const proyectos = ref<ProyectoRentabilidad[]>([]);
  const loading = ref(true);

  const kpis = computed(() => {
    const now = new Date();
    const mes = now.getMonth();
    const anio = now.getFullYear();

    const esteMes = facturas.value.filter(f => {
      const d = new Date(f.fecha_emision);
      return d.getMonth() === mes && d.getFullYear() === anio;
    });

    const facturacionMensual = esteMes
      .filter(f => f.estado === 'Pagada')
      .reduce((s, f) => s + f.importe, 0);

    const prevMes = facturas.value.filter(f => {
      const d = new Date(f.fecha_emision);
      const pm = mes === 0 ? 11 : mes - 1;
      const pa = mes === 0 ? anio - 1 : anio;
      return d.getMonth() === pm && d.getFullYear() === pa && f.estado === 'Pagada';
    });
    const prevTotal = prevMes.reduce((s, f) => s + f.importe, 0);
    const diff = prevTotal > 0 ? Math.round((facturacionMensual - prevTotal) / prevTotal * 100) : 0;
    const sign = diff >= 0 ? '+' : '';

    const vencidas = facturas.value.filter(f => f.estado === 'Vencida');
    const porCobrar = facturas.value
      .filter(f => f.estado !== 'Pagada')
      .reduce((s, f) => s + f.importe, 0);

    const totalIngr = proyectos.value.reduce((s, p) => s + p.presupuesto, 0);
    const totalCost = proyectos.value.reduce((s, p) => s + p.coste, 0);
    const margen = totalIngr > 0 ? Math.round((totalIngr - totalCost) / totalIngr * 100) : 0;

    return [
      {
        label: 'Facturación Mensual',
        value: formatEur(facturacionMensual),
        trend: prevTotal > 0 ? `${sign}${diff}% vs mes anterior` : '',
        color: '#e3ff04',
      },
      {
        label: 'Por Cobrar',
        value: formatEur(porCobrar),
        trend: vencidas.length > 0 ? `${vencidas.length} vencida(s)` : 'Al día',
        color: vencidas.length > 0 ? '#ff4444' : '#e3ff04',
      },
      {
        label: 'Beneficio Neto Est.',
        value: `${margen}%`,
        trend: `${proyectos.value.length} proyectos`,
        color: margen >= 50 ? '#e3ff04' : margen >= 30 ? '#ffa500' : '#ff4444',
      },
      {
        label: 'Total Cobrado',
        value: formatEur(facturas.value.filter(f => f.estado === 'Pagada').reduce((s, f) => s + f.importe, 0)),
        trend: '',
        color: '#ffffff',
      },
    ];
  });

  const monthlyBilling = computed(() => {
    const now = new Date();
    const values = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const month = monthLabel(d);
      const m = d.getMonth();
      const y = d.getFullYear();
      const current = facturas.value
        .filter(f => f.estado === 'Pagada' && new Date(f.fecha_emision).getMonth() === m && new Date(f.fecha_emision).getFullYear() === y)
        .reduce((s, f) => s + f.importe, 0);
      const prev = facturas.value
        .filter(f => f.estado === 'Pagada' && new Date(f.fecha_emision).getMonth() === m && new Date(f.fecha_emision).getFullYear() === y - 1)
        .reduce((s, f) => s + f.importe, 0);
      return { month, current, prev };
    });
    const max = Math.max(...values.flatMap(v => [v.current, v.prev]), 1);
    return values.map(v => ({
      month: v.month,
      current: Math.round(v.current / max * 100),
      prev: Math.round(v.prev / max * 100),
      currentRaw: v.current,
      prevRaw: v.prev,
    }));
  });

  // Proyectos enriquecidos con sus facturas vinculadas
  const proyectosConFacturas = computed(() =>
    proyectos.value.map(p => ({
      ...p,
      facturas: facturas.value.filter(f => f.proyecto_id === p.id)
        .sort((a, b) => a.pago_numero - b.pago_numero),
    }))
  );

  Promise.all([
    supabase
      .from('facturas')
      .select('*, clientes(nombre, cif, direccion_facturacion), proyectos_rentabilidad(nombre)')
      .order('fecha_emision', { ascending: false }),
    supabase
      .from('proyectos_rentabilidad')
      .select('*, clientes(nombre)')
      .order('fecha_inicio', { ascending: false }),
  ]).then(([facturasRes, proyectosRes]) => {
    facturas.value = (facturasRes.data ?? []) as Factura[];
    proyectos.value = (proyectosRes.data ?? []) as ProyectoRentabilidad[];
  })
    .catch(console.error)
    .finally(() => { loading.value = false; });

  return { facturas, proyectos, proyectosConFacturas, kpis, monthlyBilling, loading };
}

// ── CRUD Facturas ─────────────────────────────────────────────────────────────

function stripFacturaJoins(f: Partial<Factura>): Partial<Factura> {
  const { clientes, proyectos_rentabilidad, ...clean } = f as any;
  return clean;
}

export async function createFactura(form: Partial<Factura>): Promise<Factura> {
  const numero = await nextInvoiceNumber();
  const payload = stripFacturaJoins(form);
  const { data, error } = await supabase
    .from('facturas')
    .insert({ ...payload, numero_factura: payload.numero_factura ?? numero })
    .select('*')
    .single();
  if (error) throw error;
  return data as Factura;
}

export async function updateFactura(id: string, updates: Partial<Factura>): Promise<Factura> {
  const { data, error } = await supabase
    .from('facturas')
    .update(stripFacturaJoins(updates))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Factura;
}

export async function deleteFactura(id: string): Promise<void> {
  const { error } = await supabase.from('facturas').delete().eq('id', id);
  if (error) throw error;
}

// ── CRUD Proyectos rentabilidad ───────────────────────────────────────────────

function stripProyectoJoins(p: Partial<ProyectoRentabilidad>): Partial<ProyectoRentabilidad> {
  const { clientes, facturas, ...clean } = p as any;
  return clean;
}

export async function createProyectoRentabilidad(
  form: Partial<ProyectoRentabilidad>,
): Promise<ProyectoRentabilidad> {
  const { data, error } = await supabase
    .from('proyectos_rentabilidad')
    .insert(stripProyectoJoins(form))
    .select('*')
    .single();
  if (error) throw error;
  return data as ProyectoRentabilidad;
}

export async function updateProyectoRentabilidad(
  id: string,
  updates: Partial<ProyectoRentabilidad>,
): Promise<ProyectoRentabilidad> {
  const { data, error } = await supabase
    .from('proyectos_rentabilidad')
    .update(stripProyectoJoins(updates))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProyectoRentabilidad;
}

export async function deleteProyectoRentabilidad(id: string): Promise<void> {
  const { error } = await supabase.from('proyectos_rentabilidad').delete().eq('id', id);
  if (error) throw error;
}
