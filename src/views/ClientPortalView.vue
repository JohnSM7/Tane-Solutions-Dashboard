<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import { authStore } from '../store/auth';
import { useClientProfile } from '../services/clients';
import { ESTADO_COLORS } from '../services/operations';
import { listarInformes, type InformeGuardado } from '../services/reportes';

const clientId = authStore.user?.clientId ?? '';
const {
    clientData, proyectos, sedes, documentos,
    financials, loading,
    uploadDocumento, saveProfile,
  } = useClientProfile(clientId);

const selectedSedeId = ref<number | 'all'>('all');

const filteredProyectos = computed(() => {
  if (selectedSedeId.value === 'all') return proyectos.value;
  return proyectos.value.filter((p: any) => p.sede_id === selectedSedeId.value);
});

const filteredDocumentos = computed(() => {
  if (selectedSedeId.value === 'all') return documentos.value;
  return documentos.value.filter((d: any) => d.sede_id === selectedSedeId.value);
});

const filteredSedes = computed(() => {
  if (selectedSedeId.value === 'all') return sedes.value;
  return sedes.value.filter(s => s.id === selectedSedeId.value);
});

// ── Editar perfil ─────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const savingProfile = ref(false);
const editForm = ref({ name: '', contact: '', logo: '' });

const openEditModal = () => {
  if (!clientData.value) return;
  editForm.value = { name: clientData.value.name, contact: clientData.value.contact, logo: clientData.value.logo };
  showEditModal.value = true;
};
const handleSaveProfile = async () => {
  savingProfile.value = true;
  await saveProfile(editForm.value);
  savingProfile.value = false;
  showEditModal.value = false;
};

// ── Upload documentos ─────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref('');

const triggerUpload = () => fileInput.value?.click();

const handleFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  uploadError.value = '';
  try {
    const sedeId = selectedSedeId.value !== 'all' ? (selectedSedeId.value as number) : null;
    await uploadDocumento(file, sedeId, 'Cliente');
  } catch (err: any) {
    uploadError.value = err.message ?? 'Error al subir';
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });

const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Informes del cliente ───────────────────────────────────────────────────────
const informes = ref<InformeGuardado[]>([]);
const cargandoInformes = ref(true);

onMounted(async () => {
  if (clientId) {
    try {
      informes.value = await listarInformes(clientId);
    } catch { /* tabla puede no existir */ }
  }
  cargandoInformes.value = false;
});

// ── Visualizar informe detallado ───────────────────────────────────────────────
const selectedInforme = ref<InformeGuardado | null>(null);

const abrirInforme = (inf: InformeGuardado) => {
  selectedInforme.value = inf;
};

const totalHoras = (inf: InformeGuardado) =>
  (inf.contenido?.tareas ?? []).reduce((s, t) => s + (t.horas ?? 0), 0);

const estadoColor: Record<string, string> = {
  'Completada': '#4ade80', 'En progreso': '#ffa500', 'Pendiente': '#888',
};
</script>

