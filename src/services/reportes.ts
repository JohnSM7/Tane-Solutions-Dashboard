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
  base64: string;
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
  contenido?: InformeProyecto;
  adjuntos?: InformeAdjunto[];
};

export type InformeAdjunto = {
  id: string;
  informe_id: string;
  nombre: string;
  url: string;
  storage_path: string;
  tipo: string;
  tamanio: number | null;
  created_at: string;
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
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function comprimirImagen(base64: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = (maxWidth * h) / w; w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(base64);
  });
}

// ── Colores y Diseño ──────────────────────────────────────────────────────────
type C3 = [number, number, number];
const LIME:  C3 = [227, 255, 4];
const DARK:  C3 = [18, 18, 18];
const DGRAY: C3 = [50, 50, 50];
const WHITE: C3 = [255, 255, 255];
const W = 210, H = 297, ML = 18, MR = 192, CW = MR - ML;

function footer(doc: jsPDF, page: number, total: number) {
  doc.setFillColor(...DARK); doc.rect(0, H - 12, W, 12, 'F');
  doc.setTextColor(150, 150, 150); doc.setFontSize(7);
  doc.text(`${AGENCIA.nombre} · ${AGENCIA.web}`, W/2, H-5, { align: 'center' });
  doc.text(`${page}/${total}`, MR, H-5, { align: 'right' });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setDrawColor(...LIME); doc.setLineWidth(1.5); doc.line(ML, y, ML+30, y);
  y += 6; doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...DARK);
  doc.text(title.toUpperCase(), ML, y); return y + 8;
}

function needsPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > H - 25) { doc.addPage(); return 25; }
  return y;
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERADOR DE INFORME PDF COMPLETO
// ══════════════════════════════════════════════════════════════════════════════

