<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from './DashboardCard.vue';
import { supabase } from '../supabase';
import {
  useClientReports, generateReportPDF,
  type Informe, type ArchivoNas, type TipoArchivo,
} from '../services/reports';

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  clientId: string;
  clientData: { name: string; contact?: string; industry?: string } | null;
  proyectos: any[];
  isAdmin: boolean;
}>();

// ── Service ───────────────────────────────────────────────────────────────────

const {
  informes, loading,
  createInforme, updateInforme, deleteInforme,
  addArchivoNas, deleteArchivoNas,
} = useClientReports(props.clientId);

// ── Expanded state ────────────────────────────────────────────────────────────

const expandedId = ref<string | null>(null);
const toggle = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id;
};

// ── Create / Edit informe modal ───────────────────────────────────────────────

const showModal   = ref(false);
const editingId   = ref<string | null>(null);
const savingModal = ref(false);
const emptyForm   = () => ({
  titulo:                '',
  descripcion_ejecutiva: '',
  resumen_trabajo:       '',
  periodo_inicio:        '',
  periodo_fin:           '',
  creado_por:            '',
});
const modalForm = ref(emptyForm());

const openCreate = () => {
  editingId.value = null;
  modalForm.value = emptyForm();
  showModal.value = true;
};

const openEdit = (informe: Informe) => {
  editingId.value = informe.id;
  modalForm.value = {
    titulo:                informe.titulo,
    descripcion_ejecutiva: informe.descripcion_ejecutiva ?? '',
    resumen_trabajo:       informe.resumen_trabajo ?? '',
    periodo_inicio:        informe.periodo_inicio ?? '',
    periodo_fin:           informe.periodo_fin ?? '',
    creado_por:            informe.creado_por ?? '',
  };
  showModal.value = true;
};

const saveModal = async () => {
  if (!modalForm.value.titulo.trim()) return;
  savingModal.value = true;
  try {
    const payload = {
      titulo:                modalForm.value.titulo.trim(),
      descripcion_ejecutiva: modalForm.value.descripcion_ejecutiva.trim() || null,
      resumen_trabajo:       modalForm.value.resumen_trabajo.trim() || null,
      periodo_inicio:        modalForm.value.periodo_inicio || null,
      periodo_fin:           modalForm.value.periodo_fin || null,
      creado_por:            modalForm.value.creado_por.trim() || null,
    };

    if (editingId.value) {
      await updateInforme(editingId.value, payload);
    } else {
      const created = await createInforme(payload);
      if (created) expandedId.value = created.id;
    }
    showModal.value = false;
  } finally {
    savingModal.value = false;
  }
};

const confirmDelete = async (informe: Informe) => {
  if (!confirm(`¿Eliminar el informe "${informe.titulo}"? Esta acción no se puede deshacer.`)) return;
  await deleteInforme(informe.id);
  if (expandedId.value === informe.id) expandedId.value = null;
};

// ── Add NAS file ──────────────────────────────────────────────────────────────

const addFileForId = ref<string | null>(null);
const savingFile   = ref(false);
const emptyFile    = () => ({
  nombre:      '',
  url_nas:     '',
  tipo:        'otro' as TipoArchivo,
  descripcion: '',
  orden:       0,
});
const fileForm = ref(emptyFile());

const openAddFile = (informeId: string) => {
  addFileForId.value = informeId;
  fileForm.value = emptyFile();
};

const computedOrden = computed(() => {
  if (!addFileForId.value) return 0;
  const informe = informes.value.find(i => i.id === addFileForId.value);
  return (informe?.archivos?.length ?? 0);
});

const saveFile = async () => {
  if (!addFileForId.value || !fileForm.value.nombre.trim() || !fileForm.value.url_nas.trim()) return;
  savingFile.value = true;
  try {
    await addArchivoNas(addFileForId.value, {
      nombre:      fileForm.value.nombre.trim(),
      url_nas:     fileForm.value.url_nas.trim(),
      tipo:        fileForm.value.tipo,
      descripcion: fileForm.value.descripcion.trim() || null,
      orden:       computedOrden.value,
    });
    addFileForId.value = null;
  } finally {
    savingFile.value = false;
  }
};

