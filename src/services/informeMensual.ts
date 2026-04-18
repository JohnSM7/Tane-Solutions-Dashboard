import jsPDF from 'jspdf';

type ClienteData = {
  name: string;
  industry: string;
  contact: string;
};

type Sede = {
  nombre: string;
  gmb_rating: number;
  gmb_reviews: number;
  gmb_unanswered: number;
};

type Proyecto = {
  nombre: string;
  estado: string;
  fecha_entrega_estimada?: string;
};

type Factura = {
  concepto: string;
  importe: number;
  estado: string;
  fecha_emision: string;
};

type Ticket = {
  asunto: string;
  estado: string;
  prioridad: string;
  fecha_creacion: string;
};

type InformeData = {
  cliente: ClienteData;
  sedes: Sede[];
  proyectos: Proyecto[];
  facturas: Factura[];
  tickets: Ticket[];
  periodo: string;
};

type RGB = [number, number, number];
const PRIMARY: RGB  = [227, 255, 4];
const BG_DARK: RGB  = [15,  15,  15];
const BG_CARD: RGB  = [26,  26,  26];
const TEXT_W:  RGB  = [229, 229, 229];
const TEXT_M:  RGB  = [102, 102, 102];
const _BORDER:  RGB  = [42,  42,  42]; void _BORDER;

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const setFill  = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const setColor = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw  = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]); void setDraw;