export async function generateReportePDF(informe: InformeProyecto): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const logo = await loadImageBase64('/logo-verde.png');
  
  // PORTADA
  doc.setFillColor(...DARK); doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(...LIME); doc.rect(0, 0, W, 5, 'F');
  if (logo) doc.addImage(logo, 'PNG', W/2-20, 40, 40, 40);
  
  doc.setTextColor(...LIME); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(AGENCIA.nombre.toUpperCase(), W/2, 90, { align: 'center' });
  
  doc.setTextColor(...WHITE); doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(informe.tituloInforme, 160);
  doc.text(titleLines, W/2, 130, { align: 'center' });
  
  doc.setTextColor(...LIME); doc.setFontSize(14); doc.setFont('helvetica', 'normal');
  doc.text(informe.proyectoNombre, W/2, 130 + (titleLines.length * 12), { align: 'center' });
  
  doc.setFillColor(30,30,30); doc.roundedRect(40, H-80, 130, 40, 3, 3, 'F');
  doc.setTextColor(150,150,150); doc.setFontSize(8); doc.text('PREPARADO PARA', W/2, H-70, { align: 'center' });
  doc.setTextColor(...WHITE); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text(informe.clienteNombre, W/2, H-58, { align: 'center' });

  // 1. DESCRIPCIÓN Y OBJETIVOS
  doc.addPage(); let y = 25;
  if (informe.descripcionGeneral) {
    y = sectionTitle(doc, 'Resumen del Proyecto', y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DGRAY);
    const lines = doc.splitTextToSize(informe.descripcionGeneral, CW);
    doc.text(lines, ML, y); y += lines.length * 6 + 10;
  }

  if (informe.objetivos && informe.objetivos.length > 0) {
    y = sectionTitle(doc, 'Objetivos Estratégicos', y);
    informe.objetivos.forEach(obj => {
      y = needsPage(doc, y, 12);
      doc.setFillColor(...LIME); doc.circle(ML+3, y-1.5, 1.5, 'F');
      doc.setTextColor(...DGRAY); doc.text(obj, ML+8, y, { maxWidth: CW-10 });
      y += 8;
    });
    y += 5;
  }

  if (informe.resumenEjecutivo) {
    y = needsPage(doc, y, 40); y = sectionTitle(doc, 'Resumen Ejecutivo', y);
    doc.setFillColor(248, 255, 220); 
    const resLines = doc.splitTextToSize(informe.resumenEjecutivo, CW - 15);
    const rh = resLines.length * 6 + 10;
    doc.roundedRect(ML, y, CW, rh, 2, 2, 'F');
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'italic');
    doc.text(resLines, ML + 8, y + 8); y += rh + 10;
  }

  // 2. KPIs y TAREAS
  if (informe.kpis && informe.kpis.length > 0) {
    y = needsPage(doc, y, 50); y = sectionTitle(doc, 'Métricas Clave', y);
    const kw = (CW - 10) / 2;
    informe.kpis.forEach((kpi, i) => {
      const kx = ML + (i % 2) * (kw + 10);
      const ky = y + Math.floor(i / 2) * 25;
      doc.setFillColor(...DARK); doc.roundedRect(kx, ky, kw, 20, 2, 2, 'F');
      doc.setTextColor(...LIME); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(kpi.value, kx+kw/2, ky+10, { align:'center' });
      doc.setTextColor(...WHITE); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(kpi.label, kx+kw/2, ky+16, { align:'center' });
    });
    y += Math.ceil(informe.kpis.length / 2) * 25 + 5;
  }

  if (informe.tareas && informe.tareas.length > 0) {
    y = needsPage(doc, y, 40); y = sectionTitle(doc, 'Tareas Realizadas', y);
    informe.tareas.forEach((t, i) => {
      y = needsPage(doc, y, 15);
      doc.setFillColor(i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255);
      doc.rect(ML, y, CW, 12, 'F');
      doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.text(t.titulo, ML+5, y+7);
      y += 14;
    });
  }

  // ARCHIVOS NAS
  if (informe.archivosNas && informe.archivosNas.length > 0) {
    y = needsPage(doc, y, 40); y = sectionTitle(doc, 'Documentación Relacionada', y);
    informe.archivosNas.forEach(f => {
      y = needsPage(doc, y, 12);
      doc.setTextColor(0, 100, 255); doc.text(`[🔗] ${f.nombre}`, ML+5, y);
      y += 8;
    });
  }

  // 3. IMÁGENES
  if (informe.imagenesAdjuntas && informe.imagenesAdjuntas.length > 0) {
    for (const img of informe.imagenesAdjuntas) {
      doc.addPage(); y = 25;
      y = sectionTitle(doc, img.nombre, y);
      const opt = await comprimirImagen(img.base64);
      doc.addImage(opt, 'JPEG', ML, y, CW, 100, undefined, 'FAST');
    }
  }

  // 4. CONCLUSIONES Y PRÓXIMOS PASOS
  doc.addPage(); y = 25;
  if (informe.conclusiones) {
    y = sectionTitle(doc, 'Conclusiones Finales', y);
    doc.setTextColor(...DGRAY); doc.setFont('helvetica','normal');
    const clines = doc.splitTextToSize(informe.conclusiones, CW);
    doc.text(clines, ML, y); y += clines.length * 6 + 15;
  }

  if (informe.proximosPasos && informe.proximosPasos.length > 0) {
    y = sectionTitle(doc, 'Próximos Pasos Recomendados', y);
    informe.proximosPasos.forEach((p, i) => {
      y = needsPage(doc, y, 15);
      doc.setFillColor(...DARK); doc.circle(ML+4, y-1, 4, 'F');
      doc.setTextColor(...LIME); doc.setFont('helvetica','bold'); doc.text(`${i+1}`, ML+4, y+0.5, { align:'center' });
      doc.setTextColor(...DGRAY); doc.setFont('helvetica','normal'); doc.text(p, ML+12, y, { maxWidth: CW-15 });
      y += 12;
    });
  }

  // CIERRE
  y = needsPage(doc, y, 50);
  doc.setFillColor(...DARK); doc.roundedRect(ML, y, CW, 40, 3, 3, 'F');
  doc.setTextColor(...LIME); doc.setFontSize(14); doc.text('¿Dudas sobre este informe?', W/2, y+15, { align:'center' });
  doc.setTextColor(...WHITE); doc.setFontSize(9); doc.text(`Contacta con nosotros en ${AGENCIA.email}`, W/2, y+25, { align:'center' });

  // FOOTERS
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); if (i > 1) footer(doc, i, pages); }

  const filename = `informe_${informe.clienteNombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  return { blob: doc.output('blob'), filename };
}

// ── Persistencia Supabase ─────────────────────────────────────────────────────

export async function guardarInforme(informe: InformeProyecto, clienteId: string, generadoPor = 'admin'): Promise<InformeGuardado> {
  const { blob, filename } = await generateReportePDF(informe);
  const path = `${clienteId}/${filename}`;
  let url_pdf = null;

  try {
    const upload = supabase.storage.from('informes').upload(path, blob, { contentType: 'application/pdf', upsert: true });
    const timeout = new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 12000));
    await Promise.race([upload, timeout]);
    url_pdf = supabase.storage.from('informes').getPublicUrl(path).data.publicUrl;
  } catch (e) { console.warn('[REPORTE] Fallo subida, continuando con metadata.'); }

  const { data, error } = await supabase.from('informes').insert({
    cliente_id: clienteId,
    titulo: informe.tituloInforme,
    proyecto: informe.proyectoNombre,
    periodo: informe.periodo || '',
    url_pdf,
    storage_path: path,
    generado_por: generadoPor,
    contenido: { ...informe, imagenesAdjuntas: [] } 
  }).select().single();

  if (error) throw error;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  return data as InformeGuardado;
}

export async function listarInformes(clienteId: string): Promise<InformeGuardado[]> {
  const { data, error } = await supabase
    .from('informes')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InformeGuardado[];
}

export async function eliminarInforme(informe: InformeGuardado) {
  // Borrar adjuntos del storage
  if (informe.adjuntos?.length) {
    const paths = informe.adjuntos.map(a => a.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from('informes').remove(paths);
  }
  if (informe.storage_path) await supabase.storage.from('informes').remove([informe.storage_path]);
  await supabase.from('informes').delete().eq('id', informe.id);
}

const ALLOWED_ADJUNTO_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

export async function subirAdjunto(
  informe: InformeGuardado,
  file: File,
): Promise<InformeAdjunto> {
  if (!ALLOWED_ADJUNTO_TYPES.has(file.type)) {
    throw new Error(`Tipo de archivo no permitido (${file.type}). Se aceptan PDF, imágenes, Word y Excel.`);
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('El archivo supera el límite de 20 MB.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
  const path = `adjuntos/${informe.cliente_id}/${informe.id}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage.from('informes').upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const { data: urlData } = supabase.storage.from('informes').getPublicUrl(path);

  const tipo = detectarTipoArchivo(file.name);
  const { data, error } = await supabase.from('informe_adjuntos').insert({
    informe_id: informe.id,
    nombre: file.name,
    url: urlData.publicUrl,
    storage_path: path,
    tipo,
    tamanio: file.size,
  }).select().single();
  if (error) throw error;
  return data as InformeAdjunto;
}

export async function eliminarAdjunto(adjunto: InformeAdjunto) {
  await supabase.storage.from('informes').remove([adjunto.storage_path]);
  await supabase.from('informe_adjuntos').delete().eq('id', adjunto.id);
}

export async function descargarReportePDF(informe: InformeProyecto) {
  const { blob, filename } = await generateReportePDF(informe);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
}

export const NAS_FILE_ICONS: Record<string, string> = { pdf:'📄', image:'🖼️', video:'🎬', zip:'📦', doc:'📝', other:'📎' };
export function detectarTipoArchivo(url: string): any {
  const ext = url.split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','svg','webp'].includes(ext!)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}