<template>
  <div class="view-container">
    <div v-if="loading" class="loading-state">Cargando tu panel...</div>

    <template v-else-if="clientData">
      <!-- Cabecera de bienvenida -->
      <div class="welcome-header">
        <div class="welcome-text">
          <h1>Hola, {{ clientData.contact.split(' ')[0] }} 👋</h1>
          <p>Panel central de <strong>{{ clientData.name }}</strong>. Revisa el progreso de tus proyectos, métricas y documentos.</p>
          <div class="location-filter">
            <label>📍 Filtrar por Sede:</label>
            <select v-model="selectedSedeId" class="custom-select">
              <option value="all">Ver todas</option>
              <option v-for="s in sedes" :key="s.id" :value="s.id">{{ s.nombre }}</option>
            </select>
          </div>
        </div>
        <div class="client-brand">
          <img v-if="clientData.logo" :src="clientData.logo" :alt="clientData.name" class="client-logo" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
          <div v-else class="logo-placeholder">{{ clientData.name.charAt(0) }}</div>
          <span class="brand-name">{{ clientData.name }}</span>
          <button class="btn-sm btn-outline" @click="openEditModal">Editar Mi Perfil</button>
        </div>
      </div>

      <!-- Resumen financiero (sólo visible en "todas las sedes") -->
      <div v-if="selectedSedeId === 'all'" class="fin-summary">
        <div class="fin-box success">
          <span class="fin-label">Abonado</span>
          <span class="fin-value">{{ financials.paid }}</span>
        </div>
        <div class="fin-box warning">
          <span class="fin-label">Por pagar</span>
          <span class="fin-value">{{ financials.pending }}</span>
        </div>
        <div class="fin-box neutral">
          <span class="fin-label">Total facturado</span>
          <span class="fin-value">{{ financials.total }}</span>
        </div>
      </div>

      <div class="content-grid">
        <!-- Proyectos -->
        <DashboardCard title="Proyectos en Curso">
          <div v-if="filteredProyectos.length === 0" class="empty-state">Sin proyectos activos para esta sede</div>
          <ul v-else class="activity-list">
            <li v-for="p in filteredProyectos" :key="p.id">
              <div class="act-dot" :style="{ backgroundColor: ESTADO_COLORS[p.estado] }"></div>
              <div class="act-text">
                <strong>{{ p.nombre }}</strong>
                <span>{{ p.fase || p.estado }}</span>
              </div>
              <span class="status-pill" :style="{ color: ESTADO_COLORS[p.estado], borderColor: ESTADO_COLORS[p.estado] }">
                {{ p.estado }}
              </span>
            </li>
          </ul>
        </DashboardCard>

        <!-- Documentos -->
        <DashboardCard title="Mis Documentos">
          <div class="upload-area" @click="triggerUpload" :class="{ uploading }">
            <input ref="fileInput" type="file" class="hidden-input" @change="handleFileChange" />
            <div class="upload-icon">{{ uploading ? '⏳' : '⬆️' }}</div>
            <p>{{ uploading ? 'Subiendo archivo...' : 'Haz clic para enviar un archivo a la agencia' }}</p>
            <span class="upload-hint">Fotos, PDF, documentos — máx. 50 MB</span>
          </div>
          <p v-if="uploadError" class="error-msg">{{ uploadError }}</p>

          <div v-if="filteredDocumentos.length === 0" class="empty-state">Sin documentos</div>
          <ul v-else class="docs-list">
            <li v-for="doc in filteredDocumentos" :key="doc.id" class="doc-item">
              <div class="doc-info">
                <span class="doc-icon">📄</span>
                <div class="doc-meta">
                  <span class="doc-name">{{ doc.nombre }}</span>
                  <span class="doc-details">
                    {{ formatDate(doc.creado_en) }} ·
                    <strong :class="{ 'text-primary': doc.subido_por === 'Agencia' }">{{ doc.subido_por }}</strong>
                  </span>
                </div>
              </div>
              <a :href="doc.url" target="_blank" class="btn-view">👀 Ver</a>
            </li>
          </ul>
        </DashboardCard>
      </div>

      <!-- Google My Business -->
      <div v-if="filteredSedes.length > 0">
        <h3 class="section-title">Fichas de Google My Business</h3>
        <div class="gmb-grid">
          <DashboardCard v-for="s in filteredSedes" :key="s.id" :title="s.nombre">
            <div class="gmb-stats">
              <div class="gmb-stat">
                <span class="gmb-icon">⭐</span>
                <span class="gmb-val">{{ s.gmb_rating }}</span>
                <span class="gmb-label">Calificación</span>
              </div>
              <div class="gmb-stat">
                <span class="gmb-icon">💬</span>
                <span class="gmb-val">{{ s.gmb_reviews }}</span>
                <span class="gmb-label">Reseñas</span>
              </div>
            </div>

            <div v-if="s.gmb_unanswered > 0" class="gmb-alert">
              Tienes {{ s.gmb_unanswered }} reseña(s) sin responder
            </div>

            <div class="gmb-pub-card mt-1" v-if="s.gmb_latest_pub">
              <h4>Última publicación</h4>
              <p class="pub-text">"{{ s.gmb_latest_pub }}"</p>
              <div class="pub-footer">
                <span>👁️ {{ s.gmb_pub_views }} visualizaciones</span>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>

      <!-- Informes de trabajo -->
      <div v-if="!cargandoInformes && informes.length > 0" class="informes-section">
        <h3 class="section-title">📊 Informes de Trabajo</h3>
        <div class="informes-grid">
          <div v-for="inf in informes" :key="inf.id" class="informe-card">
            <div class="informe-icon">📄</div>
            <div class="informe-body">
              <strong class="informe-titulo">{{ inf.titulo }}</strong>
              <div class="informe-meta">
                <span>{{ inf.proyecto }}</span>
                <span v-if="inf.periodo"> · {{ inf.periodo }}</span>
              </div>
              <small class="informe-fecha">{{ formatDateLong(inf.creado_en) }}</small>
            </div>
            <div class="informe-actions">
              <button @click="abrirInforme(inf)" class="btn-text">👁️ Ver Informe</button>
              <a :href="inf.url_pdf" target="_blank" class="btn-download">
                ⬇️ PDF
              </a>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal: Detalle del Informe -->
    <div v-if="selectedInforme" class="modal-overlay report-detail-overlay" @click.self="selectedInforme = null">
      <div class="modal-box report-modal">
        <div class="report-modal-header">
          <div class="report-modal-title">
            <h2>{{ selectedInforme.titulo }}</h2>
            <p>{{ selectedInforme.proyecto }} · {{ selectedInforme.periodo || 'General' }}</p>
          </div>
          <button class="btn-close" @click="selectedInforme = null">✕</button>
        </div>

        <div class="report-modal-content scrollable">
          <div class="rg-preview-titulo">{{ selectedInforme.contenido?.tituloInforme || selectedInforme.titulo }}</div>

          <div class="report-section" v-if="selectedInforme.contenido?.descripcionGeneral">
            <label>DESCRIPCIÓN DEL PROYECTO</label>
            <p>{{ selectedInforme.contenido.descripcionGeneral }}</p>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.objetivos?.length">
            <label>OBJETIVOS</label>
            <ul class="client-steps-dots">
              <li v-for="o in selectedInforme.contenido.objetivos" :key="o">{{ o }}</li>
            </ul>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.resumenEjecutivo">
            <label>RESUMEN EJECUTIVO</label>
            <p class="resumen-text-box">{{ selectedInforme.contenido.resumenEjecutivo }}</p>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.kpis?.length">
            <label>RESULTADOS Y MÉTRICAS</label>
            <div class="client-kpi-grid">
              <div v-for="k in selectedInforme.contenido.kpis" :key="k.label" class="client-kpi-card">
                <span class="client-kpi-val">{{ k.value }}</span>
                <span class="client-kpi-label">{{ k.label }}</span>
              </div>
            </div>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.tareas?.length">
            <label>TRABAJOS REALIZADOS ({{ totalHoras(selectedInforme) }}h totales)</label>
            <div class="client-tareas-list">
              <div v-for="t in selectedInforme.contenido.tareas" :key="t.titulo" class="client-tarea-item">
                <div class="client-tarea-dot" :style="{ background: estadoColor[t.estado || 'Completada'] }"></div>
                <div class="client-tarea-text">
                  <strong>{{ t.titulo }}</strong>
                  <p>{{ t.descripcion }}</p>
                </div>
                <div class="client-tarea-hours" v-if="t.horas">{{ t.horas }}h</div>
              </div>
            </div>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.imagenesAdjuntas?.length">
            <label>MATERIAL VISUAL ({{ selectedInforme.contenido.imagenesAdjuntas.length }} imágenes)</label>
            <div class="client-gallery">
              <img v-for="img in selectedInforme.contenido.imagenesAdjuntas" :key="img.nombre" :src="img.base64" :alt="img.nombre" />
            </div>
          </div>

          <div class="report-double-grid">
            <div class="report-section" v-if="selectedInforme.contenido?.conclusiones">
              <label>CONCLUSIONES</label>
              <p>{{ selectedInforme.contenido.conclusiones }}</p>
            </div>
            <div class="report-section" v-if="selectedInforme.contenido?.proximosPasos?.length">
              <label>PRÓXIMOS PASOS</label>
              <ol class="client-steps-ordered">
                <li v-for="step in selectedInforme.contenido.proximosPasos" :key="step">{{ step }}</li>
              </ol>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <a :href="selectedInforme.url_pdf" target="_blank" class="btn-primary">📄 Descargar PDF</a>
          <button class="btn-text" @click="selectedInforme = null">Cerrar</button>
        </div>
      </div>
    </div>

    <div v-else class="loading-state">No se encontró tu perfil. Contacta con la agencia.</div>

    <!-- Modal: Editar perfil -->
    <div class="modal-overlay" v-if="showEditModal" @click.self="showEditModal = false">
      <div class="modal-box">
        <p class="modal-title">Editar Mi Perfil</p>
        <div class="form-group"><label>Nombre de empresa</label><input v-model="editForm.name" class="form-input" /></div>
        <div class="form-group"><label>Nombre de contacto</label><input v-model="editForm.contact" class="form-input" /></div>
        <div class="form-group"><label>URL del logo</label><input v-model="editForm.logo" class="form-input" placeholder="https://..." /></div>
        <div class="modal-actions">
          <button class="btn-text" @click="showEditModal = false">Cancelar</button>
          <button class="btn-primary" @click="handleSaveProfile" :disabled="savingProfile">
            {{ savingProfile ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem 0; }

.welcome-header { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, rgba(227,255,4,0.08) 0%, transparent 100%), var(--color-bg-card); padding: 2.5rem; border-radius: 12px; border: 1px solid var(--color-primary); flex-wrap: wrap; gap: 2rem; }
.welcome-text { flex: 1; }
.welcome-text h1 { font-size: 2rem; margin: 0 0 0.5rem; color: var(--color-primary); }
.welcome-text p { font-size: 1rem; color: var(--color-text-light); margin: 0 0 1rem; }
.location-filter { display: flex; align-items: center; gap: 0.75rem; }
.location-filter label { font-weight: 600; font-size: 0.9rem; }
.custom-select { background: var(--color-bg-lighter); color: var(--color-text-light); border: 1px solid var(--color-border); padding: 0.4rem 0.8rem; border-radius: 4px; outline: none; color-scheme: dark; }
.client-brand { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.client-logo, .logo-placeholder { width: 80px; height: 80px; border-radius: 12px; border: 2px solid var(--color-primary); object-fit: cover; }
.logo-placeholder { background: var(--color-primary); color: #000; font-size: 2rem; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.brand-name { font-weight: 700; font-size: 1rem; }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px; cursor: pointer; }
.btn-outline { background: transparent; border: 1px dashed var(--color-text-muted); color: var(--color-text-muted); }
.btn-outline:hover { border-color: var(--color-primary); color: var(--color-primary); }

.fin-summary { display: flex; gap: 1rem; }
.fin-box { flex: 1; background: var(--color-bg-card); border: 1px solid transparent; padding: 1.25rem; border-radius: 10px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.fin-box.success { border-color: rgba(74,222,128,0.3); color: #4ade80; }
.fin-box.warning { border-color: rgba(250,204,21,0.3); color: #facc15; }
.fin-box.neutral { border-color: var(--color-border); }
.fin-label { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 0.4rem; }
.fin-value { font-size: 1.6rem; font-weight: 700; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 900px) {
  .content-grid { grid-template-columns: 1fr; }
  .fin-summary { flex-direction: column; }
  .welcome-header { flex-direction: column-reverse; align-items: flex-start; }
}

.activity-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.activity-list li { display: flex; gap: 0.75rem; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 8px; }
.act-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.act-text { display: flex; flex-direction: column; flex: 1; }
.act-text strong { font-size: 0.95rem; }
.act-text span { font-size: 0.8rem; color: var(--color-text-muted); }
.status-pill { font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 10px; border: 1px solid; flex-shrink: 0; }

.upload-area { border: 2px dashed rgba(227,255,4,0.4); padding: 1.5rem; text-align: center; border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s; background: rgba(227,255,4,0.02); }
.upload-area:hover, .upload-area.uploading { border-color: var(--color-primary); background: rgba(227,255,4,0.06); }
.hidden-input { display: none; }
.upload-icon { font-size: 1.8rem; margin-bottom: 0.3rem; }
.upload-hint { font-size: 0.8rem; color: var(--color-text-muted); display: block; margin-top: 0.25rem; }
.error-msg { color: #ff4444; font-size: 0.85rem; margin-bottom: 0.75rem; }
.docs-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--color-bg-lighter); border-radius: 8px; }
.doc-info { display: flex; gap: 0.75rem; align-items: center; overflow: hidden; flex: 1; }
.doc-icon { font-size: 1.2rem; flex-shrink: 0; }
.doc-meta { display: flex; flex-direction: column; overflow: hidden; }
.doc-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-details { font-size: 0.78rem; color: var(--color-text-muted); }
.text-primary { color: var(--color-primary); }
.btn-view { background: var(--color-primary); color: #000; padding: 0.35rem 0.8rem; border-radius: 4px; font-weight: 600; font-size: 0.82rem; text-decoration: none; flex-shrink: 0; }

.section-title { font-size: 1.2rem; color: var(--color-text-muted); margin-bottom: 1rem; }
.gmb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
.gmb-stats { display: flex; gap: 1rem; margin-bottom: 1rem; }
.gmb-stat { flex: 1; display: flex; flex-direction: column; align-items: center; background: var(--color-bg-lighter); padding: 1rem; border-radius: 8px; }
.gmb-icon { font-size: 1.3rem; margin-bottom: 0.2rem; }
.gmb-val { font-size: 1.5rem; font-weight: 700; }
.gmb-label { font-size: 0.78rem; color: var(--color-text-muted); }
.gmb-alert { background: rgba(248,113,113,0.1); color: #f87171; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(248,113,113,0.3); text-align: center; font-size: 0.9rem; margin-bottom: 0.75rem; }
.gmb-pub-card { background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--color-primary); }
.gmb-pub-card h4 { margin: 0 0 0.4rem; font-size: 0.85rem; color: var(--color-text-muted); }
.pub-text { font-style: italic; margin: 0 0 0.5rem; font-size: 0.95rem; }
.pub-footer { font-size: 0.82rem; color: var(--color-primary); font-weight: 600; }
.mt-1 { margin-top: 0.75rem; }
.empty-state { color: var(--color-text-muted); font-style: italic; text-align: center; padding: 1.5rem; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; }
.form-input:focus { border-color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }
.btn-primary { background: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.4rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* Informes */
.informes-section { margin-top: 0.5rem; }
.informes-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.informe-card {
  display: flex; align-items: center; gap: 1rem; padding: 1.25rem;
  background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px;
  transition: border-color 0.2s, transform 0.15s;
}
.informe-card:hover { border-color: var(--color-primary); transform: translateY(-2px); }
.informe-icon { font-size: 2rem; flex-shrink: 0; }
.informe-body { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; overflow: hidden; }
.informe-titulo { font-size: 1rem; color: var(--color-text-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.informe-meta { font-size: 0.82rem; color: var(--color-text-muted); }
.informe-fecha { font-size: 0.75rem; color: rgba(255,255,255,0.3); }
.btn-download {
  background: var(--color-primary); color: #000; font-weight: 700;
  padding: 0.55rem 1.1rem; border-radius: 8px; text-decoration: none;
  font-size: 0.85rem; white-space: nowrap; flex-shrink: 0;
  transition: all 0.15s;
}
.btn-download:hover { background: #d4ed00; transform: scale(1.03); }

@media (max-width: 600px) {
  .informe-card { flex-direction: column; align-items: flex-start; }
  .btn-download { width: 100%; text-align: center; }
}

/* Report Detail Modal Styles */
.report-modal { max-width: 900px !important; width: 95% !important; max-height: 90vh !important; display: flex; flex-direction: column; padding: 0 !important; background: #000 !important; color: #fff !important; }
.report-modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: flex-start; background: #000; border-radius: 12px 12px 0 0; }
.report-modal-title h2 { margin: 0; font-size: 1.4rem; color: var(--color-primary); }
.report-modal-title p { margin: 0.25rem 0 0; font-size: 0.85rem; color: #888; }
.report-modal-content { padding: 2.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 2.5rem; background: #000; }

.rg-preview-titulo { font-size: 1.8rem; font-weight: 800; color: var(--color-primary); border-bottom: 2px solid var(--color-primary); padding-bottom: 0.5rem; margin-top: -1rem; }

.report-section { display: flex; flex-direction: column; gap: 0.75rem; text-align: left; }
.report-section label { font-size: 0.75rem; font-weight: 800; color: #aaa; letter-spacing: 0.1em; text-transform: uppercase; }
.report-section p { margin: 0; line-height: 1.6; color: #eee; font-size: 1rem; white-space: pre-line; }
.resumen-text-box { border-left: 3px solid var(--color-primary); padding: 1.25rem !important; background: rgba(227,255,4,0.03); border-radius: 4px; }

.client-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.25rem; }
.client-kpi-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 1.25rem; border-radius: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.client-kpi-val { font-size: 1.8rem; font-weight: 800; color: var(--color-primary); }
.client-kpi-label { font-size: 0.75rem; color: #888; text-transform: uppercase; margin-top: 0.35rem; }

.client-tareas-list { display: flex; flex-direction: column; gap: 0.85rem; }
.client-tarea-item { display: flex; align-items: center; gap: 1rem; padding: 1.15rem; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
.client-tarea-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.client-tarea-text { flex: 1; text-align: left; }
.client-tarea-text strong { display: block; font-size: 1rem; margin-bottom: 0.2rem; color: #fff; }
.client-tarea-text p { font-size: 0.9rem !important; color: #888 !important; margin: 0 !important; }
.client-tarea-hours { font-size: 0.9rem; font-weight: 700; color: var(--color-primary); padding: 0.25rem 0.5rem; background: rgba(227,255,4,0.1); border-radius: 4px; }

.client-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
.client-gallery img { width: 100%; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }

.report-double-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; }
.client-steps-dots { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.client-steps-dots li { font-size: 0.95rem; color: #ccc; display: flex; align-items: flex-start; gap: 0.75rem; }
.client-steps-dots li::before { content: "•"; color: var(--color-primary); font-weight: bold; }

.client-steps-ordered { counter-reset: my-counter; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.client-steps-ordered li { counter-increment: my-counter; font-size: 0.95rem; color: #ccc; display: flex; align-items: flex-start; gap: 0.85rem; }
.client-steps-ordered li::before { content: counter(my-counter); width: 22px; height: 22px; background: var(--color-primary); color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; flex-shrink: 0; }

.informe-actions { display: flex; align-items: center; gap: 1rem; }
.informe-actions .btn-text { font-weight: 700; font-size: 0.85rem; color: var(--color-primary); }

@media (max-width: 800px) {
  .report-double-grid { grid-template-columns: 1fr; }
  .report-modal-content { padding: 1.5rem; gap: 1.75rem; }
}
</style>
