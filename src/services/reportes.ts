import jsPDF from 'jspdf';
import { AGENCIA } from './financial';
import { supabase } from '../supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TareaInforme = {
  titulo: string;
  descripcion?: string;
  horas?: number;
  estado?: 'Completada' | 'En progreso' | 'Pendiente';
  fecha?: string;
  categoria?: string;
};

export type ArchivoNAS = {
  nombre: string;
  descripcion?: string;
  url: string;
  tipo?: 'pdf' | 'image' | 'video' | 'zip' | 'doc' | 'other';
  tamanio?: number;
};

export type ImagenAdjunta = {
  base64: string;   // dataURL completo "data:image/...;base64,..."
  nombre: string;
};

export type InformeProyecto = {
  clienteNombre: string;
  clienteLogo?: string;
  clienteCif?: string;

  tituloInforme: string;
  proyectoNombre: string;
  descripcionGeneral?: string;
  objetivos?: string[];
  resumenEjecutivo?: string;
  periodo?: string;
  conclusiones?: string;
  proximosPasos?: string[];

  kpis?: { label: string; value: string }[];
  tareas?: TareaInforme[];
  archivosNas?: ArchivoNAS[];
  imagenesAdjuntas?: ImagenAdjunta[];
  fechaGeneracion?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
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

// ── Colores ───────────────────────────────────────────────────────────────────
type C3 = [number, number, number];
const LIME:  C3 = [227, 255, 4];
const BLACK: C3 = [0, 0, 0];
const DARK:  C3 = [18, 18, 18];
const GRAY:  C3 = [100, 100, 100];
const DGRAY: C3 = [50, 50, 50];

const WHITE: C3 = [255, 255, 255];

// ── Helpers de layout ─────────────────────────────────────────────────────────
const W = 210, H = 297, ML = 18, MR = 192, CW = MR - ML;

function footer(doc: jsPDF, pageNum: number, totalPages: number) {
  doc.setFillColor(...DARK);
  doc.rect(0, H - 12, W, 12, 'F');
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${AGENCIA.nombre}  ·  ${AGENCIA.email}  ·  ${AGENCIA.web}`, W / 2, H - 5, { align: 'center' });
  doc.text(`${pageNum} / ${totalPages}`, MR, H - 5, { align: 'right' });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  // Línea accent
  doc.setDrawColor(...LIME);
  doc.setLineWidth(2);
  doc.line(ML, y, ML + 40, y);
  doc.setLineWidth(0.4);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(title.toUpperCase(), ML, y);
  return y + 8;
}

function needsPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > H - 20) { doc.addPage(); return 22; }
  return y;
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERADOR DE INFORME PDF PROFESIONAL
// ══════════════════════════════════════════════════════════════════════════════

export async function generateReportePDF(informe: InformeProyecto): Promise<{ blob: Blob; filename: string; doc: jsPDF }> {
  const logoBase64 = await loadImageBase64('/logo-verde.png');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const fecha = informe.fechaGeneracion ?? new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — PORTADA
  // ═══════════════════════════════════════════════════════════════════════════

  // Fondo negro completo
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, H, 'F');

  // Banda decorativa lime en la parte superior
  doc.setFillColor(...LIME);
  doc.rect(0, 0, W, 6, 'F');

  // Logo Tane grande centrado
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', W / 2 - 20, 35, 40, 40);
  }

  // Nombre agencia
  doc.setTextColor(...LIME);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(AGENCIA.nombre.toUpperCase(), W / 2, 85, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(`${AGENCIA.email}  ·  ${AGENCIA.web}`, W / 2, 92, { align: 'center' });

  // Línea lime ancha decorativa
  doc.setDrawColor(...LIME);
  doc.setLineWidth(2);
  doc.line(50, 105, W - 50, 105);
  doc.setLineWidth(0.4);

  // Etiqueta "INFORME DE TRABAJO"
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('INFORME DE TRABAJO', W / 2, 120, { align: 'center' });

  // Título del informe
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(informe.tituloInforme, 150);
  doc.text(titleLines, W / 2, 135, { align: 'center' });

  // Nombre del proyecto
  const tY = 135 + titleLines.length * 12;
  doc.setTextColor(...LIME);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(informe.proyectoNombre, W / 2, tY, { align: 'center' });

  // Bloque cliente en la parte inferior
  const boxY = H - 70;
  doc.setFillColor(30, 30, 30);
  doc.roundedRect(35, boxY, W - 70, 40, 3, 3, 'F');

  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PREPARADO PARA', W / 2, boxY + 10, { align: 'center' });

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(informe.clienteNombre, W / 2, boxY + 22, { align: 'center' });

  if (informe.clienteCif) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`CIF: ${informe.clienteCif}`, W / 2, boxY + 29, { align: 'center' });
  }

  // Fecha y período en la parte más baja
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const infoParts = [fecha];
  if (informe.periodo) infoParts.push(`Período: ${informe.periodo}`);
  doc.text(infoParts.join('  ·  '), W / 2, H - 22, { align: 'center' });

  // Banda lime inferior
  doc.setFillColor(...LIME);
  doc.rect(0, H - 6, W, 6, 'F');

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — DESCRIPCIÓN Y OBJETIVOS
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  let y = 22;

  // Descripción
  if (informe.descripcionGeneral) {
    y = sectionTitle(doc, 'Descripción del Proyecto', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...DGRAY);
    const lines = doc.splitTextToSize(informe.descripcionGeneral, CW);
    doc.text(lines, ML, y);
    y += lines.length * 5.5 + 8;
  }

  // Objetivos
  if (informe.objetivos && informe.objetivos.length > 0) {
    y = needsPage(doc, y, 40);
    y = sectionTitle(doc, 'Objetivos', y);

    informe.objetivos.forEach((obj) => {
      y = needsPage(doc, y, 12);
      // Bullet lime
      doc.setFillColor(...LIME);
      doc.circle(ML + 3, y - 1.5, 1.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...DGRAY);
      const oLines = doc.splitTextToSize(obj, CW - 12);
      doc.text(oLines, ML + 9, y);
      y += oLines.length * 5 + 4;
    });
    y += 4;
  }

  // Resumen ejecutivo
  if (informe.resumenEjecutivo) {
    y = needsPage(doc, y, 50);
    y = sectionTitle(doc, 'Resumen Ejecutivo', y);

    // Caja destacada
    doc.setFillColor(248, 255, 220);
    const resLines = doc.splitTextToSize(informe.resumenEjecutivo, CW - 14);
    const resH = resLines.length * 5 + 12;
    doc.roundedRect(ML, y, CW, resH, 2, 2, 'F');
    doc.setDrawColor(...LIME);
    doc.setLineWidth(3);
    doc.line(ML, y, ML, y + resH);
    doc.setLineWidth(0.4);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...DGRAY);
    doc.text(resLines, ML + 8, y + 8);
    y += resH + 8;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 3+ — TRABAJOS REALIZADOS Y KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  // KPIs
  if (informe.kpis && informe.kpis.length > 0) {
    y = needsPage(doc, y, 45);
    y = sectionTitle(doc, 'Resultados y Métricas', y);

    const count = Math.min(informe.kpis.length, 4);
    const gap = 4;
    const kpiW = (CW - gap * (count - 1)) / count;

    informe.kpis.slice(0, 4).forEach((kpi, i) => {
      const kx = ML + i * (kpiW + gap);
      doc.setFillColor(...DARK);
      doc.roundedRect(kx, y, kpiW, 28, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...LIME);
      doc.text(kpi.value, kx + kpiW / 2, y + 14, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...WHITE);
      const lbl = doc.splitTextToSize(kpi.label, kpiW - 6);
      doc.text(lbl, kx + kpiW / 2, y + 22, { align: 'center' });
    });
    y += 36;

    // Segunda fila
    if (informe.kpis.length > 4) {
      const extra = informe.kpis.slice(4, 8);
      const c2 = Math.min(extra.length, 4);
      const kw2 = (CW - gap * (c2 - 1)) / c2;
      extra.forEach((kpi, i) => {
        const kx = ML + i * (kw2 + gap);
        doc.setFillColor(...DARK);
        doc.roundedRect(kx, y, kw2, 28, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...LIME);
        doc.text(kpi.value, kx + kw2 / 2, y + 14, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...WHITE);
        doc.text(doc.splitTextToSize(kpi.label, kw2 - 6), kx + kw2 / 2, y + 22, { align: 'center' });
      });
      y += 36;
    }
  }

  // Tareas realizadas — siempre en página nueva
  if (informe.tareas && informe.tareas.length > 0) {
    doc.addPage();
    y = 22;
    y = sectionTitle(doc, 'Trabajos Realizados', y);

    const estadoColors: Record<string, C3> = {
      'Completada': [74, 222, 128], 'En progreso': [255, 165, 0], 'Pendiente': [180, 180, 180],
    };

    informe.tareas.forEach((tarea, idx) => {
      const tLines = doc.splitTextToSize(tarea.titulo, 105);
      const dLines = tarea.descripcion ? doc.splitTextToSize(tarea.descripcion, 105) : [];
      const rowH = Math.max(14, (tLines.length + dLines.length) * 5 + 8);
      y = needsPage(doc, y, rowH);

      // Fondo alterno
      if (idx % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(ML, y, CW, rowH, 'F'); }

      // Línea izquierda coloreada
      const ec = estadoColors[tarea.estado ?? 'Completada'] ?? [150, 150, 150];
      doc.setFillColor(...ec);
      doc.rect(ML, y, 3, rowH, 'F');

      // Título
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK);
      doc.text(tLines, ML + 6, y + 6);

      // Desc
      if (dLines.length) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text(dLines, ML + 6, y + 6 + tLines.length * 5 + 1);
      }

      // Categoría
      if (tarea.categoria) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...LIME);
        doc.text(tarea.categoria.toUpperCase(), ML + 6, y + rowH - 3);
      }

      // Estado badge
      doc.setFillColor(...ec);
      doc.roundedRect(MR - 42, y + 3, 26, 7, 1, 1, 'F');
      doc.setTextColor(idx % 2 === 0 ? 255 : 0, idx % 2 === 0 ? 255 : 0, idx % 2 === 0 ? 255 : 0);
      doc.setTextColor(...BLACK);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
      doc.text((tarea.estado ?? 'Completada').toUpperCase(), MR - 29, y + 8, { align: 'center' });

      // Horas
      if (tarea.horas) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK);
        doc.text(`${tarea.horas}h`, MR - 4, y + 8, { align: 'right' });
      }

      y += rowH + 1;
    });

    // Total horas
    const totalH = informe.tareas.reduce((s, t) => s + (t.horas ?? 0), 0);
    if (totalH > 0) {
      doc.setFillColor(...DARK); doc.roundedRect(MR - 55, y, 55, 12, 2, 2, 'F');
      doc.setTextColor(...LIME); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(`Total: ${totalH} horas`, MR - 4, y + 8, { align: 'right' });
      y += 18;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA — IMÁGENES DE APOYO / MOCKUPS
  // ═══════════════════════════════════════════════════════════════════════════
  if (informe.imagenesAdjuntas && informe.imagenesAdjuntas.length > 0) {
    doc.addPage();
    y = 22;
    y = sectionTitle(doc, 'Material Visual y Evidencias', y);

    for (let i = 0; i < informe.imagenesAdjuntas.length; i++) {
      const img = informe.imagenesAdjuntas[i]!;
      y = needsPage(doc, y, 100);

      try {
        // Calcular dimensiones manteniendo aspect ratio max 170x90mm
        const maxW = 170, maxH = 90;
        doc.addImage(img.base64, 'JPEG', ML, y, maxW, maxH, undefined, 'FAST');
        y += maxH + 3;
      } catch {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text(`[No se pudo insertar: ${img.nombre}]`, ML, y + 5);
        y += 10;
      }

      // Pie de imagen
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
      doc.text(img.nombre, ML, y);
      y += 10;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA FINAL — CONCLUSIONES Y PRÓXIMOS PASOS
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 22;

  // Conclusiones
  if (informe.conclusiones) {
    y = sectionTitle(doc, 'Conclusiones', y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DGRAY);
    const cLines = doc.splitTextToSize(informe.conclusiones, CW);
    doc.text(cLines, ML, y);
    y += cLines.length * 5.5 + 10;
  }

  // Próximos pasos
  if (informe.proximosPasos && informe.proximosPasos.length > 0) {
    y = needsPage(doc, y, 40);
    y = sectionTitle(doc, 'Próximos Pasos', y);

    informe.proximosPasos.forEach((paso, i) => {
      y = needsPage(doc, y, 14);
      // Número en círculo lime
      doc.setFillColor(...LIME);
      doc.circle(ML + 4, y - 1, 4, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLACK);
      doc.text(`${i + 1}`, ML + 4, y + 0.5, { align: 'center' });

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...DGRAY);
      const pLines = doc.splitTextToSize(paso, CW - 16);
      doc.text(pLines, ML + 12, y);
      y += pLines.length * 5 + 5;
    });
    y += 6;
  }

  // Bloque de cierre / contacto
  y = needsPage(doc, y, 60);
  doc.setFillColor(...DARK);
  doc.roundedRect(ML, y, CW, 50, 3, 3, 'F');

  doc.setTextColor(...LIME); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('¿Hablamos?', W / 2, y + 15, { align: 'center' });

  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Estamos a tu disposición para cualquier consulta sobre este informe', W / 2, y + 24, { align: 'center' });
  doc.text('o para planificar los próximos pasos juntos.', W / 2, y + 30, { align: 'center' });

  doc.setTextColor(...LIME); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(AGENCIA.email, W / 2, y + 40, { align: 'center' });

  doc.setTextColor(150, 150, 150); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(AGENCIA.web, W / 2, y + 46, { align: 'center' });

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTERS en todas las páginas
  // ═══════════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) footer(doc, i - 1, totalPages - 1); // la portada no lleva footer/número
  }

  // Guardar como blob
  const safeName = informe.proyectoNombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `informe_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;
  const blob = doc.output('blob');
  return { blob, filename, doc };
}

// ── Descargar directamente (modo rápido sin guardar en DB) ────────────────────
export async function descargarReportePDF(informe: InformeProyecto): Promise<void> {
  const { blob, filename } = await generateReportePDF(informe);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Persistir en Supabase (Storage + tabla informes) ──────────────────────────

export type InformeGuardado = {
  id: string;
  cliente_id: string;
  titulo: string;
  proyecto: string;
  periodo: string;
  url_pdf: string;
  storage_path: string;
  generado_por: string;
  creado_en: string;
};

export async function guardarInforme(
  informe: InformeProyecto,
  clienteId: string,
  generadoPor: string = 'admin'
): Promise<InformeGuardado> {
  // 1. Generar el PDF
  const { blob, filename } = await generateReportePDF(informe);

  // 2. Subir al bucket "informes"
  const storagePath = `${clienteId}/${Date.now()}_${filename}`;
  const { error: uploadError } = await supabase.storage
    .from('informes')
    .upload(storagePath, blob, { contentType: 'application/pdf' });
  if (uploadError) throw new Error(`Error al subir PDF: ${uploadError.message}`);

  // 3. Obtener URL pública
  const { data: urlData } = supabase.storage.from('informes').getPublicUrl(storagePath);

  // 4. Guardar metadatos en la tabla
  const { data, error: dbError } = await supabase
    .from('informes')
    .insert({
      cliente_id: clienteId,
      titulo: informe.tituloInforme,
      proyecto: informe.proyectoNombre,
      periodo: informe.periodo ?? '',
      url_pdf: urlData.publicUrl,
      storage_path: storagePath,
      generado_por: generadoPor,
    })
    .select()
    .single();
  if (dbError) throw new Error(`Error al guardar informe: ${dbError.message}`);

  // 5. También descargar localmente
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return data as InformeGuardado;
}

// ── Listar informes de un cliente ─────────────────────────────────────────────
export async function listarInformes(clienteId: string): Promise<InformeGuardado[]> {
  const { data, error } = await supabase
    .from('informes')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InformeGuardado[];
}

// ── Eliminar informe ──────────────────────────────────────────────────────────
export async function eliminarInforme(informe: InformeGuardado): Promise<void> {
  // Borrar del storage
  await supabase.storage.from('informes').remove([informe.storage_path]);
  // Borrar de la tabla
  const { error } = await supabase.from('informes').delete().eq('id', informe.id);
  if (error) throw error;
}

// ── Utilidades NAS ────────────────────────────────────────────────────────────

export const NAS_FILE_ICONS: Record<string, string> = {
  pdf: '📄', image: '🖼️', video: '🎬', zip: '🗜️', doc: '📝', other: '📁',
};

export function detectarTipoArchivo(nombre: string): ArchivoNAS['tipo'] {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  if (['doc', 'docx', 'odt', 'txt', 'xlsx', 'xls', 'pptx'].includes(ext)) return 'doc';
  return 'other';
}