const confirmDeleteFile = async (informeId: string, archivo: ArchivoNas) => {
  if (!confirm(`¿Quitar el archivo "${archivo.nombre}"?`)) return;
  await deleteArchivoNas(informeId, archivo.id);
};

// ── PDF ───────────────────────────────────────────────────────────────────────

const generatingPdf = ref<string | null>(null);

const downloadPdf = async (informe: Informe) => {
  generatingPdf.value = informe.id;
  try {
    await generateReportPDF(
      informe,
      props.clientData
        ? { nombre: props.clientData.name, contact: props.clientData.contact, industry: props.clientData.industry }
        : null,
      props.proyectos,
    );
  } finally {
    generatingPdf.value = null;
  }
};

// ── File type helpers ─────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoArchivo, string> = {
  pdf:    'PDF',
  word:   'Word',
  excel:  'Excel',
  imagen: 'Imagen',
  video:  'Vídeo',
  zip:    'ZIP / Comprimido',
  otro:   'Otro',
};

const TIPO_ICONS: Record<TipoArchivo, string> = {
  pdf:    '📋',
  word:   '📝',
  excel:  '📊',
  imagen: '🖼️',
  video:  '🎬',
  zip:    '🗜️',
  otro:   '📁',
};

const TIPO_COLORS: Record<TipoArchivo, string> = {
  pdf:    '#ef4444',
  word:   '#3b82f6',
  excel:  '#22c55e',
  imagen: '#a855f7',
  video:  '#f97316',
  zip:    '#eab308',
  otro:   '#6b7280',
};

