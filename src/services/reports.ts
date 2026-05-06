import { ref } from 'vue';
import jsPDF from 'jspdf';
import { supabase } from '../supabase';
import { AGENCIA } from './financial';

// ── Types ────────────────────────────────────────────────────────────────────

export type TipoArchivo = 'pdf' | 'word' | 'excel' | 'imagen' | 'video' | 'zip' | 'otro';

export type ArchivoNas = {
  id: string;
  informe_id: string;
  nombre: string;
  url_nas: string;
  tipo: TipoArchivo;
  descripcion: string | null;
  orden: number;
  created_at: string;
};

export type Informe = {
  id: string;
  cliente_id: string;
  titulo: string;
  descripcion_ejecutiva: string | null;
  resumen_trabajo: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  periodo: string | null;
  proyecto: string | null;
  creado_por: string | null;
  generado_por: string | null;
  url_pdf: string | null;
  storage_path: string | null;
  created_at: string | null;
  creado_en: string | null;
  archivos?: ArchivoNas[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateEs(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo-verde.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useClientReports(clientId: string) {
  const informes = ref<Informe[]>([]);
  const loading  = ref(true);
  const error    = ref<string | null>(null);

  const load = async () => {
    loading.value = true;
    const { data, error: err } = await supabase
      .from('informes')
      .select('*')
      .eq('cliente_id', clientId)
      .order('creado_en', { ascending: false });

    if (err) { error.value = err.message; }
    else {
      informes.value = (data ?? []) as Informe[];
    }
    loading.value = false;
  };

  load();

  // ── CRUD Informes ─────────────────────────────────────────────────────────

  const createInforme = async (form: Partial<Informe>): Promise<Informe | null> => {
    const { data, error: err } = await supabase
      .from('informes')
      .insert({ ...form, cliente_id: clientId })
      .select('*')
      .single();
    if (err || !data) return null;
    const informe: Informe = { ...(data as Informe), archivos: [] };
    informes.value.unshift(informe);
    return informe;
  };

  const updateInforme = async (id: string, updates: Partial<Informe>): Promise<void> => {
    const { error: err } = await supabase
      .from('informes')
      .update(updates)
      .eq('id', id);
    if (!err) {
      const idx = informes.value.findIndex(i => i.id === id);
      if (idx !== -1) Object.assign(informes.value[idx]!, updates);
    }
  };

  const deleteInforme = async (id: string): Promise<void> => {
    const { error: err } = await supabase.from('informes').delete().eq('id', id);
    if (!err) {
      informes.value = informes.value.filter(i => i.id !== id);
    }
  };

  // ── CRUD Archivos NAS ─────────────────────────────────────────────────────

  const addArchivoNas = async (
    informeId: string,
    file: Omit<ArchivoNas, 'id' | 'informe_id' | 'created_at'>,
  ): Promise<ArchivoNas | null> => {
    const { data, error: err } = await supabase
      .from('informe_archivos_nas')
      .insert({ ...file, informe_id: informeId })
      .select('*')
      .single();
    if (err || !data) return null;
    const archivo = data as ArchivoNas;
    const informe = informes.value.find(i => i.id === informeId);
    if (informe) {
      if (!informe.archivos) informe.archivos = [];
      informe.archivos.push(archivo);
      informe.archivos.sort((a, b) => a.orden - b.orden);
    }
    return archivo;
  };

  const deleteArchivoNas = async (informeId: string, archivoId: string): Promise<void> => {
    const { error: err } = await supabase
      .from('informe_archivos_nas')
      .delete()
      .eq('id', archivoId);
    if (!err) {
      const informe = informes.value.find(i => i.id === informeId);
      if (informe?.archivos) {
        informe.archivos = informe.archivos.filter(a => a.id !== archivoId);
      }
    }
  };

  return {
    informes, loading, error,
    createInforme, updateInforme, deleteInforme,
    addArchivoNas, deleteArchivoNas,
  };
}

// ── Generación de PDF ─────────────────────────────────────────────────────────

type ClienteInfo = {
  nombre: string;
  contact?: string;
  industry?: string;
};

export async function generateReportPDF(
  informe: Informe,
  cliente: ClienteInfo | null,
  proyectos: any[],
): Promise<void> {
  const logoBase64 = await loadLogoBase64();

  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const W    = 210;
  const ML   = 15;
  const MR   = 195;
  const LIME: [number, number, number] = [227, 255, 4];
  const DARK: [number, number, number] = [18, 18, 18];

  let y = 0;

  // ── CABECERA VERDE LIMA ───────────────────────────────────────────────────
  doc.setFillColor(...LIME);
  doc.rect(0, 0, W, 44, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', ML, 8, 26, 26);
  }
  const TX = logoBase64 ? ML + 32 : ML;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(AGENCIA.nombre.toUpperCase(), TX, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(AGENCIA.direccion, TX, 27);
  doc.text(`${AGENCIA.email}  ·  ${AGENCIA.web}`, TX, 33);

  // Título derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INFORME DE TRABAJO', MR, 21, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (informe.periodo_inicio || informe.periodo_fin) {
    doc.text(
      `Período: ${formatDateEs(informe.periodo_inicio)} — ${formatDateEs(informe.periodo_fin)}`,
      MR, 30, { align: 'right' },
    );
  }
  doc.setFontSize(7.5);
  doc.text(`Generado: ${formatDateEs(new Date().toISOString())}`, MR, 37, { align: 'right' });

  y = 52;

  // ── BLOQUE CLIENTE / INFORME ──────────────────────────────────────────────
  // Izquierda — datos del cliente
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(ML, y, 88, 34, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 120, 120);
  doc.text('CLIENTE', ML + 5, y + 8);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(cliente?.nombre ?? 'Cliente', ML + 5, y + 18);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  if (cliente?.contact) doc.text(cliente.contact, ML + 5, y + 26);
  if (cliente?.industry) doc.text(cliente.industry, ML + 5, y + 32);

  // Derecha — datos del informe
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(ML + 93, y, 97, 34, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 120, 120);
  doc.text('INFORME', ML + 98, y + 8);
  const tituloLines = doc.splitTextToSize(informe.titulo, 82) as string[];
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(tituloLines[0] ?? informe.titulo, ML + 98, y + 18);
  if (tituloLines[1]) doc.text(tituloLines[1], ML + 98, y + 25);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  if (informe.creado_por) doc.text(`Por: ${informe.creado_por}`, ML + 98, y + 32);

  y += 42;

  // ── LÍNEA SEPARADORA LIMA ─────────────────────────────────────────────────
  doc.setDrawColor(...LIME);
  doc.setLineWidth(1.5);
  doc.line(ML, y, MR, y);
  y += 10;

  // ── Helper: sección con título oscuro ────────────────────────────────────
  const addSection = (title: string, content: string | null) => {
    if (!content?.trim()) return;
    if (y > 255) { doc.addPage(); y = 20; }

    doc.setFillColor(...DARK);
    doc.rect(ML, y, MR - ML, 9, 'F');
    doc.setTextColor(...LIME);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), ML + 4, y + 6);
    y += 13;

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(content, MR - ML) as string[];

    let remaining = [...lines];
    while (remaining.length > 0) {
      const avail = Math.max(1, Math.floor((272 - y) / 5.5));
      const chunk = remaining.splice(0, avail);
      doc.text(chunk, ML, y);
      y += chunk.length * 5.5;
      if (remaining.length > 0) { doc.addPage(); y = 20; }
    }
    y += 8;
  };

  addSection('Resumen Ejecutivo', informe.descripcion_ejecutiva);
  addSection('Trabajo Realizado', informe.resumen_trabajo);

  // ── PROYECTOS ─────────────────────────────────────────────────────────────
  const proysTrimmed = proyectos.slice(0, 12);
  if (proysTrimmed.length > 0) {
    if (y > 248) { doc.addPage(); y = 20; }

    doc.setFillColor(...DARK);
    doc.rect(ML, y, MR - ML, 9, 'F');
    doc.setTextColor(...LIME);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('PROYECTOS ASOCIADOS', ML + 4, y + 6);
    y += 13;

    for (const p of proysTrimmed) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`• ${p.nombre}`, ML + 3, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      const statusLabel = p.fase ? `${p.estado} — Fase: ${p.fase}` : p.estado;
      doc.text(statusLabel, ML + 9, y + 5);
      y += 12;
    }
    y += 4;
  }

  // ── ARCHIVOS NAS ──────────────────────────────────────────────────────────
  const archivos = informe.archivos ?? [];
  if (archivos.length > 0) {
    if (y > 248) { doc.addPage(); y = 20; }

    doc.setFillColor(...DARK);
    doc.rect(ML, y, MR - ML, 9, 'F');
    doc.setTextColor(...LIME);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ARCHIVOS DISPONIBLES PARA DESCARGA', ML + 4, y + 6);
    y += 13;

    for (const a of archivos) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`• ${a.nombre}`, ML + 3, y);
      if (a.descripcion) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(a.descripcion, ML + 9, y + 5);
        y += 5;
      }
      // URL en azul
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 100, 200);
      const urlLines = doc.splitTextToSize(a.url_nas, MR - ML - 10) as string[];
      doc.text(urlLines, ML + 9, y + 5);
      y += urlLines.length * 4.5 + 8;
    }
    y += 2;
  }

  // ── PIE DE PÁGINA (todas las hojas) ──────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);
    doc.setFillColor(...DARK);
    doc.rect(0, 284, W, 13, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LIME);
    doc.text(AGENCIA.nombre, ML, 291.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(170, 170, 170);
    doc.text(AGENCIA.web, MR, 291.5, { align: 'right' });
    doc.text(`Página ${pg} / ${pageCount}`, W / 2, 291.5, { align: 'center' });
  }

  const safeName = (cliente?.nombre ?? 'Cliente').replace(/[^\w]/g, '_');
  const safeTitle = informe.titulo.replace(/[^\w]/g, '_').slice(0, 40);
  doc.save(`Informe_${safeName}_${safeTitle}.pdf`);
}