export function generarInformeMensualPDF(data: InformeData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const PH = 297;
  const ML = 16;
  const MR = 16;
  const CW = PW - ML - MR;
  let y = 0;

  // ── Header strip ────────────────────────────────────────────────────────────
  setFill(doc, PRIMARY);
  doc.rect(0, 0, PW, 22, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TANE SOLUTIONS', ML, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Informe mensual de cliente', PW - MR, 14, { align: 'right' });

  // ── Background ───────────────────────────────────────────────────────────────
  setFill(doc, BG_DARK);
  doc.rect(0, 22, PW, PH - 22, 'F');

  y = 36;

  // ── Client info ──────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  setColor(doc, TEXT_W);
  doc.text(data.cliente.name, ML, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  setColor(doc, TEXT_M);
  doc.text(`${data.cliente.industry}  ·  ${data.cliente.contact}  ·  Período: ${data.periodo}`, ML, y);
  y += 10;

  // ── Helper: section title ───────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    setFill(doc, BG_CARD);
    doc.roundedRect(ML, y, CW, 8, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setColor(doc, PRIMARY);
    doc.text(title.toUpperCase(), ML + 4, y + 5.5);
    y += 13;
  };

  const row = (label: string, value: string, valueColor?: RGB) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    setColor(doc, TEXT_M);
    doc.text(label, ML + 4, y);
    setColor(doc, (valueColor ?? TEXT_W));
    doc.text(value, ML + CW - 4, y, { align: 'right' });
    y += 6;
  };

  const checkPageBreak = (needed = 20) => {
    if (y + needed > PH - 16) {
      doc.addPage();
      setFill(doc, BG_DARK);
      doc.rect(0, 0, PW, PH, 'F');
      y = 16;
    }
  };

  // ── 1. KPIs rápidos ──────────────────────────────────────────────────────────
  const facturadoMes = data.facturas.reduce((s, f) => s + f.importe, 0);
  const cobradoMes   = data.facturas.filter(f => f.estado === 'Pagada').reduce((s, f) => s + f.importe, 0);
  const pendiente    = facturadoMes - cobradoMes;
  const ticketsAbiertos = data.tickets.filter(t => t.estado !== 'Cerrado').length;
  const proyActivosCnt  = data.proyectos.filter(p => p.estado !== 'Completado').length;

  const kpis = [
    { label: 'Facturado',         value: fmtEur(facturadoMes),    color: PRIMARY as RGB },
    { label: 'Cobrado',           value: fmtEur(cobradoMes),      color: [74, 222, 128] as RGB },
    { label: 'Pendiente',         value: fmtEur(pendiente),        color: (pendiente > 0 ? [255, 165, 0] : [74, 222, 128]) as RGB },
    { label: 'Proyectos activos', value: String(proyActivosCnt),   color: TEXT_W as RGB },
    { label: 'Tickets abiertos',  value: String(ticketsAbiertos),  color: (ticketsAbiertos > 0 ? [255, 165, 0] : [74, 222, 128]) as RGB },
  ];

  const kpiW = CW / kpis.length;
  kpis.forEach((kpi, i) => {
    const kx = ML + i * kpiW;
    setFill(doc, BG_CARD);
    doc.roundedRect(kx, y, kpiW - 2, 18, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(doc, TEXT_M);
    doc.text(kpi.label, kx + kpiW / 2 - 1, y + 5.5, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    setColor(doc, kpi.color);
    doc.text(kpi.value, kx + kpiW / 2 - 1, y + 13, { align: 'center' });
  });
  y += 24;

  // ── 2. Google My Business ───────────────────────────────────────────────────
  if (data.sedes.length > 0) {
    checkPageBreak(10 + data.sedes.length * 8);
    sectionTitle('Google My Business');
    for (const s of data.sedes) {
      row(s.nombre, `⭐ ${s.gmb_rating}  ·  ${s.gmb_reviews} reseñas  ·  ${s.gmb_unanswered} sin responder`);
    }
    y += 4;
  }

  // ── 3. Proyectos ─────────────────────────────────────────────────────────────
  if (data.proyectos.length > 0) {
    checkPageBreak(10 + data.proyectos.length * 7);
    sectionTitle('Proyectos');
    for (const p of data.proyectos) {
      const estadoColor: Record<string, RGB> = {
        'En curso': [74, 222, 128], 'Completado': [74, 222, 128],
        'En riesgo': [255, 165, 0], 'Retrasado': [255, 68, 68], 'Bloqueado': [255, 68, 68],
      };
      row(
        p.nombre,
        `${p.estado}${p.fecha_entrega_estimada ? '  ·  ' + fmtDate(p.fecha_entrega_estimada) : ''}`,
        estadoColor[p.estado] ?? TEXT_W,
      );
    }
    y += 4;
  }

  // ── 4. Facturas ───────────────────────────────────────────────────────────────
  if (data.facturas.length > 0) {
    checkPageBreak(10 + data.facturas.length * 7);
    sectionTitle('Facturas del período');
    for (const f of data.facturas) {
      const estadoColor: Record<string, RGB> = {
        'Pagada': [74, 222, 128], 'Pendiente': [255, 165, 0], 'Vencida': [255, 68, 68],
      };
      row(`${f.concepto} (${fmtDate(f.fecha_emision)})`, `${fmtEur(f.importe)}  ${f.estado}`, estadoColor[f.estado]);
    }
    y += 4;
  }

  // ── 5. Tickets ───────────────────────────────────────────────────────────────
  if (data.tickets.length > 0) {
    checkPageBreak(10 + data.tickets.length * 7);
    sectionTitle('Soporte');
    for (const t of data.tickets) {
      const prioColor: Record<string, RGB> = {
        'Alta': [255, 68, 68], 'Media': [255, 165, 0], 'Baja': [74, 222, 128],
      };
      row(t.asunto, `${t.estado}  ·  ${t.prioridad}`, prioColor[t.prioridad]);
    }
    y += 4;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(doc, TEXT_M);
    doc.text(
      `Tane Solutions  ·  Generado el ${new Date().toLocaleDateString('es-ES')}  ·  Pág. ${i}/${totalPages}`,
      PW / 2, PH - 6, { align: 'center' }
    );
  }

  const filename = `informe-${data.cliente.name.toLowerCase().replace(/\s+/g, '-')}-${data.periodo}.pdf`;
  doc.save(filename);
}