const formatPeriod = (informe: Informe): string => {
  if (informe.periodo) return informe.periodo;
  const from = informe.periodo_inicio
    ? new Date(informe.periodo_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
    : null;
  const to = informe.periodo_fin
    ? new Date(informe.periodo_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
    : null;
  if (from && to) return `${from} → ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return '';
};

const formatCreatedAt = (iso: string | null | undefined): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getCreatedAt = (informe: Informe): string =>
  formatCreatedAt(informe.creado_en ?? informe.created_at);

// ── Subir informe manual ──────────────────────────────────────────────────────
const showUploadModal  = ref(false);
const uploadingManual  = ref(false);
const uploadForm       = ref({ titulo: '', proyecto: '', periodo: '' });
const uploadFile       = ref<File | null>(null);
const uploadInput      = ref<HTMLInputElement | null>(null);

const openUploadModal = () => {
  uploadForm.value = { titulo: '', proyecto: '', periodo: '' };
  uploadFile.value = null;
  showUploadModal.value = true;
};

const handleUploadFile = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null;
  uploadFile.value = f;
  if (f && !uploadForm.value.titulo) uploadForm.value.titulo = f.name.replace(/\.[^.]+$/, '');
};

const confirmarUpload = async () => {
  if (!uploadFile.value || !uploadForm.value.titulo.trim()) return;
  uploadingManual.value = true;
  try {
    const file = uploadFile.value;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
    const path = `${props.clientId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from('informes').upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from('informes').getPublicUrl(path);
    const { data, error: dbErr } = await supabase.from('informes').insert({
      cliente_id: props.clientId,
      titulo: uploadForm.value.titulo.trim(),
      proyecto: uploadForm.value.proyecto.trim() || '',
      periodo: uploadForm.value.periodo.trim() || '',
      url_pdf: urlData.publicUrl,
      storage_path: path,
      generado_por: 'admin',
    }).select('*').single();
    if (dbErr) throw dbErr;
    informes.value.unshift(data as Informe);
    showUploadModal.value = false;
  } catch (err: any) {
    alert('Error al subir el informe: ' + (err?.message ?? ''));
  } finally {
    uploadingManual.value = false;
    if (uploadInput.value) uploadInput.value.value = '';
  }
};
</script>

<template>
  <DashboardCard title="Informes de Trabajo">

    <!-- Slot: botones de admin -->
    <template #actions>
      <template v-if="isAdmin">
        <button class="btn-new-report btn-upload-report" @click="openUploadModal">⬆ Subir informe</button>
        <button class="btn-new-report" @click="openCreate">+ Nuevo Informe</button>
      </template>
    </template>

    <!-- Estado de carga -->
    <div v-if="loading" class="rm-loading">Cargando informes…</div>

    <!-- Sin informes -->
    <div v-else-if="informes.length === 0" class="rm-empty">
      <div class="rm-empty-icon">📄</div>
      <p v-if="isAdmin">Aún no hay informes. Crea el primero con el botón <strong>+ Nuevo Informe</strong>.</p>
      <p v-else>Tu agencia aún no ha publicado informes para tu cuenta.</p>
    </div>

    <!-- Lista de informes -->
    <div v-else class="rm-list">
      <div
        v-for="informe in informes"
        :key="informe.id"
        class="rm-card"
        :class="{ expanded: expandedId === informe.id }"
      >
        <!-- Cabecera del informe -->
        <div class="rm-card-header" @click="toggle(informe.id)">
          <div class="rm-header-left">
            <div class="rm-badge">
              <span class="rm-badge-dot"></span>
              Informe
            </div>
            <div class="rm-header-text">
              <h4 class="rm-title">{{ informe.titulo }}</h4>
              <div class="rm-meta">
                <span v-if="formatPeriod(informe)" class="rm-period">{{ formatPeriod(informe) }}</span>
                <span v-if="informe.proyecto" class="rm-period">{{ informe.proyecto }}</span>
                <span class="rm-date">{{ getCreatedAt(informe) }}</span>
                <span v-if="informe.creado_por" class="rm-author">por {{ informe.creado_por }}</span>
              </div>
            </div>
          </div>

          <div class="rm-header-actions" @click.stop>
            <!-- Archivos -->
            <span v-if="informe.archivos && informe.archivos.length > 0" class="rm-file-count">
              {{ informe.archivos.length }} archivo{{ informe.archivos.length !== 1 ? 's' : '' }}
            </span>

            <!-- Ver/Descargar PDF -->
            <a v-if="informe.url_pdf" :href="informe.url_pdf" target="_blank" rel="noopener" class="btn-pdf" title="Ver PDF">
              <span>⬇</span> PDF
            </a>
            <button
              v-else
              class="btn-pdf"
              :class="{ loading: generatingPdf === informe.id }"
              @click="downloadPdf(informe)"
              :disabled="generatingPdf === informe.id"
              title="Generar PDF"
            >
              <span>{{ generatingPdf === informe.id ? '⏳' : '⬇' }}</span>
              PDF
            </button>

            <!-- Admin: editar / eliminar -->
            <template v-if="isAdmin">
              <button class="btn-icon-sm" @click="openEdit(informe)" title="Editar informe">✏️</button>
              <button class="btn-icon-sm danger" @click="confirmDelete(informe)" title="Eliminar informe">🗑️</button>
            </template>

            <!-- Chevron toggle -->
            <span class="rm-chevron" :class="{ open: expandedId === informe.id }">›</span>
          </div>
        </div>

        <!-- Cuerpo expandible -->
        <Transition name="rm-expand">
          <div v-if="expandedId === informe.id" class="rm-card-body">

            <!-- Resumen ejecutivo -->
            <div v-if="informe.descripcion_ejecutiva" class="rm-section">
              <h5 class="rm-section-title">Resumen Ejecutivo</h5>
              <p class="rm-section-text">{{ informe.descripcion_ejecutiva }}</p>
            </div>

            <!-- Trabajo realizado -->
            <div v-if="informe.resumen_trabajo" class="rm-section">
              <h5 class="rm-section-title">Trabajo Realizado</h5>
              <p class="rm-section-text">{{ informe.resumen_trabajo }}</p>
            </div>

            <!-- Archivos del NAS -->
            <div class="rm-section">
              <div class="rm-files-header">
                <h5 class="rm-section-title">Archivos Disponibles</h5>
                <button
                  v-if="isAdmin && addFileForId !== informe.id"
                  class="btn-add-file"
                  @click="openAddFile(informe.id)"
                >
                  + Añadir archivo
                </button>
              </div>

              <!-- Formulario inline para añadir archivo (solo admin) -->
              <Transition name="rm-expand">
                <div v-if="isAdmin && addFileForId === informe.id" class="rm-add-file-form">
                  <div class="rm-form-row">
                    <div class="rm-form-group">
                      <label>Nombre del archivo *</label>
                      <input v-model="fileForm.nombre" class="rm-input" placeholder="Ej: Informe de campañas Q1" />
                    </div>
                    <div class="rm-form-group">
                      <label>Tipo</label>
                      <select v-model="fileForm.tipo" class="rm-input">
                        <option v-for="(label, key) in TIPO_LABELS" :key="key" :value="key">{{ label }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="rm-form-group">
                    <label>URL del archivo en el NAS *</label>
                    <input v-model="fileForm.url_nas" class="rm-input" placeholder="http://192.168.1.x/carpeta/archivo.pdf" />
                  </div>
                  <div class="rm-form-group">
                    <label>Descripción breve (opcional)</label>
                    <input v-model="fileForm.descripcion" class="rm-input" placeholder="Métricas de alcance y engagement del trimestre" />
                  </div>
                  <div class="rm-form-actions">
                    <button class="btn-cancel-sm" @click="addFileForId = null">Cancelar</button>
                    <button
                      class="btn-save-sm"
                      :disabled="savingFile || !fileForm.nombre.trim() || !fileForm.url_nas.trim()"
                      @click="saveFile"
                    >
                      {{ savingFile ? 'Guardando…' : 'Guardar archivo' }}
                    </button>
                  </div>
                </div>
              </Transition>

              <!-- Lista de archivos como botones de descarga -->
              <div v-if="informe.archivos && informe.archivos.length > 0" class="rm-files-grid">
                <div
                  v-for="archivo in informe.archivos"
                  :key="archivo.id"
                  class="rm-file-card"
                  :style="{ '--file-color': TIPO_COLORS[archivo.tipo] }"
                >
                  <div class="rm-file-icon">{{ TIPO_ICONS[archivo.tipo] }}</div>
                  <div class="rm-file-info">
                    <span class="rm-file-name">{{ archivo.nombre }}</span>
                    <span v-if="archivo.descripcion" class="rm-file-desc">{{ archivo.descripcion }}</span>
                    <span class="rm-file-type">{{ TIPO_LABELS[archivo.tipo] }}</span>
                  </div>
                  <div class="rm-file-actions">
                    <a
                      :href="archivo.url_nas"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-download"
                      :title="`Descargar ${archivo.nombre}`"
                    >
                      ⬇ Descargar
                    </a>
                    <button
                      v-if="isAdmin"
                      class="btn-file-delete"
                      @click="confirmDeleteFile(informe.id, archivo)"
                      title="Quitar archivo"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <p v-else-if="!isAdmin || addFileForId !== informe.id" class="rm-no-files">
                No hay archivos adjuntos en este informe.
              </p>
            </div>

          </div>
        </Transition>
      </div>
    </div>

    <!-- ── Modal: Crear / Editar informe ─────────────────────────────────── -->
    <div class="rm-modal-overlay" v-if="showModal">
      <div class="rm-modal">
        <div class="rm-modal-header">
          <h3>{{ editingId ? 'Editar Informe' : 'Nuevo Informe de Trabajo' }}</h3>
          <button class="rm-modal-close" @click="showModal = false">×</button>
        </div>

        <div class="rm-modal-body">
          <div class="rm-form-group">
            <label>Título del informe *</label>
            <input v-model="modalForm.titulo" class="rm-input" placeholder="Ej: Informe Q1 2026 — Redes Sociales" />
          </div>

          <div class="rm-form-row">
            <div class="rm-form-group">
              <label>Período desde</label>
              <input v-model="modalForm.periodo_inicio" type="date" class="rm-input" />
            </div>
            <div class="rm-form-group">
              <label>Período hasta</label>
              <input v-model="modalForm.periodo_fin" type="date" class="rm-input" />
            </div>
          </div>

          <div class="rm-form-group">
            <label>Resumen ejecutivo</label>
            <textarea
              v-model="modalForm.descripcion_ejecutiva"
              class="rm-input rm-textarea"
              rows="4"
              placeholder="Breve descripción de los resultados y logros del período. Visible para el cliente."
            ></textarea>
          </div>

          <div class="rm-form-group">
            <label>Trabajo realizado</label>
            <textarea
              v-model="modalForm.resumen_trabajo"
              class="rm-input rm-textarea"
              rows="5"
              placeholder="Descripción detallada de las acciones, tareas y proyectos llevados a cabo durante el período."
            ></textarea>
          </div>

          <div class="rm-form-group">
            <label>Elaborado por</label>
            <input v-model="modalForm.creado_por" class="rm-input" placeholder="Nombre del responsable de la agencia" />
          </div>
        </div>

        <div class="rm-modal-footer">
          <button class="btn-cancel-sm" @click="showModal = false">Cancelar</button>
          <button
            class="btn-primary-modal"
            :disabled="savingModal || !modalForm.titulo.trim()"
            @click="saveModal"
          >
            {{ savingModal ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear informe' }}
          </button>
        </div>
      </div>
    </div>

  </DashboardCard>

  <!-- Modal: Subir informe manual -->
  <div class="modal-overlay" v-if="showUploadModal">
    <div class="modal-box">
      <p class="modal-title">Subir Informe</p>
      <div class="form-group">
        <label>Archivo *</label>
        <input ref="uploadInput" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" class="form-input" @change="handleUploadFile" />
      </div>
      <div class="form-group">
        <label>Título *</label>
        <input v-model="uploadForm.titulo" class="form-input" placeholder="Ej: Informe mensual mayo 2026" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Proyecto</label>
          <input v-model="uploadForm.proyecto" class="form-input" placeholder="Ej: Web Corporativa" />
        </div>
        <div class="form-group">
          <label>Período</label>
          <input v-model="uploadForm.periodo" class="form-input" placeholder="Ej: Mayo 2026" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-text" @click="showUploadModal = false">Cancelar</button>
        <button class="btn-primary" @click="confirmarUpload" :disabled="uploadingManual || !uploadFile || !uploadForm.titulo.trim()">
          {{ uploadingManual ? 'Subiendo...' : 'Subir informe' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────────*/
.rm-loading {
  color: var(--color-text-muted);
  padding: 1rem 0;
  text-align: center;
}

.rm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
  color: var(--color-text-muted);
  text-align: center;
}
.rm-empty-icon { font-size: 2.5rem; opacity: 0.4; }

/* ── Botón nuevo informe ─────────────────────────────────────────────────────*/
.btn-new-report {
  background: var(--color-primary, #e3ff04);
  color: #000;
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-new-report:hover { opacity: 0.85; }
.btn-upload-report { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-light); margin-right: 0.5rem; }
.btn-upload-report:hover { border-color: var(--color-primary); color: var(--color-primary); opacity: 1; }

/* ── Modal ───────────────────────────────────────────────────────────────────*/
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.25rem; color: var(--color-text-light); }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 0.9rem; border-radius: 6px; font-family: inherit; font-size: 0.9rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
.form-input:focus { border-color: var(--color-primary); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.btn-primary { background: var(--color-primary); color: #000; font-weight: 700; border: none; border-radius: 6px; padding: 0.55rem 1.2rem; cursor: pointer; font-size: 0.9rem; }
.btn-primary:disabled { opacity: 0.5; cursor: default; }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }

/* ── Lista de informes ───────────────────────────────────────────────────────*/
.rm-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Tarjeta de informe ──────────────────────────────────────────────────────*/
.rm-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.25s;
}
.rm-card.expanded,
.rm-card:hover {
  border-color: rgba(227, 255, 4, 0.4);
}

.rm-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  cursor: pointer;
  user-select: none;
  background: var(--color-bg-card);
  transition: background 0.2s;
}
.rm-card-header:hover { background: var(--color-bg-lighter, rgba(255,255,255,0.04)); }

.rm-header-left {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.rm-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-primary, #e3ff04);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  margin-top: 0.15rem;
}
.rm-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary, #e3ff04);
  flex-shrink: 0;
}

.rm-header-text { min-width: 0; }

.rm-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-light);
  margin: 0 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rm-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.rm-period { color: var(--color-text-light); opacity: 0.75; }

.rm-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.rm-file-count {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* PDF button */
.btn-pdf {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: transparent;
  border: 1px solid var(--color-primary, #e3ff04);
  color: var(--color-primary, #e3ff04);
  border-radius: 6px;
  padding: 0.3rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
}
.btn-pdf:hover:not(:disabled) {
  background: var(--color-primary, #e3ff04);
  color: #000;
}
.btn-pdf:disabled { opacity: 0.5; cursor: default; }

.btn-icon-sm {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  font-size: 0.85rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.btn-icon-sm:hover { opacity: 1; }
.btn-icon-sm.danger:hover { opacity: 1; color: #ff4444; }

.rm-chevron {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  transition: transform 0.25s;
  line-height: 1;
}
.rm-chevron.open { transform: rotate(90deg); }

/* ── Cuerpo del informe ──────────────────────────────────────────────────────*/
.rm-card-body {
  border-top: 1px solid var(--color-border);
  padding: 1.25rem 1rem;
  background: var(--color-bg-dark);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.rm-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-primary, #e3ff04);
  margin: 0 0 0.6rem;
}

.rm-section-text {
  font-size: 0.875rem;
  color: var(--color-text-light);
  line-height: 1.65;
  white-space: pre-wrap;
  margin: 0;
}

/* ── Archivos ────────────────────────────────────────────────────────────────*/
.rm-files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.rm-files-header .rm-section-title { margin: 0; }

.btn-add-file {
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.btn-add-file:hover {
  border-color: var(--color-primary, #e3ff04);
  color: var(--color-primary, #e3ff04);
}

.rm-no-files {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
  padding: 0.5rem 0;
}

/* ── Grid de archivos ────────────────────────────────────────────────────────*/
.rm-files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.rm-file-card {
  --file-color: #6b7280;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  transition: border-color 0.2s, transform 0.15s;
}
.rm-file-card:hover {
  border-color: var(--file-color);
  transform: translateY(-2px);
}

.rm-file-icon {
  font-size: 1.8rem;
  line-height: 1;
}

.rm-file-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}
.rm-file-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-light);
  line-height: 1.3;
}
.rm-file-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}
.rm-file-type {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--file-color);
  margin-top: 0.1rem;
}

.rm-file-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.btn-download {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  background: var(--file-color);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.15s;
  flex: 1;
  justify-content: center;
}
.btn-download:hover { opacity: 0.85; transform: translateY(-1px); }

.btn-file-delete {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  flex-shrink: 0;
}
.btn-file-delete:hover { border-color: #ff4444; color: #ff4444; }

/* ── Formulario añadir archivo ───────────────────────────────────────────────*/
.rm-add-file-form {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rm-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.rm-form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.rm-form-group label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rm-input {
  background: var(--color-bg-dark, #0d0d0d);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-light);
  font-size: 0.875rem;
  padding: 0.5rem 0.65rem;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}
.rm-input:focus { border-color: var(--color-primary, #e3ff04); }
.rm-textarea { resize: vertical; min-height: 80px; }

.rm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-cancel-sm {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: 6px;
  padding: 0.4rem 0.85rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.2s;
}
.btn-cancel-sm:hover { border-color: var(--color-text-muted); }

.btn-save-sm {
  background: var(--color-primary, #e3ff04);
  border: none;
  color: #000;
  border-radius: 6px;
  padding: 0.4rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-save-sm:disabled { opacity: 0.5; cursor: default; }
.btn-save-sm:not(:disabled):hover { opacity: 0.85; }

/* ── Modal ───────────────────────────────────────────────────────────────────*/
.rm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.rm-modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: 100%;
  max-width: 580px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rm-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}
.rm-modal-header h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-light);
  margin: 0;
}
.rm-modal-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  padding: 0.1rem 0.3rem;
  transition: color 0.2s;
}
.rm-modal-close:hover { color: var(--color-text-light); }

.rm-modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rm-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border);
}

.btn-primary-modal {
  background: var(--color-primary, #e3ff04);
  border: none;
  color: #000;
  border-radius: 7px;
  padding: 0.5rem 1.2rem;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-primary-modal:disabled { opacity: 0.5; cursor: default; }
.btn-primary-modal:not(:disabled):hover { opacity: 0.85; }

/* ── Animación expand ────────────────────────────────────────────────────────*/
.rm-expand-enter-active,
.rm-expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.25s ease;
  overflow: hidden;
  max-height: 2000px;
}
.rm-expand-enter-from,
.rm-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ── Responsive ──────────────────────────────────────────────────────────────*/
@media (max-width: 768px) {
  .rm-form-row { grid-template-columns: 1fr; }
  .rm-files-grid { grid-template-columns: 1fr; }
  .rm-card-header { flex-wrap: wrap; }
  .rm-title { white-space: normal; }
}
</style>
